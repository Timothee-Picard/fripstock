'use client';

import { useEffect, useRef } from 'react';
import type { ShopAccess } from '@/lib/types';

const KEY = 'fripstock.boutiqueActive';

/**
 * Sélecteur de boutique active. Le choix est purement local (préférence
 * d'affichage), il ne conditionne aucun droit : les permissions sont vérifiées
 * côté API, jamais ici.
 *
 * Le `select` est volontairement non contrôlé. Le serveur ne peut pas connaître
 * la valeur mémorisée dans le navigateur : la lire dans un état React
 * provoquerait soit une divergence d'hydratation, soit un rendu en cascade. On
 * rend donc la première boutique, puis on corrige la valeur du DOM après le
 * montage.
 */
export function ShopSelector({ shops }: { shops: ShopAccess[] }) {
  const field = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    try {
      const memoized = localStorage.getItem(KEY);
      const valide = memoized && shops.some((b) => b.shopId === memoized);
      if (valide && field.current) field.current.value = memoized;
    } catch {
      // Navigation privée ou stockage bloqué : on reste sur la première
      // boutique, ce n'est pas bloquant.
    }
  }, [shops]);

  if (shops.length < 2) return null;

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-slate-600">Boutique</span>
      <select
        ref={field}
        defaultValue={shops[0]?.shopId}
        onChange={(e) => {
          try {
            localStorage.setItem(KEY, e.target.value);
          } catch {
            // Idem : le choix ne survivra pas au rechargement.
          }
        }}
        className="rounded-md border border-slate-400 bg-white px-2 py-1 text-sm text-slate-900"
      >
        {shops.map((b) => (
          <option key={b.shopId} value={b.shopId}>
            {b.name}
          </option>
        ))}
      </select>
    </label>
  );
}
