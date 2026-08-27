'use client';

import { useMemo, useState } from 'react';
import {
  AttributeCell,
  attributeColumns,
  attributesByCategory,
  CELL,
} from '@/components/attribute-columns';
import { flattenTree, type AttributeDefinition, type CategoryTree } from '@/lib/types';

/**
 * Saisie des articles déposés, une ligne par article.
 *
 * Les cellules sont **non contrôlées** : leur valeur part directement dans le
 * `FormData` sous le nom `line:<id>:<champ>`. Taper dans une case ne provoque
 * donc aucun rendu, ce qui compte sur un dépôt de trente articles. Seul le
 * choix d'une catégorie remonte dans l'état, parce qu'il décide des colonnes
 * d'attributs affichées.
 *
 * Les colonnes d'attributs sont l'union de ceux qu'appellent les catégories
 * choisies dans le tableau. Une cellule dont l'attribut ne s'applique pas à la
 * catégorie de sa ligne est neutralisée plutôt que masquée : la grille reste
 * lisible, comme dans un tableur.
 */

/** Colonnes facultatives, repliées tant qu'on ne les demande pas. */
const EXTRA_COLUMNS = [
  { key: 'description', label: 'Description' },
  { key: 'internalNote', label: 'Commentaire' },
] as const;

let compteur = 0;
function nextId(): string {
  compteur += 1;
  return `l${compteur}`;
}

interface Line {
  id: string;
  /** Seule donnée gardée en état : elle commande les colonnes d'attributs. */
  categoryId: string;
}

