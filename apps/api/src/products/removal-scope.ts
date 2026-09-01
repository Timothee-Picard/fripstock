import { readPermissions, type Permission } from '../common/permissions';
import type { CurrentUser } from '../common/types/current-user';
import type { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '../generated/prisma/client';

/** Les deux corvées, et le périmètre de chacune. `null` : rien à montrer. */
export interface RemovalScopes {
  /** Annonces à retirer du site — vendus au comptoir, encore publiés. */
  delist: Prisma.ProductWhereInput | null;
  /** Vêtements à décrocher — vendus par le site, encore sur un portant. */
  pull: Prisma.ProductWhereInput | null;
}

/**
 * Qui voit quoi parmi les retraits à faire — la règle, à un seul endroit.
 *
 * Les deux corvées n'obéissent pas au même périmètre, et c'est délibéré :
 *
 * - **Retirer une annonce** est un travail de site. `online.manage` est un
 *   droit d'entreprise — il n'y a qu'un site — et il porte sur **tous** les
 *   produits, quelle que soit la boutique qui détient l'article. Le restreindre
 *   laisserait des annonces vendues en ligne sans personne pour les ôter.
 * - **Décrocher un vêtement** demande d'aller dans le rayon. Il faut donc, sur
 *   cette boutique-là, le droit d'en voir les produits (`products.view`) en
 *   plus de celui d'agir dessus (`products.manage`).
 *
 * `products.view` ne se déduit surtout pas de l'existence d'une ligne
 * `ShopAccess` : les droits d'entreprise y sont recopiés sur toutes les
 * boutiques, donc une ligne existe partout dès qu'on gère le catalogue.
 */
export async function removalScopes(
  prisma: PrismaService,
  currentUser: CurrentUser,
  shopId?: string,
): Promise<RemovalScopes> {
  const partout: Prisma.ProductWhereInput = shopId ? { shopId } : {};
  if (currentUser.isManager) return { delist: partout, pull: partout };

  const accesses = await prisma.shopAccess.findMany({
    where: { userId: currentUser.userId, shop: { companyId: currentUser.companyId } },
    select: { shopId: true, permissions: true },
  });
  const detenues = accesses.map((a) => ({
    shopId: a.shopId,
    droits: readPermissions(a.permissions),
  }));

  const surLesBoutiques = (...requis: Permission[]): Prisma.ProductWhereInput | null => {
    const ids = detenues
      .filter((a) => requis.every((p) => a.droits[p] === true))
      .map((a) => a.shopId);
    if (ids.length === 0) return null;
    if (shopId) return ids.includes(shopId) ? { shopId } : null;
    // Le stock central n'est à aucune boutique : il suit la même règle que
    // partout ailleurs, détenir le droit quelque part suffit.
    return { OR: [{ shopId: null }, { shopId: { in: ids } }] };
  };

  const gereLeSite = detenues.some((a) => a.droits['online.manage'] === true);

  return {
    delist: gereLeSite ? partout : null,
    pull: surLesBoutiques('products.manage', 'products.view'),
  };
}
