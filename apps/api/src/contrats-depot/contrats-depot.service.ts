import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { UtilisateurCourant } from '../common/types/utilisateur-courant';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreerContratDto } from './dto/creer-contrat.dto';
import type { ModifierContratDto } from './dto/modifier-contrat.dto';
import type { RattacherProduitsDto } from './dto/rattacher-produits.dto';

const INCLUDE = {
  client: { select: { id: true, nom: true, prenom: true, commissionDefaut: true } },
  _count: { select: { produits: true } },
} satisfies Prisma.ContratDepotInclude;

@Injectable()
export class ContratsDepotService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `ContratDepot` n'a pas de `entrepriseId` : tout filtre passe par `client`.
   * Voir la règle de scoping via relation parente dans CLAUDE.md.
   */
  private scope(courant: UtilisateurCourant): Prisma.ContratDepotWhereInput {
    return { client: { entrepriseId: courant.entrepriseId } };
  }

  lister(courant: UtilisateurCourant) {
    return this.prisma.contratDepot.findMany({
      where: this.scope(courant),
      orderBy: { dateFin: 'asc' },
      include: INCLUDE,
    });
  }

  async detail(courant: UtilisateurCourant, id: string) {
    const contrat = await this.prisma.contratDepot.findFirst({
      where: { id, ...this.scope(courant) },
      include: {
        ...INCLUDE,
        produits: {
          orderBy: { createdAt: 'desc' },
          include: { statut: true, boutique: { select: { id: true, nom: true } } },
        },
      },
    });
    if (!contrat) throw new NotFoundException('Contrat de dépôt introuvable.');
    return contrat;
  }

  async creer(courant: UtilisateurCourant, dto: CreerContratDto) {
    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, entrepriseId: courant.entrepriseId },
    });
    if (!client) throw new BadRequestException("Ce déposant n'appartient pas à votre entreprise.");

    const dateDebut = new Date(dto.dateDebut);
    const dateFin = new Date(dto.dateFin);
    if (dateFin <= dateDebut) {
      throw new BadRequestException('La date de fin doit suivre la date de début.');
    }

    return this.prisma.contratDepot.create({
      data: {
        clientId: client.id,
        dateDebut,
        dateFin,
        // Copiée depuis le déposant à la création, modifiable ensuite pour ce
        // contrat précis (voir CLAUDE.md).
        commission: dto.commission ?? client.commissionDefaut,
        notifyBeforeDays: dto.notifyBeforeDays ?? 7,
      },
      include: INCLUDE,
    });
  }

  async modifier(courant: UtilisateurCourant, id: string, dto: ModifierContratDto) {
    const contrat = await this.detail(courant, id);

    const dateDebut = dto.dateDebut ? new Date(dto.dateDebut) : contrat.dateDebut;
    const dateFin = dto.dateFin ? new Date(dto.dateFin) : contrat.dateFin;
    if (dateFin <= dateDebut) {
      throw new BadRequestException('La date de fin doit suivre la date de début.');
    }

    return this.prisma.contratDepot.update({
      where: { id },
      data: {
        dateDebut,
        dateFin,
        ...(dto.commission !== undefined ? { commission: dto.commission } : {}),
        ...(dto.notifyBeforeDays !== undefined ? { notifyBeforeDays: dto.notifyBeforeDays } : {}),
        ...(dto.statut !== undefined ? { statut: dto.statut } : {}),
        // Repousser l'échéance doit pouvoir re-déclencher une alerte : sinon le
        // contrat prolongé resterait marqué comme déjà notifié.
        ...(dto.dateFin !== undefined ? { notifieLe: null } : {}),
      },
      include: INCLUDE,
    });
  }

  async supprimer(courant: UtilisateurCourant, id: string) {
    await this.detail(courant, id);
    const produits = await this.prisma.produit.count({ where: { contratDepotId: id } });
    if (produits > 0) {
      throw new ConflictException(
        `Ce contrat porte ${produits} produit(s). Détachez-les avant de le supprimer.`,
      );
    }
    await this.prisma.contratDepot.delete({ where: { id } });
    return { supprime: true };
  }

  /**
   * Rattache des produits existants au contrat, et les bascule en dépôt-vente.
   *
   * Un produit déjà vendu est refusé : sa commission a été figée d'après son
   * contrat d'alors, le rattacher ailleurs falsifierait un relevé.
   */
  async rattacherProduits(courant: UtilisateurCourant, id: string, dto: RattacherProduitsDto) {
    await this.detail(courant, id);

    const produits = await this.prisma.produit.findMany({
      where: { id: { in: dto.produitIds }, entrepriseId: courant.entrepriseId },
      include: { statut: { select: { estVente: true, nom: true } } },
    });
    if (produits.length !== dto.produitIds.length) {
      throw new BadRequestException("Un produit cité n'appartient pas à votre entreprise.");
    }

    const vendus = produits.filter((p) => p.statut.estVente);
    if (vendus.length > 0) {
      throw new ConflictException(
        `Déjà vendu(s), ces produits ne peuvent plus changer de contrat : ${vendus
          .map((p) => p.nom)
          .join(', ')}.`,
      );
    }

    await this.prisma.produit.updateMany({
      where: { id: { in: dto.produitIds } },
      data: {
        contratDepotId: id,
        typeVente: 'DEPOT_VENTE',
        // L'article appartient au déposant : le prix d'achat n'a plus de sens.
        prixAchat: null,
        deposantPaye: false,
      },
    });

    return this.detail(courant, id);
  }

  /** Détache un produit de son contrat et le repasse en achat-revente. */
  async detacherProduit(courant: UtilisateurCourant, id: string, produitId: string) {
    await this.detail(courant, id);
    const produit = await this.prisma.produit.findFirst({
      where: { id: produitId, contratDepotId: id, entrepriseId: courant.entrepriseId },
      include: { statut: { select: { estVente: true } } },
    });
    if (!produit) throw new NotFoundException('Produit introuvable dans ce contrat.');
    if (produit.statut.estVente) {
      throw new ConflictException(
        'Ce produit est vendu : le détacher fausserait le relevé du déposant.',
      );
    }

    await this.prisma.produit.update({
      where: { id: produitId },
      data: { contratDepotId: null, typeVente: 'ACHAT_REVENTE', deposantPaye: null },
    });
    return this.detail(courant, id);
  }
}
