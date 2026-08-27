'use client';

import { useMemo, useState } from 'react';
import {
  AttributeCell,
  attributeColumns,
  attributesByCategory,
  CELL,
} from '@/components/attribute-columns';
import { splitCost } from '@/lib/lot-split';
import { euros, flattenTree, type AttributeDefinition, type CategoryTree } from '@/lib/types';

/**
 * Saisie d'un achat en lot, une ligne par modèle d'article.
 *
 * Un lot n'a qu'un prix global : chaque article reçoit sa part au prorata de
 * son prix de vente, et la colonne « Achat » montre le résultat avant de
 * valider. Le partage qui fait foi reste celui de l'API — cet aperçu n'est
 * qu'un confort, mais il évite de découvrir après coup qu'un article a été
 * chargé de tout le lot.
 *
 * Prix de vente et nombre d'exemplaires sont contrôlés, parce qu'ils commandent
 * ce partage ; les autres cellules restent non contrôlées, pour ne pas rendre à
 * chaque frappe.
 */

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
  categoryId: string;
  /**
   * Contrôlés, tous les trois : ils décident de la répartition du prix payé et
   * de ce qui part réellement à l'API. Le nom en fait partie parce que c'est
   * lui qui distingue une ligne saisie de la ligne vide gardée en bas — sans
   * quoi celle-ci prendrait une part du lot.
   */
  name: string;
  salePrice: string;
  count: string;
}

