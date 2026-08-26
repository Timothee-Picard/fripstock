'use client';

import { useEffect, useState } from 'react';
import type { AttributeDefinition } from '@/lib/types';

/**
 * Champs d'attributs chargés d'après la catégorie choisie.
 *
 * Le catalogue déclare, catégorie par catégorie, quels attributs sont
 * pertinents : on ne demande donc pas la taille d'un sac. L'API applique la
 * même règle et refuse un attribut inapplicable, l'affichage n'est qu'un
 * confort.
 */
export function DynamicAttributes({
  categoryId,
  values = {},
}: {
  categoryId: string;
  /** Valeurs déjà saisies, par identifiant d'attribut (édition d'un produit). */
  values?: Record<string, string[]>;
}) {
  // On mémorise la catégorie chargée avec ses attributs : comparer les deux en
  // rendu suffit à savoir si l'affichage est à jour, sans poser d'état
  // synchrone dans l'effet — ce qui déclencherait un rendu en cascade.
  const [charge, setCharge] = useState<{ categoryId: string; attributes: AttributeDefinition[] }>({
    categoryId: '',
    attributes: [],
  });

  useEffect(() => {
    if (!categoryId) return;
    const controller = new AbortController();
    fetch(`/api/categories/${categoryId}/attributes`, { signal: controller.signal })
      .then((r) => (r.ok ? (r.json() as Promise<AttributeDefinition[]>) : []))
      .then((attributes) => setCharge({ categoryId, attributes }))
      .catch(() => {
        // Requête annulée (changement de catégorie) ou API indisponible : on
        // laisse l'écran sur son état de chargement plutôt que d'afficher les
        // attributs d'une autre catégorie.
      });
    return () => controller.abort();
  }, [categoryId]);

  if (!categoryId) {
    return (
      <p className="text-sm text-slate-600">
        Choisissez une catégorie pour voir les attributs à renseigner.
      </p>
    );
  }
  if (charge.categoryId !== categoryId) {
    return <p className="text-sm text-slate-600">Chargement des attributs…</p>;
  }
  if (charge.attributes.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        Aucun attribut n&apos;est proposé pour cette catégorie.
      </p>
    );
  }

  const attributes = charge.attributes;

  const css = 'w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-sm text-slate-900';

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {attributes.map((a) => (
        <label key={a.id} className="block">
          <span className="mb-1 block text-sm font-medium text-slate-800">{a.name}</span>

          {a.type === 'TEXT' ? (
            <input name={`attr:${a.id}`} defaultValue={values[a.id]?.[0] ?? ''} className={css} />
          ) : null}

          {a.type === 'NUMBER' ? (
            <input
              name={`attr:${a.id}`}
              type="number"
              step="any"
              defaultValue={values[a.id]?.[0] ?? ''}
              className={css}
            />
          ) : null}

          {a.type === 'BOOLEAN' ? (
            <select name={`attr:${a.id}`} defaultValue={values[a.id]?.[0] ?? ''} className={css}>
              <option value="">—</option>
              <option value="true">Oui</option>
              <option value="false">Non</option>
            </select>
          ) : null}

          {a.type === 'SELECT' ? (
            <select name={`attr:${a.id}`} defaultValue={values[a.id]?.[0] ?? ''} className={css}>
              <option value="">—</option>
              {a.options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.value}
                </option>
              ))}
            </select>
          ) : null}

          {a.type === 'MULTISELECT' ? (
            <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-md border border-slate-400 bg-white p-2">
              {a.options.map((o) => (
                <label key={o.id} className="flex items-center gap-1.5 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name={`attr:${a.id}`}
                    value={o.id}
                    defaultChecked={values[a.id]?.includes(o.id)}
                    className="size-4 rounded border-slate-400 accent-slate-900"
                  />
                  {o.value}
                </label>
              ))}
            </div>
          ) : null}
        </label>
      ))}
    </div>
  );
}
