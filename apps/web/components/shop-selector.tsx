'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ShopIcon } from '@/components/icons';
import { ONLINE_CHANNEL, type ShopAccess } from '@/lib/types';

/**
 * Boutique sur laquelle portent les chiffres du tableau de bord.
 *
 * Il vit dans le tableau de bord et nulle part ailleurs. Posé dans l'en-tête,
 * il promettait de filtrer toute l'application : sur le catalogue il ne faisait
 * rien de visible — la liste des produits a son propre filtre boutique, dans sa
 * barre de filtres — et sur les autres écrans, rien du tout.
 *
 * Le choix vit dans l'URL et non dans un état local : le tableau de bord est
 * rendu côté serveur, il ne peut pas lire une préférence gardée dans le
 * navigateur. En prime la vue devient partageable, et le retour arrière marche.
 *
 * Un sélecteur segmenté plutôt qu'une liste déroulante : les boutiques d'une
 * entreprise se comptent sur les doigts d'une main, donc les montrer toutes
 * coûte moins qu'un menu à ouvrir, et la boutique retenue se lit d'un regard —
 * un onglet clair posé sur une piste grise. La phrase à gauche dit ce qu'il
 * commande — recette, comptoir et statistiques — plutôt que de laisser deviner.
 *
 * Ce que voit un employé se limite à ses propres boutiques : la liste vient de
 * sa session. « Toutes » veut donc dire « toutes les miennes », et l'API
 * applique la même règle plutôt que de faire confiance à l'écran.
 */
export function ShopSelector({
  shops,
  canSeeOnline,
}: {
  shops: ShopAccess[];
  /** La boutique en ligne ne s'affiche qu'à qui la gère ou en voit les chiffres. */
  canSeeOnline: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const actif =
    params.get('channel') === ONLINE_CHANNEL ? ONLINE_CHANNEL : (params.get('shopId') ?? '');

  // Rien à choisir : une seule boutique et pas de vente en ligne. « Toutes »
  // désignerait alors exactement la même chose qu'elle.
  if (shops.length < 2 && !canSeeOnline) return null;

  function choisir(valeur: string) {
    const next = new URLSearchParams(params.toString());
    // Les deux ne coexistent pas : on regarde un endroit à la fois.
    next.delete('shopId');
    next.delete('channel');
    if (valeur === ONLINE_CHANNEL) next.set('channel', ONLINE_CHANNEL);
    else if (valeur) next.set('shopId', valeur);
    const query = next.toString();
    // `scroll: false` : ces contrôles vivent au milieu de la page, et remonter
    // en haut à chaque clic oblige à redescendre pour voir le résultat.
    router.push(query ? `/dashboard?${query}` : '/dashboard', { scroll: false });
  }

  const choix = [
    { id: '', name: 'Tout' },
    ...shops.map((b) => ({ id: b.shopId, name: b.name })),
    // En dernier, après les boutiques physiques : c'est un point de vente de
    // plus, pas une catégorie à part.
    ...(canSeeOnline ? [{ id: ONLINE_CHANNEL, name: 'En ligne' }] : []),
  ];

  return (
    <section className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border border-slate-200 bg-white px-5 py-4">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 text-slate-500">
          <ShopIcon />
        </span>
        <div>
          <h2 className="text-sm font-medium text-slate-900">Boutique</h2>
          <p className="mt-0.5 text-xs text-slate-600">
            Recette du jour, vente rapide, statistiques et retraits à faire ne portent que sur ce
            choix.
          </p>
        </div>
      </div>

      {/* Piste grise, onglet clair : l'actif se distingue par son relief plutôt
          que par un aplat sombre, qui à cinq boutiques ferait un damier. */}
      <div
        role="group"
        aria-label="Boutique"
        className="ml-auto flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1"
      >
        {choix.map((c) => {
          const active = c.id === actif;
          return (
            <button
              key={c.id || 'toutes'}
              type="button"
              aria-pressed={active}
              onClick={() => choisir(c.id)}
              className={
                'rounded-md px-3 py-1.5 text-sm transition ' +
                (active
                  ? 'bg-white font-medium text-slate-900 shadow-sm ring-1 ring-slate-900/5'
                  : 'text-slate-600 hover:text-slate-900')
              }
            >
              {c.name}
            </button>
          );
        })}
      </div>
    </section>
  );
}