export function ContractLines({
  tree,
  attributes,
}: {
  tree: CategoryTree[];
  /** Tous les attributs de l'entreprise, avec les catégories qu'ils servent. */
  attributes: AttributeDefinition[];
}) {
  const [lines, setLines] = useState<Line[]>(() => [
    { id: nextId(), categoryId: '' },
    { id: nextId(), categoryId: '' },
    { id: nextId(), categoryId: '' },
  ]);
  const [extra, setExtra] = useState(false);

  const categories = useMemo(() => flattenTree(tree), [tree]);

  const parCategorie = useMemo(() => attributesByCategory(attributes), [attributes]);
  const colonnes = useMemo(
    () =>
      attributeColumns(
        attributes,
        parCategorie,
        lines.map((l) => l.categoryId),
      ),
    [lines, attributes, parCategorie],
  );

  const remplies = lines.length;

  function setCategory(id: string, categoryId: string) {
    setLines((current) => {
      const next = current.map((l) => (l.id === id ? { ...l, categoryId } : l));
      // Une ligne vide reste toujours disponible en bas du tableau.
      if (next.at(-1)?.categoryId) next.push({ id: nextId(), categoryId });
      return next;
    });
  }

  function addLine() {
    // La nouvelle ligne reprend la dernière catégorie renseignée : un déposant
    // apporte rarement trente articles de familles différentes, et la dernière
    // ligne du tableau est justement celle qu'on vient de laisser vide.
    setLines((current) => {
      const last = [...current].reverse().find((l) => l.categoryId)?.categoryId ?? '';
      return [...current, { id: nextId(), categoryId: last }];
    });
  }

  function removeLine(id: string) {
    setLines((current) => (current.length > 1 ? current.filter((l) => l.id !== id) : current));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-slate-900">Articles déposés</h2>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={extra}
            onChange={(e) => setExtra(e.target.checked)}
            className="size-4 rounded border-slate-400 accent-slate-900"
          />
          Description et commentaire
        </label>
      </div>

      <p className="text-sm text-slate-600">
        Une ligne par article. Les colonnes d&apos;attributs apparaissent selon les catégories
        choisies ; une cellule grisée ne s&apos;applique pas à la catégorie de sa ligne. Une ligne
        sans nom est ignorée.
      </p>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-max border-collapse bg-white text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left">
              <th className="w-8 px-2 py-2 text-xs font-medium text-slate-600">#</th>
              <th className="min-w-48 px-2 py-2 text-xs font-medium text-slate-700">Nom</th>
              <th className="min-w-28 px-2 py-2 text-xs font-medium text-slate-700">Référence</th>
              <th className="min-w-40 px-2 py-2 text-xs font-medium text-slate-700">Catégorie</th>
              <th className="min-w-24 px-2 py-2 text-xs font-medium text-slate-700">Prix (€)</th>
              <th className="min-w-20 px-2 py-2 text-xs font-medium text-slate-700">Qté</th>
              {colonnes.map((a) => (
                <th key={a.id} className="min-w-36 px-2 py-2 text-xs font-medium text-slate-700">
                  {a.name}
                </th>
              ))}
              {extra
                ? EXTRA_COLUMNS.map((c) => (
                    <th
                      key={c.key}
                      className="min-w-48 px-2 py-2 text-xs font-medium text-slate-700"
                    >
                      {c.label}
                    </th>
                  ))
                : null}
              <th className="w-10 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const applicables = new Set(
                (parCategorie.get(line.categoryId) ?? []).map((a) => a.id),
              );
              return (
                <tr key={line.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-2 py-1 text-xs text-slate-500">{index + 1}</td>
                  <input type="hidden" name="lineId" value={line.id} />
                  <td className="p-0">
                    <input
                      name={`line:${line.id}:name`}
                      placeholder="Robe Zara"
                      className={CELL}
                      aria-label={`Nom de l'article ${index + 1}`}
                    />
                  </td>
                  <td className="p-0">
                    <input
                      name={`line:${line.id}:reference`}
                      placeholder="BTR6"
                      className={`${CELL} font-mono text-xs`}
                      aria-label={`Référence de l'article ${index + 1}`}
                    />
                  </td>
                  <td className="p-0">
                    <select
                      name={`line:${line.id}:categoryId`}
                      value={line.categoryId}
                      onChange={(e) => setCategory(line.id, e.target.value)}
                      className={CELL}
                      aria-label={`Catégorie de l'article ${index + 1}`}
                    >
                      <option value="">—</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-0">
                    <input
                      name={`line:${line.id}:salePrice`}
                      inputMode="decimal"
                      placeholder="15,00"
                      className={`${CELL} text-right`}
                      aria-label={`Prix de vente de l'article ${index + 1}`}
                    />
                  </td>
                  <td className="p-0">
                    <input
                      name={`line:${line.id}:quantity`}
                      type="number"
                      min={1}
                      placeholder="1"
                      className={`${CELL} text-right`}
                      aria-label={`Quantité de l'article ${index + 1}`}
                    />
                  </td>
                  {colonnes.map((a) => (
                    <td
                      key={a.id}
                      className={applicables.has(a.id) ? 'p-0' : 'bg-slate-50 p-0'}
                      aria-disabled={!applicables.has(a.id)}
                    >
                      {applicables.has(a.id) ? (
                        <AttributeCell attribute={a} name={`line:${line.id}:attr:${a.id}`} />
                      ) : null}
                    </td>
                  ))}
                  {extra
                    ? EXTRA_COLUMNS.map((c) => (
                        <td key={c.key} className="p-0">
                          <input
                            name={`line:${line.id}:${c.key}`}
                            className={CELL}
                            aria-label={`${c.label} de l'article ${index + 1}`}
                          />
                        </td>
                      ))
                    : null}
                  <td className="px-1 py-1 text-center">
                    <button
                      type="button"
                      onClick={() => removeLine(line.id)}
                      disabled={lines.length === 1}
                      title="Retirer cette ligne"
                      aria-label={`Retirer l'article ${index + 1}`}
                      className="rounded px-1.5 py-0.5 text-slate-500 transition hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:text-slate-300"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={addLine}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
      >
        + Ajouter une ligne
      </button>

      <p className="text-xs text-slate-600">
        {remplies} ligne{remplies > 1 ? 's' : ''} dans le tableau. Le prix d&apos;achat
        n&apos;apparaît pas : un article déposé appartient au déposant.
      </p>
    </div>
  );
}
