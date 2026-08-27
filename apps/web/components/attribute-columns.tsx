'use client';

import type { AttributeDefinition } from '@/lib/types';

/**
 * Colonnes d'attributs d'une saisie en tableau.
 *
 * Le catalogue déclare, catégorie par catégorie, quels attributs sont
 * pertinents. Dans un tableau où chaque ligne a sa catégorie, les colonnes
 * affichées sont donc l'union de ce qu'appellent les catégories présentes, et
 * une cellule sans objet pour sa ligne est neutralisée plutôt que masquée : la
 * grille reste alignée, comme dans un tableur.
 *
 * Partagé par le dépôt d'un contrat et l'achat en lot, qui saisissent les mêmes
 * produits sous deux angles différents.
 */

/** Classe commune des cellules de saisie, sans bordure interne. */
export const CELL =
  'w-full border-0 bg-transparent px-2 py-1.5 text-sm text-slate-900 outline-none focus:bg-sky-50';

/** Attributs applicables, indexés par catégorie. */
export function attributesByCategory(
  attributes: AttributeDefinition[],
): Map<string, AttributeDefinition[]> {
  const map = new Map<string, AttributeDefinition[]>();
  for (const a of attributes) {
    for (const { categoryId } of a.categories) {
      map.set(categoryId, [...(map.get(categoryId) ?? []), a]);
    }
  }
  return map;
}

/**
 * Colonnes à afficher pour les catégories choisies, dans l'ordre du catalogue —
 * l'ordre des colonnes reste ainsi stable quand on change une catégorie.
 */
export function attributeColumns(
  attributes: AttributeDefinition[],
  byCategory: Map<string, AttributeDefinition[]>,
  categoryIds: string[],
): AttributeDefinition[] {
  const utiles = new Set(categoryIds.flatMap((id) => (byCategory.get(id) ?? []).map((a) => a.id)));
  return attributes.filter((a) => utiles.has(a.id));
}

/** Cellule d'attribut, dans la forme la plus compacte possible pour son type. */
export function AttributeCell({
  attribute,
  name,
}: {
  attribute: AttributeDefinition;
  name: string;
}) {
  if (attribute.type === 'NUMBER') {
    return <input name={name} type="number" step="any" className={`${CELL} text-right`} />;
  }
  if (attribute.type === 'BOOLEAN') {
    return (
      <select name={name} className={CELL} defaultValue="">
        <option value="">—</option>
        <option value="true">Oui</option>
        <option value="false">Non</option>
      </select>
    );
  }
  if (attribute.type === 'SELECT') {
    return (
      <select name={name} className={CELL} defaultValue="">
        <option value="">—</option>
        {attribute.options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.value}
          </option>
        ))}
      </select>
    );
  }
  if (attribute.type === 'MULTISELECT') {
    // Des cases à cocher en ligne plutôt qu'un `select multiple` : le Ctrl-clic
    // ne s'invente pas, et une cellule doit rester lisible d'un coup d'œil.
    return (
      <div className="flex flex-nowrap gap-2 overflow-x-auto px-2 py-1.5">
        {attribute.options.map((o) => (
          <label
            key={o.id}
            className="flex shrink-0 items-center gap-1 text-xs whitespace-nowrap text-slate-700"
          >
            <input
              type="checkbox"
              name={name}
              value={o.id}
              className="size-3.5 rounded border-slate-400 accent-slate-900"
            />
            {o.value}
          </label>
        ))}
      </div>
    );
  }
  return <input name={name} className={CELL} />;
}
