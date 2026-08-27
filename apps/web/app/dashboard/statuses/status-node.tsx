'use client';

import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { Status } from '@/lib/types';

export type StatusNodeData = { status: Status };
export type StatusNode = Node<StatusNodeData, 'status'>;

/** Un statut sur le canevas : son libellé, sa couleur, son comportement. */
export function StatusNodeView({ data, selected }: NodeProps<StatusNode>) {
  const { status } = data;
  const brands = [
    status.isSale ? 'vente' : null,
    status.blocksSale ? 'invendable' : null,
    status.leavesStock ? 'hors stock' : null,
  ].filter(Boolean);

  return (
    <div
      className={`min-w-40 overflow-hidden rounded-lg bg-white shadow-sm transition ${
        selected ? 'ring-2 ring-slate-900 ring-offset-2' : ''
      }`}
      style={{ border: `2px solid ${status.color}` }}
    >
      {/* Quatre poignées, deux par sens de lecture.
          Les côtés portent la progression : on sort à droite, on entre à
          gauche. Le bas porte les retours — « Vendu » qui revient « En
          rayon » — qui passent sous le schéma au lieu de le traverser. */}
      <Handle
        id="avant-in"
        type="target"
        position={Position.Left}
        className="!size-3 !border-2 !border-white !bg-slate-600"
      />
      <Handle
        id="retour-in"
        type="target"
        position={Position.Bottom}
        className="!size-2 !border-2 !border-white !bg-slate-400"
      />
      <Handle
        id="retour-out"
        type="source"
        position={Position.Bottom}
        className="!size-2 !border-2 !border-white !bg-slate-400"
      />
      <div
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium"
        style={{ backgroundColor: status.color, color: texteLisible(status.color) }}
      >
        {status.name}
        {status.isDefault ? <span title="Statut par défaut">★</span> : null}
      </div>
      <div className="px-3 py-1 text-[11px] leading-tight text-slate-600">
        {brands.length > 0 ? brands.join(' · ') : 'ordinaire'}
      </div>
      <Handle
        id="avant-out"
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
