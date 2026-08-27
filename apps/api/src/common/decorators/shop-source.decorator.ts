import { SetMetadata } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';

export const SHOP_SOURCE_KEY = 'shopSource';

export type ShopResolver = (
  prisma: PrismaService,
  id: string,
  companyId: string,
) => Promise<string | null | undefined>;

export interface ShopSource {
  /** Nom du paramètre de route qui porte l'identifiant de la ressource. */
  param: string;
  resolver: ShopResolver;
}

/**
 * Déclare que la boutique concernée par la route se déduit d'une ressource
 * ciblée par un paramètre d'URL, et non d'un `shopId` explicite.
 *
 * Cas typique : `PUT /products/:id/status` — la boutique
 * n'est ni dans les params ni dans le body, il faut charger le produit.
 *
 * Le résolveur doit lui-même scoper sa requête à `companyId`, sinon il
 * devient un moyen de sonder les ressources d'une autre entreprise.
 */
export const ShopFromResource = (param: string, resolver: ShopResolver) =>
  SetMetadata(SHOP_SOURCE_KEY, { param, resolver } satisfies ShopSource);
