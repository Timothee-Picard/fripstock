import { MarkerType, type Edge } from '@xyflow/react';
import type { Status } from '@/lib/types';

/** Hauteur d'un statut, pour situer le bas du schéma avant tout rendu. */
const HAUTEUR = 74;
/** Écart entre deux couloirs de retour. */
const COULOIR = 34;
/** Dégagement entre le statut le plus bas et le premier couloir. */
const DEGAGEMENT = 40;

/** Repli quand une entreprise n'a pas de positions : une grille lisible. */
export function nodePosition(status: Status, index: number): { x: number; y: number } {
  return {
    x: status.positionX ?? (index % 3) * 300,
    y: status.positionY ?? Math.floor(index / 3) * 150,
  };
}

/**
 * Flèches du flux, chacune orientée selon son sens de lecture.
 *
 * Une **progression** sort à droite et entre à gauche. Un **retour** — sa cible
 * est à gauche ou à la même hauteur — sort par le bas et rentre par le bas, en
 * passant sous le schéma : tiré comme les autres, il traverserait tout ce qui
 * le sépare de sa cible.
 *
 * Les retours s'étagent, du plus court au plus profond. Sans cet étagement ils
 * se superposeraient sur une seule ligne ; en profondeur croissante avec la
 * portée, ils s'emboîtent au lieu de se croiser.
 */
export function flowEdges(statuses: Status[]): Edge[] {
  const positions = new Map(statuses.map((s, i) => [s.id, nodePosition(s, i)]));
  const bas = Math.max(0, ...[...positions.values()].map((p) => p.y)) + HAUTEUR;

  const liens: { source: string; target: string; retour: boolean; portee: number }[] = [];
  for (const s of statuses) {
    // Aucune flèche tracée = flux libre : dessiner un lien entre chaque paire
    // de statuts ne dirait rien de plus qu'un écran vide.
    if (!s.flowDefined) continue;
    for (const target of s.allowedTargets) {
      const depart = positions.get(s.id);
      const arrivee = positions.get(target);
      if (!depart || !arrivee) continue;
      liens.push({
        source: s.id,
        target,
        retour: arrivee.x <= depart.x,
        portee: Math.abs(arrivee.x - depart.x),
      });
    }
  }

  const profondeurs = new Map<string, number>();
  liens
    .filter((l) => l.retour)
    .sort((a, b) => a.portee - b.portee || a.source.localeCompare(b.source))
    .forEach((l, rang) => {
      profondeurs.set(`${l.source}->${l.target}`, bas + DEGAGEMENT + rang * COULOIR);
    });

  return liens.map((l) => {
    const id = `${l.source}->${l.target}`;
    return {
      id,
      source: l.source,
      target: l.target,
      sourceHandle: l.retour ? 'retour-out' : 'avant-out',
      targetHandle: l.retour ? 'retour-in' : 'avant-in',
      type: 'flow',
      selectable: false,
      deletable: false,
      data: l.retour ? { depth: profondeurs.get(id) } : {},
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 16,
        height: 16,
        color: l.retour ? '#cbd5e1' : '#94a3b8',
      },
    };
  });
}
