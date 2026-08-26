import { BadRequestException, Injectable } from '@nestjs/common';
import type { UtilisateurCourant } from '../common/types/utilisateur-courant';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { PeriodeDto } from './dto/periode.dto';

const JOURS_PAR_DEFAUT = 30;

function arrondir(valeur: number): number {
  return Math.round(valeur * 100) / 100;
}

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tableau de bord.
   *
   * Tous les agrégats se définissent par les **flags de `Statut`**, jamais par
   * le libellé : le gérant peut renommer ses statuts, et un `nom === 'Vendu'`
   * en dur casserait silencieusement les chiffres.
   *
   * - vendu       → statut `estVente`
   * - stock actif → statut `sortStock = false`
   * - rendu       → statut `bloqueVente`
   */
  async tableauDeBord(courant: UtilisateurCourant, filtres: PeriodeDto) {
    const au = filtres.au ? new Date(filtres.au) : new Date();
    const du = filtres.du
      ? new Date(filtres.du)
      : new Date(au.getTime() - JOURS_PAR_DEFAUT * 86400000);
    if (du > au) throw new BadRequestException('La date de début doit précéder la date de fin.');

    if (filtres.boutiqueId) {
      const boutique = await this.prisma.boutique.count({
        where: { id: filtres.boutiqueId, entrepriseId: courant.entrepriseId },
      });
      if (boutique === 0) {
        throw new BadRequestException("Cette boutique n'appartient pas à votre entreprise.");
      }
    }

    const base: Prisma.ProduitWhereInput = {
      entrepriseId: courant.entrepriseId,
      ...(filtres.boutiqueId ? { boutiqueId: filtres.boutiqueId } : {}),
    };

    const [vendus, stock, depotPeriode] = await Promise.all([
      // Les produits vendus sur la période, avec ce qu'il faut pour le CA et la
      // marge. Le volume est celui des ventes d'une boutique : on agrège en
      // mémoire plutôt que d'empiler cinq requêtes d'agrégation.
      this.prisma.produit.findMany({
        where: { ...base, statut: { estVente: true }, dateVente: { gte: du, lte: au } },
        select: {
          id: true,
          nom: true,
          reference: true,
          prixAchat: true,
          prixVendu: true,
          commissionAppliquee: true,
          typeVente: true,
          dateVente: true,
          categorie: { select: { id: true, nom: true } },
        },
      }),
      this.prisma.produit.findMany({
        where: base,
        select: {
          quantite: true,
          prixVente: true,
          statut: { select: { id: true, nom: true, couleur: true, sortStock: true } },
        },
      }),
      // Taux de retour : parmi les articles en dépôt-vente créés sur la période,
      // ceux qui ont fini dans un statut bloquant (rendu, retiré).
      this.prisma.produit.findMany({
        where: { ...base, typeVente: 'DEPOT_VENTE', createdAt: { gte: du, lte: au } },
        select: { statut: { select: { bloqueVente: true } } },
      }),
    ]);

    // --- Ventes -------------------------------------------------------------
    const chiffreAffaires = arrondir(
      vendus.reduce((total, p) => total + Number(p.prixVendu ?? 0), 0),
    );

    // Ce que la boutique garde réellement : sa marge en achat-revente, sa
    // commission en dépôt-vente — où l'essentiel du prix revient au déposant.
    const marge = arrondir(
      vendus.reduce((total, p) => {
        const encaisse = Number(p.prixVendu ?? 0);
        if (p.typeVente === 'DEPOT_VENTE') {
          return total + (encaisse * Number(p.commissionAppliquee ?? 0)) / 100;
        }
        return total + (encaisse - Number(p.prixAchat ?? 0));
      }, 0),
    );

    // --- Ventes par jour, pour la courbe ------------------------------------
    const parJour = new Map<string, { ca: number; nombre: number }>();
    for (const p of vendus) {
      const jour = (p.dateVente ?? du).toISOString().slice(0, 10);
      const courant = parJour.get(jour) ?? { ca: 0, nombre: 0 };
      courant.ca += Number(p.prixVendu ?? 0);
      courant.nombre += 1;
      parJour.set(jour, courant);
    }

    // --- Classements --------------------------------------------------------
    const parCategorie = new Map<string, { id: string; nom: string; ca: number; nombre: number }>();
    for (const p of vendus) {
      const entree = parCategorie.get(p.categorie.id) ?? {
        id: p.categorie.id,
        nom: p.categorie.nom,
        ca: 0,
        nombre: 0,
      };
      entree.ca += Number(p.prixVendu ?? 0);
      entree.nombre += 1;
      parCategorie.set(p.categorie.id, entree);
    }

    // --- Stock --------------------------------------------------------------
    const parStatut = new Map<
      string,
      {
        id: string;
        nom: string;
        couleur: string;
        sortStock: boolean;
        nombre: number;
        valeur: number;
      }
    >();
    for (const p of stock) {
      const entree = parStatut.get(p.statut.id) ?? { ...p.statut, nombre: 0, valeur: 0 };
      entree.nombre += p.quantite;
      entree.valeur += Number(p.prixVente ?? 0) * p.quantite;
      parStatut.set(p.statut.id, entree);
    }
    const statuts = [...parStatut.values()].map((s) => ({ ...s, valeur: arrondir(s.valeur) }));
    const actifs = statuts.filter((s) => !s.sortStock);

    // --- Retours ------------------------------------------------------------
    const rendus = depotPeriode.filter((p) => p.statut.bloqueVente).length;

    return {
      periode: { du: du.toISOString(), au: au.toISOString() },
      ventes: {
        nombre: vendus.length,
        chiffreAffaires,
        marge,
        panierMoyen: vendus.length > 0 ? arrondir(chiffreAffaires / vendus.length) : 0,
      },
      parJour: [...parJour.entries()]
        .map(([jour, v]) => ({ jour, ca: arrondir(v.ca), nombre: v.nombre }))
        .sort((a, b) => a.jour.localeCompare(b.jour)),
      topCategories: [...parCategorie.values()]
        .map((c) => ({ ...c, ca: arrondir(c.ca) }))
        .sort((a, b) => b.ca - a.ca)
        .slice(0, 5),
      topProduits: vendus
        .map((p) => ({
          id: p.id,
          nom: p.nom,
          reference: p.reference,
          ca: arrondir(Number(p.prixVendu ?? 0)),
        }))
        .sort((a, b) => b.ca - a.ca)
        .slice(0, 5),
      stock: {
        parStatut: statuts.sort((a, b) => b.nombre - a.nombre),
        actifs: actifs.reduce((t, s) => t + s.nombre, 0),
        valeurActive: arrondir(actifs.reduce((t, s) => t + s.valeur, 0)),
      },
      retours: {
        depotSurPeriode: depotPeriode.length,
        rendus,
        taux: depotPeriode.length > 0 ? arrondir((rendus / depotPeriode.length) * 100) : 0,
      },
    };
  }
}
