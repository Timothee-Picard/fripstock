import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { UtilisateurCourant } from '../common/types/utilisateur-courant';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StatutsService } from '../statuts/statuts.service';
import { UploadsService } from '../uploads/uploads.service';
import {
  normaliserValeur,
  type AttributApplicable,
  type ValeurNormalisee,
} from './attributs.validation';
import type { AssignerBoutiqueDto } from './dto/assigner-boutique.dto';
import type { ChangerStatutDto } from './dto/changer-statut.dto';
import type { CreerProduitDto } from './dto/creer-produit.dto';
import type { FiltrerProduitsDto } from './dto/filtrer-produits.dto';
import type { ModifierProduitDto } from './dto/modifier-produit.dto';
import type { ValeurAttributDto } from './dto/valeur-attribut.dto';

const PAR_PAGE_DEFAUT = 25;

const DETAIL_INCLUDE = {
  categorie: { select: { id: true, nom: true } },
  boutique: { select: { id: true, nom: true } },
  statut: true,
  contratDepot: {
    select: {
      id: true,
      dateDebut: true,
      dateFin: true,
      commission: true,
      client: { select: { id: true, nom: true, prenom: true } },
    },
  },
  valeurs: { include: { attribut: { select: { id: true, nom: true, type: true } } } },
  options: {
    include: { option: { include: { attribut: { select: { id: true, nom: true, type: true } } } } },
  },
} satisfies Prisma.ProduitInclude;

/**
 * Résolveur pour @BoutiqueDepuisRessource : la boutique d'un produit n'est ni
 * dans les params ni dans le body, il faut charger le produit.
 *
 * Fonction autonome et non méthode statique : elle est passée en valeur au
 * décorateur, donc jamais liée à une instance.
 *
 * La requête est scopée à l'entreprise, sinon elle permettrait de sonder
 * l'existence de produits d'ailleurs.
 */
export async function boutiqueDuProduit(
  prisma: PrismaService,
  id: string,
  entrepriseId: string,
): Promise<string | null> {
  const produit = await prisma.produit.findFirst({
    where: { id, entrepriseId },
    select: { boutiqueId: true },
  });
  return produit?.boutiqueId ?? null;
}

