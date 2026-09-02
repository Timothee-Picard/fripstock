import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createBaseCatalog } from '../catalog/catalog.defaults';
import { normalizeEmail } from '../common/email';
import { readPermissions, PERMISSIONS, type Permission } from '../common/permissions';
import type { ShopAccessSummary, CurrentUser } from '../common/types/current-user';
import { PrismaService } from '../prisma/prisma.service';
import { BASE_STATUSES, BASE_TRANSITIONS } from '../statuses/statuses.defaults';
import type { ChangePasswordDto } from './dto/change-password.dto';
import type { DeleteAccountDto } from './dto/delete-account.dto';
import type { LoginDto } from './dto/login.dto';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import type { RegisterDto } from './dto/register.dto';
import type { JwtPayload } from './jwt.strategy';

const BCRYPT_COST = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Crée l'entreprise et son gérant en une transaction, avec les statuts de
   * base et le catalogue de départ. Aucune boutique n'est créée
   * automatiquement : c'est une action à part.
   */
  async register(dto: RegisterDto) {
    const email = normalizeEmail(dto.email);
    const existing = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      throw new ConflictException('Un compte existe déjà avec cet email.');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);

    const manager = await this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({ data: { name: dto.companyName } });

      await tx.status.createMany({
        data: BASE_STATUSES.map((status, position) => ({
          ...status,
          position,
          companyId: company.id,
        })),
      });

      // Flux de départ : sans lui, la nouvelle entreprise tomberait dans le
      // repli permissif et le schéma s'ouvrirait vide, sans rien à comprendre.
      const created = await tx.status.findMany({
        where: { companyId: company.id },
        select: { id: true, name: true },
      });
      const byName = new Map(created.map((s) => [s.name, s.id]));
      await tx.statusTransition.createMany({
        data: BASE_TRANSITIONS.map(([source, target]) => ({
          sourceId: byName.get(source)!,
          targetId: byName.get(target)!,
        })),
      });
      // Catégories et attributs de départ : sans eux, la première création de
      // produit obligeait à inventer un catalogue avant d'avoir vu un écran.
      await createBaseCatalog(tx, company.id);

      return tx.user.create({
        data: {
          companyId: company.id,
          email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          isManager: true,
        },
      });
    });

    return this.issueToken(manager.id, manager.companyId, manager.isManager);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(dto.email) },
    });

    // Message identique dans les deux cas : distinguer "email inconnu" de
    // "mot de passe faux" permettrait d'énumérer les comptes existants.
    const failure = new UnauthorizedException('Email ou mot de passe incorrect.');
    if (!user) {
      // Hachage à vide malgré tout, pour que la réponse mette le même temps
      // qu'avec un email connu.
      await bcrypt.compare(
        dto.password,
        '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva',
      );
      throw failure;
    }
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw failure;

    return this.issueToken(user.id, user.companyId, user.isManager);
  }

  /**
   * Utilisateur du jeton, ou 401.
   *
   * Un jeton peut rester valide alors que son compte a disparu — employé
   * supprimé, base restaurée. `findFirstOrThrow` remonterait alors en 500 et
   * l'écran planterait ; un 401 renvoie proprement vers la connexion.
   */
  private async require(currentUser: CurrentUser) {
    const user = await this.prisma.user.findFirst({
      where: { id: currentUser.userId, companyId: currentUser.companyId },
    });
    if (!user) throw new UnauthorizedException('Session expirée. Reconnectez-vous.');
    return user;
  }

  /** Profil complet : identité, entreprise, et accès boutique par boutique. */
  async me(currentUser: CurrentUser) {
    const user = await this.prisma.user.findFirst({
      where: { id: currentUser.userId, companyId: currentUser.companyId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isManager: true,
        company: { select: { id: true, name: true } },
      },
    });
    if (!user) throw new UnauthorizedException('Session expirée. Reconnectez-vous.');

    return {
      ...user,
      shops: await this.shopAccesses(currentUser),
    };
  }

  /**
   * Le gérant voit toutes les boutiques de son entreprise avec tous les droits,
   * sans passer par la table d'accès. Un employé ne voit que les siennes.
   */
  async shopAccesses(currentUser: CurrentUser): Promise<ShopAccessSummary[]> {
    if (currentUser.isManager) {
      const shops = await this.prisma.shop.findMany({
        where: { companyId: currentUser.companyId },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      });
      return shops.map((b) => ({
        shopId: b.id,
        name: b.name,
        allRights: true,
        permissions: [...PERMISSIONS],
      }));
    }

    const accesses = await this.prisma.shopAccess.findMany({
      where: {
        userId: currentUser.userId,
        shop: { companyId: currentUser.companyId },
      },
      orderBy: { shop: { name: 'asc' } },
      select: { shopId: true, permissions: true, shop: { select: { name: true } } },
    });

    return accesses.map((a) => ({
      shopId: a.shopId,
      name: a.shop.name,
      allRights: false,
      permissions: Object.keys(readPermissions(a.permissions)) as Permission[],
    }));
  }

  /** Modification de son propre profil : prénom, nom, email. */
  async updateProfile(currentUser: CurrentUser, dto: UpdateProfileDto) {
    const user = await this.require(currentUser);

    const email = normalizeEmail(dto.email);
    const emailChanged = email !== user.email;

    if (emailChanged) {
      if (!dto.currentPassword) {
        throw new BadRequestException(
          'Le mot de passe actuel est requis pour changer votre adresse email.',
        );
      }
      const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
      if (!valid) throw new UnauthorizedException('Mot de passe actuel incorrect.');

      const taken = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (taken) throw new ConflictException('Un compte existe déjà avec cet email.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { firstName: dto.firstName, lastName: dto.lastName, email },
    });

    return this.me(currentUser);
  }

  /**
   * Changement de son propre mot de passe. L'ancien est exigé : une session
   * détournée ne doit pas suffire à verrouiller le compte de son propriétaire.
   */
  async changePassword(currentUser: CurrentUser, dto: ChangePasswordDto) {
    const user = await this.require(currentUser);

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Mot de passe actuel incorrect.');

    if (await bcrypt.compare(dto.newPassword, user.passwordHash)) {
      throw new BadRequestException("Le nouveau mot de passe est identique à l'ancien.");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(dto.newPassword, BCRYPT_COST) },
    });

    // Un jeton neuf est renvoyé pour que la session courante reste valide.
    // Attention : les jetons déjà émis ailleurs, eux, restent valables jusqu'à
    // leur expiration — le JWT est sans état, rien ne permet de les révoquer.
    return this.issueToken(user.id, user.companyId, user.isManager);
  }

  /**
   * Ce que la suppression du compte emporterait, pour que la confirmation le
   * chiffre au lieu de l'annoncer vaguement. Le gérant ne se compte pas parmi
   * les employés : il est celui qui lit l'écran.
   */
  async accountSummary(currentUser: CurrentUser) {
    const { companyId } = currentUser;
    const [company, shops, employees, products, depositors, contracts] = await Promise.all([
      this.prisma.company.findFirst({ where: { id: companyId }, select: { name: true } }),
      this.prisma.shop.count({ where: { companyId } }),
      this.prisma.user.count({ where: { companyId, isManager: false } }),
      this.prisma.product.count({ where: { companyId } }),
      this.prisma.depositor.count({ where: { companyId } }),
      this.prisma.depositContract.count({ where: { depositor: { companyId } } }),
    ]);
    if (!company) throw new UnauthorizedException('Session expirée. Reconnectez-vous.');

    return { companyName: company.name, shops, employees, products, depositors, contracts };
  }

  /**
   * Suppression du compte : l'entreprise entière et tout ce qu'elle contient.
   *
   * « Le compte », c'est l'entreprise — un gérant n'en a qu'une et une
   * entreprise sans gérant n'aurait plus personne pour l'administrer. Supprimer
   * le seul le laisserait ses employés enfermés dans des données que personne ne
   * peut plus gérer. Un employé, lui, est supprimé par son gérant
   * (`DELETE /users/:id`) : la route est réservée au gérant.
   *
   * Le mot de passe est réexigé, comme pour un changement d'email : c'est
   * définitif, et il n'y a pas de corbeille.
   */
  async deleteAccount(currentUser: CurrentUser, dto: DeleteAccountDto) {
    const user = await this.require(currentUser);

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Mot de passe incorrect.');

    const { companyId } = currentUser;
    await this.prisma.$transaction(async (tx) => {
      // Les produits d'abord : leur catégorie et leur statut sont en `Restrict`,
      // une cascade partie de l'entreprise buterait dessus. Ils emportent au
      // passage leurs valeurs d'attributs et leur historique de statut.
      await tx.product.deleteMany({ where: { companyId } });

      // Puis les catégories, des feuilles vers la racine : `parentId` est en
      // `Restrict`, et Postgres le vérifie ligne à ligne — y compris quand
      // l'enfant disparaît dans la même commande. Supprimer l'arbre d'un coup
      // échouerait donc sur ses propres descendants.
      for (;;) {
        const { count } = await tx.category.deleteMany({
          where: { companyId, children: { none: {} } },
        });
        if (count === 0) break;
      }

      // Le reste tombe en cascade : boutiques, employés et leurs accès,
      // attributs et leurs options, statuts et leur flux, déposants, contrats,
      // notifications.
      await tx.company.delete({ where: { id: companyId } });
    });

    return { deleted: true };
  }

  private async issueToken(userId: string, companyId: string, isManager: boolean) {
    const payload: JwtPayload = { sub: userId, companyId, isManager };
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: { id: userId, companyId, isManager },
    };
  }
}
