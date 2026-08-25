import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { lirePermissions, type Permission, type PermissionMap } from '../common/permissions';
import type { UtilisateurCourant } from '../common/types/utilisateur-courant';
import { PrismaService } from '../prisma/prisma.service';
import type { DefinirAccesDto } from './dto/definir-acces.dto';
import type { InviterUserDto } from './dto/inviter-user.dto';

const COUT_BCRYPT = 10;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  lister(courant: UtilisateurCourant) {
    return this.prisma.user.findMany({
      where: { entrepriseId: courant.entrepriseId },
      orderBy: [{ estGerant: 'desc' }, { nom: 'asc' }],
      select: {
        id: true,
        email: true,
        prenom: true,
        nom: true,
        estGerant: true,
        createdAt: true,
        acces: {
          select: {
            boutiqueId: true,
            permissions: true,
            boutique: { select: { nom: true } },
          },
        },
      },
    });
  }

  async inviter(courant: UtilisateurCourant, dto: InviterUserDto) {
    const existant = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    if (existant) {
      throw new ConflictException('Un compte existe déjà avec cet email.');
    }

    // Sans mot de passe fourni, on en génère un et on le renvoie une seule
    // fois : il n'est jamais stocké en clair, il faudra le transmettre à
    // l'employé de vive voix.
    const motDePasse = dto.motDePasse ?? randomBytes(9).toString('base64url');

    const utilisateur = await this.prisma.user.create({
      data: {
        entrepriseId: courant.entrepriseId,
        email: dto.email,
        motDePasseHash: await bcrypt.hash(motDePasse, COUT_BCRYPT),
        prenom: dto.prenom,
        nom: dto.nom,
        estGerant: false,
      },
      select: { id: true, email: true, prenom: true, nom: true, estGerant: true },
    });

    return {
      ...utilisateur,
      motDePasseTemporaire: dto.motDePasse ? undefined : motDePasse,
    };
  }

  /** Remplace intégralement les accès d'un employé. */
  async definirAcces(courant: UtilisateurCourant, userId: string, dto: DefinirAccesDto) {
    const cible = await this.trouverEmploye(courant, userId);

    const boutiqueIds = dto.acces.map((a) => a.boutiqueId);
    if (new Set(boutiqueIds).size !== boutiqueIds.length) {
      throw new BadRequestException('Une même boutique apparaît plusieurs fois.');
    }

    // Les boutiques citées doivent appartenir à l'entreprise du gérant : sinon
    // on donnerait accès à la boutique d'une autre entreprise.
    const valides = await this.prisma.boutique.count({
      where: { id: { in: boutiqueIds }, entrepriseId: courant.entrepriseId },
    });
    if (valides !== boutiqueIds.length) {
      throw new BadRequestException("Une boutique citée n'appartient pas à cette entreprise.");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.accesBoutique.deleteMany({ where: { userId: cible.id } });
      if (dto.acces.length > 0) {
        await tx.accesBoutique.createMany({
          data: dto.acces.map((a) => ({
            userId: cible.id,
            boutiqueId: a.boutiqueId,
            permissions: enMap(a.permissions),
          })),
        });
      }
    });

    return this.lister(courant).then((tous) => tous.find((u) => u.id === cible.id));
  }

  async supprimer(courant: UtilisateurCourant, userId: string) {
    const cible = await this.trouverEmploye(courant, userId);
    await this.prisma.user.delete({ where: { id: cible.id } });
    return { supprime: true };
  }

  /**
   * Un gérant ne peut agir que sur les employés de sa propre entreprise, et
   * jamais sur un autre gérant (ni sur lui-même).
   */
  private async trouverEmploye(courant: UtilisateurCourant, userId: string) {
    const cible = await this.prisma.user.findFirst({
      where: { id: userId, entrepriseId: courant.entrepriseId },
      select: { id: true, estGerant: true },
    });
    if (!cible) throw new NotFoundException('Utilisateur introuvable.');
    if (cible.estGerant) {
      throw new BadRequestException("Un gérant n'est pas géré via cette route.");
    }
    return cible;
  }
}

/** `['produits.voir']` → `{ 'produits.voir': true }`, le format stocké en base. */
function enMap(permissions: Permission[]): PermissionMap {
  const map: PermissionMap = {};
  for (const p of permissions) map[p] = true;
  return lirePermissions(map);
}
