'use client';

import { BaseEdge, getSmoothStepPath, Position, type EdgeProps } from '@xyflow/react';

/** Profondeur du couloir de retour, calculée par l'éditeur. */
export interface FlowEdgeData extends Record<string, unknown> {
  /** Ordonnée du passage sous le schéma. Absente pour une progression. */
  depth?: number;
}

/**
 * Flèche entre deux statuts.
 *
 * Deux tracés, parce qu'il y a deux sens de lecture. Une **progression** va de
 * la droite d'un statut vers la gauche du suivant. Un **retour** — « Vendu »
 * qui revient « En rayon » — sort par le bas et rentre par le bas, en passant
 * sous tout le schéma : tiré de droite à gauche comme les autres, il
 * traverserait les statuts qui le séparent de sa cible.
 *
 * Les retours sont en pointillés : sans cette distinction, un schéma dense se
 * lit comme un plat de spaghettis où rien ne dit ce qui avance et ce qui
 * revient en arrière.
 */
export function FlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  data,
}: EdgeProps) {
  const retour = sourcePosition === Position.Bottom;
  const depth = (data as FlowEdgeData | undefined)?.depth;

  const [chemin] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 10,
    // `centerY` fixe la profondeur du couloir : les retours s'y étagent, sinon
    // ils se superposent tous sur la même ligne et on n'en distingue plus un.
    ...(retour && depth !== undefined ? { centerY: depth } : {}),
  });

  return (
    <BaseEdge
      id={id}
      path={chemin}
      markerEnd={markerEnd}
      style={{
        ...style,
        strokeWidth: 1.5,
        stroke: retour ? '#cbd5e1' : '#94a3b8',
        ...(retour ? { strokeDasharray: '5 4' } : {}),
      }}
    />
  );
}
