import type { ProductSummary } from '@/lib/types';

/**
 * Un endroit où il faut se rendre, et ce qu'on y a à faire.
 *
 * Le regroupement suit le **geste**, pas le statut : dépublier des annonces se
 * fait d'un seul endroit — le site — alors que décrocher des vêtements se fait
 * boutique par boutique, une tournée à la fois. Mélanger les deux obligerait à
 * relire chaque ligne pour savoir laquelle est pour soi.
 */
export interface RemovalSection {
  /** Stable et utilisable comme clé React. */
  key: string;
  title: string;
  hint: string;
  items: ProductSummary[];
}

const EN_LIGNE = 'online';
const SANS_BOUTIQUE = 'central';

/**
 * Range les retraits par endroit où aller.
 *
 * Le sens se lit sur `status.isOnlineSale`, jamais sur le libellé du statut.
 * Les boutiques sortent dans l'ordre alphabétique, et la boutique en ligne
 * passe en tête : c'est la seule qui se traite sans se déplacer.
 */
export function grouperRetraits(products: ProductSummary[]): RemovalSection[] {
  const parEndroit = new Map<string, RemovalSection>();

  for (const product of products) {
    // Vendu en ligne : le vêtement est resté sur un portant, il faut aller le
    // chercher là où il est. Vendu au comptoir : c'est l'annonce qui traîne,
    // et elle se retire du site.
    const cle = product.status.isOnlineSale ? (product.shop?.id ?? SANS_BOUTIQUE) : EN_LIGNE;

    if (!parEndroit.has(cle)) {
      parEndroit.set(cle, {
        key: cle,
        title:
          cle === EN_LIGNE
            ? 'Boutique en ligne'
            : cle === SANS_BOUTIQUE
              ? 'Stock central'
              : (product.shop?.name ?? 'Boutique'),
        hint:
          cle === EN_LIGNE
            ? 'Vendus au comptoir : leur annonce est encore publiée, il faut la retirer du site.'
            : 'Vendus sur le site : le vêtement est encore là, il faut aller le décrocher.',
        items: [],
      });
    }
    parEndroit.get(cle)!.items.push(product);
  }

  return [...parEndroit.values()].sort((a, b) => {
    if (a.key === EN_LIGNE) return -1;
    if (b.key === EN_LIGNE) return 1;
    return a.title.localeCompare(b.title, 'fr');
  });
}
