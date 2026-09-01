'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import type { ProductSort } from '@/lib/types';

/**
 * En-tête de colonne cliquable.
 *
 * Le tri vit dans l'URL, comme les filtres : la page reste partageable, le
 * retour arrière fonctionne, et l'export recopie le même ordre — on exporte ce
 * qu'on voit, dans l'ordre où on le voit.
 */
export function SortableHeader({ field, children }: { field: ProductSort; children: string }) {
  const router = useRouter();
  const params = useSearchParams();

  const actif = params.get('sort') === field;
  const sens = actif ? (params.get('direction') === 'desc' ? 'desc' : 'asc') : null;

  function trier() {
    const next = new URLSearchParams(params.toString());
    next.set('sort', field);
    // Un second clic sur la même colonne inverse le sens ; changer de colonne
    // repart du croissant, qui est ce qu'on attend d'un premier clic.
    next.set('direction', sens === 'asc' ? 'desc' : 'asc');
    next.delete('page');
    // `scroll: false` : ces contrôles vivent au milieu de la page, et remonter
    // en haut à chaque clic oblige à redescendre pour voir le résultat.
    router.push(`/dashboard/products?${next.toString()}`, { scroll: false });
  }

  return (
    <th
      className="px-3 py-2 font-medium"
      aria-sort={sens === 'asc' ? 'ascending' : sens === 'desc' ? 'descending' : 'none'}
    >
      <button
        type="button"
        onClick={trier}
        className="flex items-center gap-1 uppercase tracking-wide transition hover:text-slate-900"
      >
        {children}
        <span aria-hidden className={actif ? 'text-slate-900' : 'text-slate-400'}>
          {actif ? (sens === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  );
}
