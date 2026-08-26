'use client';

import { useEffect, useState } from 'react';
import type { AttributDefinition } from '@/lib/types';

/**
 * Champs d'attributs chargés d'après la catégorie choisie.
 *
 * Le catalogue déclare, catégorie par catégorie, quels attributs sont
 * pertinents : on ne demande donc pas la taille d'un sac. L'API applique la
 * même règle et refuse un attribut inapplicable, l'affichage n'est qu'un
 * confort.
 */
export function AttributsDynamiques({ categorieId }: { categorieId: string }) {
  // On mémorise la catégorie chargée avec ses attributs : comparer les deux en
  // rendu suffit à savoir si l'affichage est à jour, sans poser d'état
  // synchrone dans l'effet — ce qui déclencherait un rendu en cascade.
  const [charge, setCharge] = useState<{ categorieId: string; attributs: AttributDefinition[] }>({
    categorieId: '',
    attributs: [],
  });

  useEffect(() => {
    if (!categorieId) return;
    const controleur = new AbortController();
    fetch(`/api/categories/${categorieId}/attributs`, { signal: controleur.signal })
      .then((r) => (r.ok ? (r.json() as Promise<AttributDefinition[]>) : []))
      .then((attributs) => setCharge({ categorieId, attributs }))
      .catch(() => {
        // Requête annulée (changement de catégorie) ou API indisponible : on
        // laisse l'écran sur son état de chargement plutôt que d'afficher les
        // attributs d'une autre catégorie.
      });
    return () => controleur.abort();
  }, [categorieId]);

  if (!categorieId) {
    return (
      <p className="text-sm text-slate-600">
        Choisissez une catégorie pour voir les attributs à renseigner.
      </p>
    );
  }
  if (charge.categorieId !== categorieId) {
    return <p className="text-sm text-slate-600">Chargement des attributs…</p>;
  }
  if (charge.attributs.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        Aucun attribut n&apos;est proposé pour cette catégorie.
      </p>
    );
  }

  const attributs = charge.attributs;

  const classe =
    'w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-sm text-slate-900';

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {attributs.map((a) => (
        <label key={a.id} className="block">
          <span className="mb-1 block text-sm font-medium text-slate-800">{a.nom}</span>

          {a.type === 'TEXT' ? <input name={`attr:${a.id}`} className={classe} /> : null}

          {a.type === 'NUMBER' ? (
            <input name={`attr:${a.id}`} type="number" step="any" className={classe} />
          ) : null}

          {a.type === 'BOOLEAN' ? (
            <select name={`attr:${a.id}`} defaultValue="" className={classe}>
              <option value="">—</option>
              <option value="true">Oui</option>
              <option value="false">Non</option>
            </select>
          ) : null}

          {a.type === 'SELECT' ? (
            <select name={`attr:${a.id}`} defaultValue="" className={classe}>
              <option value="">—</option>
              {a.options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.valeur}
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
                    className="size-4 rounded border-slate-400 accent-slate-900"
                  />
                  {o.valeur}
                </label>
              ))}
            </div>
          ) : null}
        </label>
      ))}
    </div>
  );
}
