'use client';

import { useEffect, useRef } from 'react';
import type { AccesBoutique } from '@/lib/types';

const CLE = 'fripstock.boutiqueActive';

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
export function SelecteurBoutique({ boutiques }: { boutiques: AccesBoutique[] }) {
  const champ = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    try {
      const memorisee = localStorage.getItem(CLE);
      const valide = memorisee && boutiques.some((b) => b.boutiqueId === memorisee);
      if (valide && champ.current) champ.current.value = memorisee;
    } catch {
      // Navigation privée ou stockage bloqué : on reste sur la première
      // boutique, ce n'est pas bloquant.
    }
  }, [boutiques]);

  if (boutiques.length < 2) return null;

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-slate-500">Boutique</span>
      <select
        ref={champ}
        defaultValue={boutiques[0]?.boutiqueId}
        onChange={(e) => {
          try {
            localStorage.setItem(CLE, e.target.value);
          } catch {
            // Idem : le choix ne survivra pas au rechargement.
          }
        }}
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
      >
        {boutiques.map((b) => (
          <option key={b.boutiqueId} value={b.boutiqueId}>
            {b.nom}
          </option>
        ))}
      </select>
    </label>
  );
}
