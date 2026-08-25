import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { normaliserEmail } from '../common/email';
import { lirePermissions, PERMISSIONS, type Permission } from '../common/permissions';
import type { AccesBoutiqueResume, UtilisateurCourant } from '../common/types/utilisateur-courant';
import { PrismaService } from '../prisma/prisma.service';
import type { ChangerMotDePasseDto } from './dto/changer-mot-de-passe.dto';
import type { LoginDto } from './dto/login.dto';
import type { ModifierProfilDto } from './dto/modifier-profil.dto';
import type { RegisterDto } from './dto/register.dto';
import type { ChargeJwt } from './jwt.strategy';

const COUT_BCRYPT = 10;

/** Statuts de base créés à l'inscription. Voir la section "Statuts" de CLAUDE.md. */
const STATUTS_DE_BASE = [
  {
    nom: 'En stock',
    couleur: '#6b7280',
    estDefaut: true,
    estVente: false,
    bloqueVente: false,
    sortStock: false,
  },
  {
    nom: 'En rayon',
    couleur: '#3b82f6',
    estDefaut: false,
    estVente: false,
    bloqueVente: false,
    sortStock: false,
  },
  {
    nom: 'Réservé',
    couleur: '#f59e0b',
    estDefaut: false,
    estVente: false,
    bloqueVente: false,
    sortStock: false,
  },
  {
    nom: 'Vendu',
    couleur: '#10b981',
    estDefaut: false,
    estVente: true,
    bloqueVente: false,
    sortStock: true,
  },
  {
    nom: 'Rendu au client',
    couleur: '#8b5cf6',
    estDefaut: false,
    estVente: false,
    bloqueVente: true,
    sortStock: true,
  },
  {
    nom: 'Retiré',
    couleur: '#ef4444',
    estDefaut: false,
    estVente: false,
    bloqueVente: true,
    sortStock: true,
  },
];

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Crée l'entreprise et son gérant en une transaction, avec les statuts de
   * base. Aucune boutique n'est créée automatiquement : c'est une action à part.
   */
  async register(dto: RegisterDto) {
    const email = normaliserEmail(dto.email);
    const existant = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existant) {
      throw new ConflictException('Un compte existe déjà avec cet email.');
    }

    const motDePasseHash = await bcrypt.hash(dto.motDePasse, COUT_BCRYPT);

    const gerant = await this.prisma.$transaction(async (tx) => {
      const entreprise = await tx.entreprise.create({ data: { nom: dto.nomEntreprise } });
      await tx.statut.createMany({
        data: STATUTS_DE_BASE.map((statut, ordre) => ({
          ...statut,
          ordre,
          entrepriseId: entreprise.id,
        })),
      });
      return tx.user.create({
        data: {
          entrepriseId: entreprise.id,
          email,
          motDePasseHash,
          prenom: dto.prenom,
          nom: dto.nom,
          estGerant: true,
        },
      });
    });

    return this.emettreJeton(gerant.id, gerant.entrepriseId, gerant.estGerant);
  }

  async login(dto: LoginDto) {
    const utilisateur = await this.prisma.user.findUnique({
      where: { email: normaliserEmail(dto.email) },
    });

    // Message identique dans les deux cas : distinguer "email inconnu" de
    // "mot de passe faux" permettrait d'énumérer les comptes existants.
    const echec = new UnauthorizedException('Email ou mot de passe incorrect.');
    if (!utilisateur) {
      // Hachage à vide malgré tout, pour que la réponse mette le même temps
      // qu'avec un email connu.
      await bcrypt.compare(
        dto.motDePasse,
        '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva',
      );
      throw echec;
    }
    const valide = await bcrypt.compare(dto.motDePasse, utilisateur.motDePasseHash);
    if (!valide) throw echec;

    return this.emettreJeton(utilisateur.id, utilisateur.entrepriseId, utilisateur.estGerant);
  }

  /** Profil complet : identité, entreprise, et accès boutique par boutique. */
  async me(courant: UtilisateurCourant) {
    const utilisateur = await this.prisma.user.findFirstOrThrow({
      where: { id: courant.userId, entrepriseId: courant.entrepriseId },
      select: {
        id: true,
        email: true,
        prenom: true,
        nom: true,
        estGerant: true,
        entreprise: { select: { id: true, nom: true } },
      },
    });

    return {
      ...utilisateur,
      boutiques: await this.accesBoutiques(courant),
    };
  }

  /**
   * Le gérant voit toutes les boutiques de son entreprise avec tous les droits,
   * sans passer par la table d'accès. Un employé ne voit que les siennes.
   */
  async accesBoutiques(courant: UtilisateurCourant): Promise<AccesBoutiqueResume[]> {
    if (courant.estGerant) {
      const boutiques = await this.prisma.boutique.findMany({
        where: { entrepriseId: courant.entrepriseId },
        orderBy: { nom: 'asc' },
        select: { id: true, nom: true },
      });
      return boutiques.map((b) => ({
        boutiqueId: b.id,
        nom: b.nom,
        tousDroits: true,
        permissions: [...PERMISSIONS],
      }));
    }

    const acces = await this.prisma.accesBoutique.findMany({
      where: {
        userId: courant.userId,
        boutique: { entrepriseId: courant.entrepriseId },
      },
      orderBy: { boutique: { nom: 'asc' } },
      select: { boutiqueId: true, permissions: true, boutique: { select: { nom: true } } },
    });

    return acces.map((a) => ({
      boutiqueId: a.boutiqueId,
      nom: a.boutique.nom,
      tousDroits: false,
      permissions: Object.keys(lirePermissions(a.permissions)) as Permission[],
    }));
  }

  /** Modification de son propre profil : prénom, nom, email. */
  async modifierProfil(courant: UtilisateurCourant, dto: ModifierProfilDto) {
    const utilisateur = await this.prisma.user.findFirstOrThrow({
      where: { id: courant.userId, entrepriseId: courant.entrepriseId },
    });

    const email = normaliserEmail(dto.email);
    const changeEmail = email !== utilisateur.email;

    if (changeEmail) {
      if (!dto.motDePasseActuel) {
        throw new BadRequestException(
          'Le mot de passe actuel est requis pour changer votre adresse email.',
        );
      }
      const valide = await bcrypt.compare(dto.motDePasseActuel, utilisateur.motDePasseHash);
      if (!valide) throw new UnauthorizedException('Mot de passe actuel incorrect.');

      const pris = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (pris) throw new ConflictException('Un compte existe déjà avec cet email.');
    }

    await this.prisma.user.update({
      where: { id: utilisateur.id },
      data: { prenom: dto.prenom, nom: dto.nom, email },
    });

    return this.me(courant);
  }

  /**
   * Changement de son propre mot de passe. L'ancien est exigé : une session
   * détournée ne doit pas suffire à verrouiller le compte de son propriétaire.
   */
  async changerMotDePasse(courant: UtilisateurCourant, dto: ChangerMotDePasseDto) {
    const utilisateur = await this.prisma.user.findFirstOrThrow({
      where: { id: courant.userId, entrepriseId: courant.entrepriseId },
    });

    const valide = await bcrypt.compare(dto.motDePasseActuel, utilisateur.motDePasseHash);
    if (!valide) throw new UnauthorizedException('Mot de passe actuel incorrect.');

    if (await bcrypt.compare(dto.nouveauMotDePasse, utilisateur.motDePasseHash)) {
      throw new BadRequestException("Le nouveau mot de passe est identique à l'ancien.");
    }

    await this.prisma.user.update({
      where: { id: utilisateur.id },
      data: { motDePasseHash: await bcrypt.hash(dto.nouveauMotDePasse, COUT_BCRYPT) },
    });

    // Un jeton neuf est renvoyé pour que la session courante reste valide.
    // Attention : les jetons déjà émis ailleurs, eux, restent valables jusqu'à
    // leur expiration — le JWT est sans état, rien ne permet de les révoquer.
    return this.emettreJeton(utilisateur.id, utilisateur.entrepriseId, utilisateur.estGerant);
  }

  private async emettreJeton(userId: string, entrepriseId: string, estGerant: boolean) {
    const charge: ChargeJwt = { sub: userId, entrepriseId, estGerant };
    return {
      accessToken: await this.jwt.signAsync(charge),
      utilisateur: { id: userId, entrepriseId, estGerant },
    };
  }
}