@Injectable()
export class ProduitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly statuts: StatutsService,
    private readonly uploads: UploadsService,
  ) {}

  async lister(courant: UtilisateurCourant, filtres: FiltrerProduitsDto) {
    const page = filtres.page ?? 1;
    const parPage = filtres.parPage ?? PAR_PAGE_DEFAUT;

    const where: Prisma.ProduitWhereInput = {
      entrepriseId: courant.entrepriseId,
      ...(await this.restrictionBoutiques(courant, filtres)),
      ...(filtres.categorieId ? { categorieId: filtres.categorieId } : {}),
      ...(filtres.statutId ? { statutId: filtres.statutId } : {}),
      ...(filtres.typeVente ? { typeVente: filtres.typeVente } : {}),
      ...(filtres.recherche
        ? {
            OR: [
              { nom: { contains: filtres.recherche, mode: 'insensitive' } },
              { reference: { contains: filtres.recherche, mode: 'insensitive' } },
              { description: { contains: filtres.recherche, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(filtres.creeApres || filtres.creeAvant
        ? {
            createdAt: {
              ...(filtres.creeApres ? { gte: new Date(filtres.creeApres) } : {}),
              ...(filtres.creeAvant ? { lte: new Date(filtres.creeAvant) } : {}),
            },
          }
        : {}),
      ...(filtres.venduApres || filtres.venduAvant
        ? {
            dateVente: {
              ...(filtres.venduApres ? { gte: new Date(filtres.venduApres) } : {}),
              ...(filtres.venduAvant ? { lte: new Date(filtres.venduAvant) } : {}),
            },
          }
        : {}),
    };

    const [total, produits] = await this.prisma.$transaction([
      this.prisma.produit.count({ where }),
      this.prisma.produit.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * parPage,
        take: parPage,
        include: {
          categorie: { select: { id: true, nom: true } },
          boutique: { select: { id: true, nom: true } },
          statut: true,
        },
      }),
    ]);

    return { produits, total, page, parPage, pages: Math.max(1, Math.ceil(total / parPage)) };
  }

  async detail(courant: UtilisateurCourant, id: string) {
    const produit = await this.prisma.produit.findFirst({
      where: { id, entrepriseId: courant.entrepriseId },
      include: {
        ...DETAIL_INCLUDE,
        historique: {
          orderBy: { changedAt: 'desc' },
          include: {
            statut: { select: { id: true, nom: true, couleur: true } },
            auteur: { select: { id: true, prenom: true, nom: true } },
          },
        },
      },
    });
    if (!produit) throw new NotFoundException('Produit introuvable.');
    await this.exigerAccesBoutique(courant, produit.boutiqueId);
    return produit;
  }

  async creer(courant: UtilisateurCourant, dto: CreerProduitDto) {
    await this.exigerCategorie(courant, dto.categorieId);
    if (dto.boutiqueId) await this.exigerBoutique(courant, dto.boutiqueId);

    const statut = dto.statutId
      ? await this.exigerStatut(courant, dto.statutId)
      : await this.statuts.parDefaut(courant.entrepriseId);

    const contrat = await this.verifierTypeVente(courant, dto.typeVente, dto.contratDepotId);
    const valeurs = await this.normaliserAttributs(courant, dto.categorieId, dto.attributs ?? []);

    const produit = await this.prisma.$transaction(async (tx) => {
      const cree = await tx.produit.create({
        data: {
          entrepriseId: courant.entrepriseId,
          boutiqueId: dto.boutiqueId ?? null,
          categorieId: dto.categorieId,
          statutId: statut.id,
          nom: dto.nom,
          reference: dto.reference ?? null,
          description: dto.description ?? null,
          commentaire: dto.commentaire ?? null,
          photoUrl: dto.photoUrl ?? null,
          prixAchat: dto.typeVente === 'ACHAT_REVENTE' ? (dto.prixAchat ?? null) : null,
          prixVente: dto.prixVente ?? null,
          quantite: dto.quantite ?? 1,
          typeVente: dto.typeVente,
          contratDepotId: contrat?.id ?? null,
          deposantPaye: dto.typeVente === 'DEPOT_VENTE' ? false : null,
        },
      });
      await this.ecrireValeurs(tx, cree.id, valeurs);
      await tx.historiqueStatut.create({
        data: {
          produitId: cree.id,
          statutId: statut.id,
          changedByUserId: courant.userId,
          note: 'Création du produit',
        },
      });
      return cree;
    });

    return this.detail(courant, produit.id);
  }

  async modifier(courant: UtilisateurCourant, id: string, dto: ModifierProduitDto) {
    const produit = await this.chargerPourEcriture(courant, id);

    const categorieId = dto.categorieId ?? produit.categorieId;
    if (dto.categorieId) await this.exigerCategorie(courant, dto.categorieId);
    if (dto.boutiqueId) await this.exigerBoutique(courant, dto.boutiqueId);

    const typeVente = dto.typeVente ?? produit.typeVente;
    const contrat = await this.verifierTypeVente(
      courant,
      typeVente,
      dto.contratDepotId ?? produit.contratDepotId ?? undefined,
    );

    // Changer de catégorie peut rendre des attributs inapplicables : on
    // revalide l'ensemble contre la catégorie finale.
    const valeurs =
      dto.attributs !== undefined || dto.categorieId !== undefined
        ? await this.normaliserAttributs(
            courant,
            categorieId,
            dto.attributs ?? (await this.valeursActuelles(id)),
          )
        : null;

    await this.prisma.$transaction(async (tx) => {
      await tx.produit.update({
        where: { id },
        data: {
          ...(dto.nom !== undefined ? { nom: dto.nom } : {}),
          ...(dto.categorieId !== undefined ? { categorieId: dto.categorieId } : {}),
          ...(dto.boutiqueId !== undefined ? { boutiqueId: dto.boutiqueId } : {}),
          ...(dto.reference !== undefined ? { reference: dto.reference } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.commentaire !== undefined ? { commentaire: dto.commentaire } : {}),
          ...(dto.photoUrl !== undefined ? { photoUrl: dto.photoUrl } : {}),
          ...(dto.prixVente !== undefined ? { prixVente: dto.prixVente } : {}),
          ...(dto.quantite !== undefined ? { quantite: dto.quantite } : {}),
          ...(dto.typeVente !== undefined ? { typeVente: dto.typeVente } : {}),
          // prixAchat n'a de sens qu'en achat-revente (voir CLAUDE.md).
          ...(typeVente === 'ACHAT_REVENTE'
            ? dto.prixAchat !== undefined
              ? { prixAchat: dto.prixAchat }
              : {}
            : { prixAchat: null }),
          contratDepotId: contrat?.id ?? null,
          ...(typeVente === 'DEPOT_VENTE'
            ? produit.deposantPaye === null
              ? { deposantPaye: false }
              : {}
            : { deposantPaye: null }),
        },
      });
      if (valeurs) {
        await tx.valeurAttribut.deleteMany({ where: { produitId: id } });
        await tx.produitAttributOption.deleteMany({ where: { produitId: id } });
        await this.ecrireValeurs(tx, id, valeurs);
      }
    });

    return this.detail(courant, id);
  }

  async assignerBoutique(courant: UtilisateurCourant, id: string, dto: AssignerBoutiqueDto) {
    await this.chargerPourEcriture(courant, id);
    if (dto.boutiqueId) await this.exigerBoutique(courant, dto.boutiqueId);

    await this.prisma.produit.update({
      where: { id },
      data: { boutiqueId: dto.boutiqueId ?? null },
    });
    return this.detail(courant, id);
  }

  /**
   * Change le statut d'un produit.
   *
   * Toutes les règles reposent sur les flags de `Statut`, jamais sur le
   * libellé : le gérant peut renommer ses statuts. Voir CLAUDE.md.
   */
  async changerStatut(courant: UtilisateurCourant, id: string, dto: ChangerStatutDto) {
    const produit = await this.chargerPourEcriture(courant, id);
    const actuel = await this.prisma.statut.findUniqueOrThrow({ where: { id: produit.statutId } });
    const cible = await this.exigerStatut(courant, dto.statutId);

    // Un produit rendu ou retiré ne redevient jamais vendable.
    if (actuel.bloqueVente && cible.estVente) {
      throw new ForbiddenException(
        `Ce produit est « ${actuel.nom} » : il ne peut plus être vendu.`,
      );
    }
    if (actuel.bloqueVente && dto.prixVendu !== undefined) {
      throw new ForbiddenException(
        `Ce produit est « ${actuel.nom} » : son prix vendu ne peut plus être modifié.`,
      );
    }

    if (!cible.estVente && (dto.prixVendu !== undefined || dto.dateVente !== undefined)) {
      throw new BadRequestException(
        `« ${cible.nom} » n'est pas un statut de vente : prix vendu et date de vente ne s'appliquent pas.`,
      );
    }

    let donneesVente: Prisma.ProduitUpdateInput = {};
    if (cible.estVente) {
      if (dto.prixVendu === undefined) {
        throw new BadRequestException(
          `« ${cible.nom} » est un statut de vente : indiquez le prix vendu.`,
        );
      }
      donneesVente = {
        prixVendu: dto.prixVendu,
        dateVente: dto.dateVente ? new Date(dto.dateVente) : new Date(),
      };
      // Gel de la commission : le relevé, l'export et les stats liront cette
      // valeur, jamais celle du contrat, qui peut changer après coup.
      if (produit.typeVente === 'DEPOT_VENTE' && produit.contratDepotId) {
        const contrat = await this.prisma.contratDepot.findUniqueOrThrow({
          where: { id: produit.contratDepotId },
          select: { commission: true },
        });
        donneesVente.commissionAppliquee = contrat.commission;
      }
    }

    await this.prisma.$transaction([
      this.prisma.produit.update({
        where: { id },
        data: { statut: { connect: { id: cible.id } }, ...donneesVente },
      }),
      this.prisma.historiqueStatut.create({
        data: {
          produitId: id,
          statutId: cible.id,
          changedByUserId: courant.userId,
          note: dto.note ?? null,
        },
      }),
    ]);

    return this.detail(courant, id);
  }

  async supprimer(courant: UtilisateurCourant, id: string) {
    const produit = await this.chargerPourEcriture(courant, id);
    await this.prisma.produit.delete({ where: { id } });
    if (produit.photoUrl) await this.uploads.supprimer(produit.photoUrl);
    return { supprime: true };
  }

  // --- Helpers -------------------------------------------------------------

  /**
   * Restriction de visibilité d'un employé : ses boutiques, plus le stock
   * central. Voir la règle « Produits non assignés » de CLAUDE.md.
   */
  private async restrictionBoutiques(
    courant: UtilisateurCourant,
    filtres: FiltrerProduitsDto,
  ): Promise<Prisma.ProduitWhereInput> {
    if (filtres.nonAssigne === 'true') return { boutiqueId: null };
    if (filtres.boutiqueId) {
      await this.exigerBoutique(courant, filtres.boutiqueId);
      return { boutiqueId: filtres.boutiqueId };
    }
    if (courant.estGerant) return {};

    const acces = await this.prisma.accesBoutique.findMany({
      where: { userId: courant.userId, boutique: { entrepriseId: courant.entrepriseId } },
      select: { boutiqueId: true },
    });
    return { OR: [{ boutiqueId: null }, { boutiqueId: { in: acces.map((a) => a.boutiqueId) } }] };
  }

  private async exigerAccesBoutique(courant: UtilisateurCourant, boutiqueId: string | null) {
    if (courant.estGerant || boutiqueId === null) return;
    const acces = await this.prisma.accesBoutique.count({
      where: { userId: courant.userId, boutiqueId },
    });
    if (acces === 0) throw new NotFoundException('Produit introuvable.');
  }

  private async chargerPourEcriture(courant: UtilisateurCourant, id: string) {
    const produit = await this.prisma.produit.findFirst({
      where: { id, entrepriseId: courant.entrepriseId },
    });
    if (!produit) throw new NotFoundException('Produit introuvable.');
    await this.exigerAccesBoutique(courant, produit.boutiqueId);
    return produit;
  }

  private async exigerCategorie(courant: UtilisateurCourant, id: string) {
    const c = await this.prisma.categorie.findFirst({
      where: { id, entrepriseId: courant.entrepriseId },
      select: { id: true },
    });
    if (!c) throw new BadRequestException("Cette catégorie n'appartient pas à votre entreprise.");
  }

  private async exigerBoutique(courant: UtilisateurCourant, id: string) {
    const b = await this.prisma.boutique.findFirst({
      where: { id, entrepriseId: courant.entrepriseId },
      select: { id: true },
    });
    if (!b) throw new BadRequestException("Cette boutique n'appartient pas à votre entreprise.");
  }

  private async exigerStatut(courant: UtilisateurCourant, id: string) {
    const s = await this.prisma.statut.findFirst({
      where: { id, entrepriseId: courant.entrepriseId },
    });
    if (!s) throw new BadRequestException("Ce statut n'appartient pas à votre entreprise.");
    return s;
  }

  /** `DEPOT_VENTE` exige un contrat ; `ACHAT_REVENTE` en refuse un. */
  private async verifierTypeVente(
    courant: UtilisateurCourant,
    typeVente: 'ACHAT_REVENTE' | 'DEPOT_VENTE',
    contratDepotId?: string,
  ) {
    if (typeVente === 'ACHAT_REVENTE') {
      if (contratDepotId) {
        throw new BadRequestException(
          "Un produit en achat-revente n'est rattaché à aucun contrat de dépôt.",
        );
      }
      return null;
    }

    if (!contratDepotId) {
      throw new BadRequestException('Un produit en dépôt-vente doit être rattaché à un contrat.');
    }
    const contrat = await this.prisma.contratDepot.findFirst({
      // Pas de entrepriseId sur ContratDepot : le cloisonnement passe par le client.
      where: { id: contratDepotId, client: { entrepriseId: courant.entrepriseId } },
      select: { id: true },
    });
    if (!contrat) {
      throw new BadRequestException("Ce contrat de dépôt n'appartient pas à votre entreprise.");
    }
    return contrat;
  }

  /** Valide chaque valeur contre les attributs réellement applicables à la catégorie. */
  private async normaliserAttributs(
    courant: UtilisateurCourant,
    categorieId: string,
    valeurs: ValeurAttributDto[],
  ): Promise<ValeurNormalisee[]> {
    if (valeurs.length === 0) return [];

    const liens = await this.prisma.categorieAttribut.findMany({
      where: { categorieId, attribut: { entrepriseId: courant.entrepriseId } },
      include: { attribut: { include: { options: { orderBy: { ordre: 'asc' } } } } },
    });
    const applicables = new Map<string, AttributApplicable>(
      liens.map((l) => [l.attribut.id, l.attribut]),
    );

    const vus = new Set<string>();
    return valeurs.map((v) => {
      const attribut = applicables.get(v.attributDefinitionId);
      if (!attribut) {
        throw new BadRequestException(
          "Un attribut fourni ne s'applique pas à la catégorie choisie.",
        );
      }
      if (vus.has(attribut.id)) {
        throw new BadRequestException(`« ${attribut.nom} » est renseigné deux fois.`);
      }
      vus.add(attribut.id);
      return normaliserValeur(attribut, v.valeur);
    });
  }

  private async valeursActuelles(produitId: string): Promise<ValeurAttributDto[]> {
    const [valeurs, options] = await Promise.all([
      this.prisma.valeurAttribut.findMany({ where: { produitId } }),
      this.prisma.produitAttributOption.findMany({
        where: { produitId },
        include: { option: { select: { id: true, attributDefinitionId: true } } },
      }),
    ]);

    const resultat: ValeurAttributDto[] = valeurs.map((v) => ({
      attributDefinitionId: v.attributDefinitionId,
      valeur: v.valeurTexte ?? v.valeurNombre?.toString() ?? v.valeurBooleenne,
    }));

    const parAttribut = new Map<string, string[]>();
    for (const o of options) {
      const liste = parAttribut.get(o.option.attributDefinitionId) ?? [];
      liste.push(o.option.id);
      parAttribut.set(o.option.attributDefinitionId, liste);
    }
    for (const [attributDefinitionId, ids] of parAttribut) {
      resultat.push({ attributDefinitionId, valeur: ids.length === 1 ? ids[0] : ids });
    }
    return resultat;
  }

  private async ecrireValeurs(
    tx: Prisma.TransactionClient,
    produitId: string,
    valeurs: ValeurNormalisee[],
  ) {
    for (const v of valeurs) {
      if (v.optionIds.length > 0) {
        await tx.produitAttributOption.createMany({
          data: v.optionIds.map((attributOptionId) => ({ produitId, attributOptionId })),
        });
      } else {
        await tx.valeurAttribut.create({
          data: {
            produitId,
            attributDefinitionId: v.attributDefinitionId,
            valeurTexte: v.valeurTexte ?? null,
            valeurNombre: v.valeurNombre ?? null,
            valeurBooleenne: v.valeurBooleenne ?? null,
          },
        });
      }
    }
  }
}
