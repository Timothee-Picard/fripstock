'use client';

import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { Statut } from '@/lib/types';

export type DonneesStatut = { statut: Statut };
export type NoeudStatut = Node<DonneesStatut, 'statut'>;

/** Un statut sur le canevas : son libellé, sa couleur, son comportement. */
export function NoeudStatutVue({ data, selected }: NodeProps<NoeudStatut>) {
  const { statut } = data;
  const marques = [
    statut.estVente ? 'vente' : null,
    statut.bloqueVente ? 'invendable' : null,
    statut.sortStock ? 'hors stock' : null,
  ].filter(Boolean);

  return (
    <div
      className={`min-w-40 overflow-hidden rounded-lg bg-white shadow-sm transition ${
        selected ? 'ring-2 ring-slate-900 ring-offset-2' : ''
      }`}
      style={{ border: `2px solid ${statut.couleur}` }}
    >
      {/* Une poignée de chaque côté : on tire de la droite d'un statut vers la
          gauche du suivant pour autoriser ce passage. */}
      <Handle
        type="target"
        position={Position.Left}
        className="!size-3 !border-2 !border-white !bg-slate-600"
      />
      <div
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium"
        style={{ backgroundColor: statut.couleur, color: texteLisible(statut.couleur) }}
      >
        {statut.nom}
        {statut.estDefaut ? <span title="Statut par défaut">★</span> : null}
      </div>
      <div className="px-3 py-1 text-[11px] leading-tight text-slate-600">
        {marques.length > 0 ? marques.join(' · ') : 'ordinaire'}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!size-3 !border-2 !border-white !bg-slate-600"
      />
    </div>
  );
}

/** Noir ou blanc selon la luminance, pour rester lisible sur toute teinte. */
function texteLisible(fond: string): string {
  const hex = fond.replace('#', '');
  if (hex.length !== 6) return '#ffffff';
  const [r, v, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(v) + 0.0722 * lin(b) > 0.179 ? '#0f172a' : '#ffffff';
}