function nombre(valeur: string): number {
  const n = Number(valeur.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function exemplaires(valeur: string): number {
  const n = Math.floor(nombre(valeur));
  return n > 0 ? n : 1;
}

export function LotLines({
  tree,
  attributes,
  totalPurchasePrice,
}: {
  tree: CategoryTree[];
  attributes: AttributeDefinition[];
  /** Prix payé pour le lot, saisi au-dessus du tableau. */
  totalPurchasePrice: number;
}) {
  const [lines, setLines] = useState<Line[]>(() => [
    { id: nextId(), categoryId: '', name: '', salePrice: '', count: '' },
    { id: nextId(), categoryId: '', name: '', salePrice: '', count: '' },
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

  // La répartition porte sur les articles, pas sur les lignes : quatre t-shirts
  // se partagent quatre parts, pas une. Et seules les lignes nommées comptent,
  // parce que ce sont exactement celles que le serveur retiendra.
  const repartition = useMemo(() => {
    const actives = lines.map((l) => l.name.trim() !== '');
    // Nombre d'articles par ligne, puis leur position dans la répartition :
    // une somme de préfixes, plutôt qu'un curseur qu'on ferait avancer pendant
    // le rendu.
    const counts = lines.map((l, i) => (actives[i] ? exemplaires(l.count) : 0));
    const debuts = counts.map((_, i) => counts.slice(0, i).reduce((t, n) => t + n, 0));

    const poids = lines.flatMap((l, i) =>
      Array.from({ length: counts[i] }, () => nombre(l.salePrice)),
    );
    const parts = splitCost(totalPurchasePrice, poids);

    return lines.map((_, i) => {
      if (!actives[i]) return { active: false, unitaire: 0, ligne: 0, exemplaires: 0 };
      const miennes = parts.slice(debuts[i], debuts[i] + counts[i]);
      return {
        active: true,
        unitaire: miennes[0] ?? 0,
        ligne: Math.round(miennes.reduce((t, p) => t + p, 0) * 100) / 100,
        exemplaires: counts[i],
      };
    });
  }, [lines, totalPurchasePrice]);

  const totalArticles = repartition.reduce((t, r) => t + r.exemplaires, 0);
  const totalVente =
    Math.round(
      lines.reduce(
        (t, l, i) => (repartition[i].active ? t + nombre(l.salePrice) * exemplaires(l.count) : t),
        0,
      ) * 100,
    ) / 100;

  function patch(id: string, champ: 'categoryId' | 'name' | 'salePrice' | 'count', valeur: string) {
    setLines((current) => {
      const next = current.map((l) => (l.id === id ? { ...l, [champ]: valeur } : l));
      // Une ligne vide reste disponible en bas dès que la dernière sert.
      const derniere = next.at(-1);
      if (derniere && (derniere.name || derniere.categoryId || derniere.salePrice)) {
        next.push({
          id: nextId(),
          categoryId: derniere.categoryId,
          name: '',
          salePrice: '',
          count: '',
        });
      }
      return next;
    });
  }

  function addLine() {
    setLines((current) => {
      const last = [...current].reverse().find((l) => l.categoryId)?.categoryId ?? '';
      return [...current, { id: nextId(), categoryId: last, name: '', salePrice: '', count: '' }];
    });
  }

  function removeLine(id: string) {
    setLines((current) => (current.length > 1 ? current.filter((l) => l.id !== id) : current));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-slate-900">Articles du lot</h2>
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
        Une ligne par modèle. « Nombre » crée autant de produits distincts, chacun vendable
        séparément — quatre t-shirts identiques donnent quatre articles, pas un article en quatre
        exemplaires. Le prix d&apos;achat se calcule tout seul, au prorata du prix de vente.
      </p>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-max border-collapse bg-white text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left">
              <th className="w-8 px-2 py-2 text-xs font-medium text-slate-600">#</th>
              <th className="min-w-48 px-2 py-2 text-xs font-medium text-slate-700">Nom</th>
              <th className="min-w-28 px-2 py-2 text-xs font-medium text-slate-700">Référence</th>
              <th className="min-w-40 px-2 py-2 text-xs font-medium text-slate-700">Catégorie</th>
              <th className="min-w-20 px-2 py-2 text-xs font-medium text-slate-700">Nombre</th>
              <th className="min-w-28 px-2 py-2 text-xs font-medium text-slate-700">Vente (€)</th>
              <th className="min-w-32 bg-slate-100 px-2 py-2 text-xs font-medium text-slate-700">
                Achat (€)
              </th>
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
              const part = repartition[index];
              return (
                <tr key={line.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-2 py-1 text-xs text-slate-500">{index + 1}</td>
                  <input type="hidden" name="lineId" value={line.id} />
                  <td className="p-0">
                    <input
                      name={`line:${line.id}:name`}
                      placeholder="T-shirt uni"
                      value={line.name}
                      onChange={(e) => patch(line.id, 'name', e.target.value)}
                      className={CELL}
                      aria-label={`Nom de la ligne ${index + 1}`}
                    />
                  </td>
                  <td className="p-0">
                    <input
                      name={`line:${line.id}:reference`}
                      placeholder="BTR6"
                      className={`${CELL} font-mono text-xs`}
                      aria-label={`Référence de la ligne ${index + 1}`}
                    />
                  </td>
                  <td className="p-0">
                    <select
                      name={`line:${line.id}:categoryId`}
                      value={line.categoryId}
                      onChange={(e) => patch(line.id, 'categoryId', e.target.value)}
                      className={CELL}
                      aria-label={`Catégorie de la ligne ${index + 1}`}
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
                      name={`line:${line.id}:count`}
                      type="number"
                      min={1}
                      placeholder="1"
                      value={line.count}
                      onChange={(e) => patch(line.id, 'count', e.target.value)}
                      className={`${CELL} text-right`}
                      aria-label={`Nombre d'exemplaires de la ligne ${index + 1}`}
                    />
                  </td>
                  <td className="p-0">
                    <input
                      name={`line:${line.id}:salePrice`}
                      inputMode="decimal"
                      placeholder="10,00"
                      value={line.salePrice}
                      onChange={(e) => patch(line.id, 'salePrice', e.target.value)}
                      className={`${CELL} text-right`}
                      aria-label={`Prix de vente de la ligne ${index + 1}`}
                    />
                  </td>
                  <td
                    className="bg-slate-50 px-2 py-1.5 text-right text-sm text-slate-700"
                    aria-label={`Prix d'achat calculé de la ligne ${index + 1}`}
                  >
                    {part.active ? (
                      <>
                        <span className="font-medium">{euros(String(part.unitaire))}</span>
                        {part.exemplaires > 1 ? (
                          <span className="ml-1 text-xs text-slate-500">
                            ×{part.exemplaires} = {euros(String(part.ligne))}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
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
                            aria-label={`${c.label} de la ligne ${index + 1}`}
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
                      aria-label={`Retirer la ligne ${index + 1}`}
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={addLine}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
        >
          + Ajouter une ligne
        </button>
        {/* Région vivante : le récapitulatif change à chaque frappe, un lecteur
            d'écran doit pouvoir l'entendre sans quitter la cellule courante. */}
        <p role="status" className="text-sm text-slate-700">
          <strong>{totalArticles}</strong> article{totalArticles > 1 ? 's' : ''} · achat{' '}
          <strong>{euros(String(totalPurchasePrice))}</strong> · vente attendue{' '}
          <strong>{euros(String(totalVente))}</strong>
          {totalVente > 0 ? (
            <span className="text-slate-600">
              {' '}
              · marge {Math.round(((totalVente - totalPurchasePrice) / totalVente) * 100)} %
            </span>
          ) : null}
        </p>
      </div>
    </div>
  );
}
