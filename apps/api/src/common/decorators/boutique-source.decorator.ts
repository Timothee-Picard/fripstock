import { SetMetadata } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';

export const CLE_SOURCE_BOUTIQUE = 'sourceBoutique';

export type ResolveurBoutique = (
  prisma: PrismaService,
  id: string,
  entrepriseId: string,
) => Promise<string | null | undefined>;

export interface SourceBoutique {
  /** Nom du paramètre de route qui porte l'identifiant de la ressource. */
  param: string;
  resolveur: ResolveurBoutique;
}

/**
 * Déclare que la boutique concernée par la route se déduit d'une ressource
 * ciblée par un paramètre d'URL, et non d'un `boutiqueId` explicite.
 *
 * Cas typique à partir de l'étape 5 : `PUT /produits/:id/statut` — la boutique
 * n'est ni dans les params ni dans le body, il faut charger le produit.
 *
 * Le résolveur doit lui-même scoper sa requête à `entrepriseId`, sinon il
 * devient un moyen de sonder les ressources d'une autre entreprise.
 */
export const BoutiqueDepuisRessource = (param: string, resolveur: ResolveurBoutique) =>
  SetMetadata(CLE_SOURCE_BOUTIQUE, { param, resolveur } satisfies SourceBoutique);
