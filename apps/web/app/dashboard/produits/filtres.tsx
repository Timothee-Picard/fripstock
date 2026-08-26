'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { LIBELLES_TYPE_VENTE, type Boutique, type Categorie, type Statut } from '@/lib/types';

/**
 * Filtres de la liste. Ils vivent dans l'URL et non dans un état React : la
 * page reste partageable, le retour arrière fonctionne, et le rendu se fait
 * côté serveur.
 */
export function Filtres({
  boutiques,
  categories,
  statuts,
}: {
  boutiques: Boutique[];
  categories: Categorie[];
  statuts: Statut[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  function appliquer(champ: string, valeur: string) {
    const suivants = new URLSearchParams(params.toString());
    if (valeur) suivants.set(champ, valeur);
    else suivants.delete(champ);
    suivants.delete('page');
    router.push(`/dashboard/produits?${suivants.toString()}`);
  }

  const classe = 'rounded-md border border-slate-400 bg-white px-2 py-1.5 text-sm text-slate-900';

  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        appliquer('recherche', new FormData(e.currentTarget).get('recherche') as string);
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-700">Recherche</span>
        <input
          name="recherche"
          defaultValue={params.get('recherche') ?? ''}
          placeholder="Nom, référence…"
          className={`${classe} placeholder:text-slate-500`}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-700">Boutique</span>
        <select
          value={
            params.get('nonAssigne') === 'true' ? '__central' : (params.get('boutiqueId') ?? '')
          }
          onChange={(e) => {
            const suivants = new URLSearchParams(params.toString());
            suivants.delete('boutiqueId');
            suivants.delete('nonAssigne');
            suivants.delete('page');
            if (e.target.value === '__central') suivants.set('nonAssigne', 'true');
            else if (e.target.value) suivants.set('boutiqueId', e.target.value);
            router.push(`/dashboard/produits?${suivants.toString()}`);
          }}
          className={classe}
        >
          <option value="">Toutes</option>
          <option value="__central">Stock central (non assignés)</option>
          {boutiques.map((b) => (
            <option key={b.id} value={b.id}>
              {b.nom}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-700">Catégorie</span>
        <select
          value={params.get('categorieId') ?? ''}
          onChange={(e) => appliquer('categorieId', e.target.value)}
          className={classe}
        >
          <option value="">Toutes</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nom}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-700">Statut</span>
        <select
          value={params.get('statutId') ?? ''}
          onChange={(e) => appliquer('statutId', e.target.value)}
          className={classe}
        >
          <option value="">Tous</option>
          {statuts.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nom}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-700">Type de vente</span>
        <select
          value={params.get('typeVente') ?? ''}
          onChange={(e) => appliquer('typeVente', e.target.value)}
          className={classe}
        >
          <option value="">Tous</option>
          {Object.entries(LIBELLES_TYPE_VENTE).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>

      {params.toString() ? (
        <button
          type="button"
          onClick={() => router.push('/dashboard/produits')}
          className="pb-1.5 text-sm text-slate-600 underline underline-offset-2 hover:text-slate-900"
        >
          Réinitialiser
        </button>
      ) : null}
    </form>
  );
}
