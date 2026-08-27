'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ShopAccess } from '@/lib/types';

/**
 * Boutique sur laquelle on travaille.
 *
 * Le choix vit dans l'URL et non dans un état local : le tableau de bord est
 * rendu côté serveur, il ne peut pas lire une préférence gardée dans le
 * navigateur. En prime la vue devient partageable, et le retour arrière marche.
 *
 * Ce que voit un employé se limite à ses propres boutiques : la liste vient de
 * sa session. « Toutes » veut donc dire « toutes les miennes », et l'API
 * applique la même règle plutôt que de faire confiance à l'écran.
 */
export function ShopSelector({ shops }: { shops: ShopAccess[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const actif = params.get('shopId') ?? '';

  if (shops.length < 2) return null;

  function choisir(shopId: string) {
    const next = new URLSearchParams(params.toString());
    if (shopId) next.set('shopId', shopId);
    else next.delete('shopId');
    // La pagination d'un écran filtré n'a plus de sens une fois la boutique
    // changée.
    next.delete('page');
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-slate-600">Boutique</span>
      <select
        value={actif}
        onChange={(e) => choisir(e.target.value)}
        className="rounded-md border border-slate-400 bg-white px-2 py-1 text-sm text-slate-900"
      >
        <option value="">Toutes les boutiques</option>
        {shops.map((b) => (
          <option key={b.shopId} value={b.shopId}>
            {b.name}
          </option>
        ))}
      </select>
    </label>
  );
}
