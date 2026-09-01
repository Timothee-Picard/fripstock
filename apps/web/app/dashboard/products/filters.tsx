'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
  SALE_TYPE_LABELS,
  type Shop,
  type Category,
  type Depositor,
  type Status,
} from '@/lib/types';

/**
 * Filtres de la liste. Ils vivent dans l'URL et non dans un état React : la
 * page reste partageable, le retour arrière fonctionne, et le rendu se fait
 * côté serveur.
 */
export function Filters({
  shops,
  categories,
  statuses,
  depositors,
}: {
  shops: Shop[];
  categories: Category[];
  statuses: Status[];
  /** Vide si l'utilisateur n'a pas le droit de consulter les déposants. */
  depositors: Depositor[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  // `scroll: false` sur chaque navigation : la barre de filtres est en haut,
  // mais la liste qu'elle commande est en dessous — remonter à chaque clic
  // ferait perdre sa place à qui parcourt une longue liste.
  function apply(field: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(field, value);
    else next.delete(field);
    next.delete('page');
    router.push(`/dashboard/products?${next.toString()}`, { scroll: false });
  }

  const css = 'rounded-md border border-slate-400 bg-white px-2 py-1.5 text-sm text-slate-900';

  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        apply('search', new FormData(e.currentTarget).get('search') as string);
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-700">Recherche</span>
        <input
          name="search"
          defaultValue={params.get('search') ?? ''}
          placeholder="Nom, référence…"
          className={`${css} placeholder:text-slate-500`}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-700">Boutique</span>
        <select
          value={params.get('unassigned') === 'true' ? '__central' : (params.get('shopId') ?? '')}
          onChange={(e) => {
            const next = new URLSearchParams(params.toString());
            next.delete('shopId');
            next.delete('unassigned');
            next.delete('page');
            if (e.target.value === '__central') next.set('unassigned', 'true');
            else if (e.target.value) next.set('shopId', e.target.value);
            router.push(`/dashboard/products?${next.toString()}`, { scroll: false });
          }}
          className={css}
        >
          <option value="">Toutes</option>
          <option value="__central">Stock central (non assignés)</option>
          {shops.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-700">Catégorie</span>
        <select
          value={params.get('categoryId') ?? ''}
          onChange={(e) => apply('categoryId', e.target.value)}
          className={css}
        >
          <option value="">Toutes</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-700">Statut</span>
        <select
          value={params.get('statusId') ?? ''}
          onChange={(e) => apply('statusId', e.target.value)}
          className={css}
        >
          <option value="">Tous</option>
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      {depositors.length > 0 ? (
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-700">Déposant</span>
          <select
            value={params.get('depositorId') ?? ''}
            onChange={(e) => apply('depositorId', e.target.value)}
            className={css}
          >
            <option value="">Tous</option>
            {depositors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.lastName} {d.firstName}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-700">En ligne</span>
        <select
          value={params.get('isOnline') ?? ''}
          onChange={(e) => apply('isOnline', e.target.value)}
          className={css}
        >
          <option value="">Tous</option>
          <option value="true">Sur le site</option>
          <option value="false">Pas sur le site</option>
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-700">Type de vente</span>
        <select
          value={params.get('saleType') ?? ''}
          onChange={(e) => apply('saleType', e.target.value)}
          className={css}
        >
          <option value="">Tous</option>
          {Object.entries(SALE_TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>

      {params.toString() ? (
        <button
          type="button"
          onClick={() => router.push('/dashboard/products', { scroll: false })}
          className="pb-1.5 text-sm text-slate-600 underline underline-offset-2 hover:text-slate-900"
        >
          Réinitialiser
        </button>
      ) : null}
    </form>
  );
}
