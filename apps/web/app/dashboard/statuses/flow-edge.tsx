'use client';

import { BaseEdge, getSmoothStepPath, Position, useNodes, type EdgeProps } from '@xyflow/react';
import { useMemo } from 'react';

/** Espace laissé sous le statut le plus bas du trajet. */
const MARGE = 45;
const LARGEUR_DEFAUT = 170;
const HAUTEUR_DEFAUT = 62;

/**
 * Flèche entre deux statuts.
 *
 * Les poignées sont à droite (départ) et à gauche (arrivée). Un passage vers la
 * gauche — un retour, comme « Vendu » qui revient « En rayon » — traverserait
 * donc tout ce qui se trouve entre les deux.
 *
 * Ces flèches-là passent sous les statuts. Un décalage fixe ne suffirait pas :
 * il faut descendre sous le plus bas des statuts effectivement situés dans le
 * couloir horizontal parcouru, sinon la flèche traverse celui du dessous.
 */
export function FlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  style,
  selected,
}: EdgeProps) {
  const nodes = useNodes();

  // Marge : deux statuts quasi alignés produisent aussi un tracé qui repasse
  // sur eux.
  const back = targetX < sourceX + 40;

  const bas = useMemo(() => {
    if (!back) return undefined;
    const gauche = Math.min(sourceX, targetX) - 20;
    const droite = Math.max(sourceX, targetX) + 20;

    let plusBas = Math.max(sourceY, targetY);
    for (const n of nodes) {
      const x = n.position.x;
      const width = n.measured?.width ?? LARGEUR_DEFAUT;
      // On ignore les statuts hors du couloir parcouru.
      if (x + width < gauche || x > droite) continue;
      plusBas = Math.max(plusBas, n.position.y + (n.measured?.height ?? HAUTEUR_DEFAUT));
    }
    return plusBas + MARGE;
  }, [back, nodes, sourceX, sourceY, targetX, targetY]);

  const [chemin] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    borderRadius: 12,
    ...(bas !== undefined ? { centerY: bas } : {}),
  });

  return (
    <BaseEdge
      id={id}
      path={chemin}
      markerEnd={markerEnd}
      style={{
        ...style,
        strokeWidth: selected ? 3 : 1.5,
        stroke: selected ? '#0f172a' : '#94a3b8',
      }}
    />
  );
}
