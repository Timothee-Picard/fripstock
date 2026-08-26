import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { UtilisateurCourant } from '../common/types/utilisateur-courant';
import { PrismaService } from '../prisma/prisma.service';
import type { CreerClientDto } from './dto/creer-client.dto';
import type { ModifierClientDto } from './dto/modifier-client.dto';

/** Deux décimales, en nombre : les montants transitent en JSON. */
function arrondir(valeur: number): number {
  return Math.round(valeur * 100) / 100;
}

@Injectable()
export class ClientsDeposantsService {
  constructor(private readonly prisma: PrismaService) {}

  lister(courant: UtilisateurCourant) {
    return this.prisma.client.findMany({
      where: { entrepriseId: courant.entrepriseId },
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
      include: { _count: { select: { contrats: true } } },
    });
  }

  async detail(courant: UtilisateurCourant, id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, entrepriseId: courant.entrepriseId },
      include: {
        contrats: {
          orderBy: { dateFin: 'desc' },
          include: { _count: { select: { produits: true } } },
        },
      },
    });
    if (!client) throw new NotFoundException('Client déposant introuvable.');
    return client;
  }

  creer(courant: UtilisateurCourant, dto: CreerClientDto) {
    return this.prisma.client.create({
      data: {
        ...dto,
        entrepriseId: courant.entrepriseId,
        commissionDefaut: dto.commissionDefaut ?? 0,
      },
    });
  }

  async modifier(courant: UtilisateurCourant, id: string, dto: ModifierClientDto) {
    await this.exiger(courant, id);
    return this.prisma.client.update({ where: { id }, data: dto });
  }

  async supprimer(courant: UtilisateurCourant, id: string) {
    await this.exiger(courant, id);
    const contrats = await this.prisma.contratDepot.count({ where: { clientId: id } });
    if (contrats > 0) {
      throw new ConflictException(
        `Ce déposant a ${contrats} contrat(s). Clôturez-les et détachez ses produits d'abord.`,
      );
    }
    await this.prisma.client.delete({ where: { id } });
    return { supprime: true };
  }

  /** Produits déposés par ce client, tous contrats confondus. */
  async produits(courant: UtilisateurCourant, id: string) {
    await this.exiger(courant, id);
    return this.prisma.produit.findMany({
      // Pas de clientId sur Produit : on passe par le contrat, lui-même scopé
      // par son client. Voir la règle de scoping de CLAUDE.md.
      where: { contratDepot: { clientId: id, client: { entrepriseId: courant.entrepriseId } } },
      orderBy: { createdAt: 'desc' },
      include: {
        statut: true,
        boutique: { select: { id: true, nom: true } },
        contratDepot: { select: { id: true, dateDebut: true, dateFin: true, statut: true } },
      },
    });
  }

  /**
   * Relevé du déposant : ce qui a été vendu, ce qui lui revient, ce qui a été
   * réglé.
   *
   * Deux règles y sont capitales, et toutes deux viennent de CLAUDE.md :
   *
   * - la commission est la **part que garde la boutique**, donc
   *   `partDeposant = prixVendu × (1 − commission / 100)` ;
   * - on lit `Produit.commissionAppliquee`, figée à la vente, et jamais celle du
   *   contrat : sinon modifier un contrat réécrirait des relevés déjà réglés.
   *
   * Un produit compte comme vendu si son statut porte `estVente` — jamais sur
   * son libellé, que le gérant peut renommer.
   */
  async releve(courant: UtilisateurCourant, id: string) {
    const client = await this.exiger(courant, id);

    const produits = await this.prisma.produit.findMany({
      where: {
        contratDepot: { clientId: id, client: { entrepriseId: courant.entrepriseId } },
        statut: { estVente: true },
      },
      orderBy: { dateVente: 'desc' },
      include: { statut: { select: { id: true, nom: true, couleur: true } } },
    });

    const lignes = produits.map((p) => {
      const prixVendu = Number(p.prixVendu ?? 0);
      const commission = Number(p.commissionAppliquee ?? 0);
      const partBoutique = arrondir((prixVendu * commission) / 100);
      return {
        produitId: p.id,
        reference: p.reference,
        nom: p.nom,
        dateVente: p.dateVente,
        statut: p.statut,
        prixVendu: arrondir(prixVendu),
        commission: arrondir(commission),
        partBoutique,
        partDeposant: arrondir(prixVendu - partBoutique),
        deposantPaye: p.deposantPaye === true,
      };
    });

    const somme = (
      filtre: (l: (typeof lignes)[number]) => boolean,
      champ: 'partDeposant' | 'prixVendu',
    ) => arrondir(lignes.filter(filtre).reduce((total, l) => total + l[champ], 0));

    return {
      client: {
        id: client.id,
        nom: client.nom,
        prenom: client.prenom,
        iban: client.iban,
        commissionDefaut: client.commissionDefaut,
      },
      lignes,
      totaux: {
        produitsVendus: lignes.length,
        totalVendu: somme(() => true, 'prixVendu'),
        partBoutique: arrondir(lignes.reduce((t, l) => t + l.partBoutique, 0)),
        partDeposant: somme(() => true, 'partDeposant'),
        dejaPaye: somme((l) => l.deposantPaye, 'partDeposant'),
        restantDu: somme((l) => !l.deposantPaye, 'partDeposant'),
      },
    };
  }

  private async exiger(courant: UtilisateurCourant, id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, entrepriseId: courant.entrepriseId },
    });
    if (!client) throw new NotFoundException('Client déposant introuvable.');
    return client;
  }
}
