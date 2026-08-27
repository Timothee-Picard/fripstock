import { describe, expect, it } from 'vitest';
import { flowEdges, nodePosition } from './flow';
import type { Status } from '@/lib/types';

function statut(over: Partial<Status> & { id: string }): Status {
  return {
    name: over.id,
    color: '#000000',
    position: 0,
    isDefault: false,
    isSale: false,
    blocksSale: false,
    leavesStock: false,
    positionX: 0,
    positionY: 0,
    flowDefined: true,
    allowedTargets: [],
    ...over,
  };
}

/** Trois statuts alignés de gauche à droite. */
const enStock = statut({ id: 'stock', positionX: 0, positionY: 150, allowedTargets: ['rayon'] });
const enRayon = statut({ id: 'rayon', positionX: 320, positionY: 40, allowedTargets: ['vendu'] });
const vendu = statut({ id: 'vendu', positionX: 660, positionY: 20, allowedTargets: [] });

const par = (edges: ReturnType<typeof flowEdges>, id: string) => edges.find((e) => e.id === id)!;

describe('flowEdges', () => {
  it('déclare le type que la table des arêtes connaît', () => {
    // Avec `flux` d'un côté et `flow` de l'autre, le tracé sur mesure n'était
    // jamais utilisé et React Flow retombait sur ses courbes par défaut.
    for (const edge of flowEdges([enStock, enRayon, vendu])) expect(edge.type).toBe('flow');
  });

  it('fait sortir une progression à droite et entrer à gauche', () => {
    const edge = par(flowEdges([enStock, enRayon, vendu]), 'stock->rayon');
    expect(edge.sourceHandle).toBe('avant-out');
    expect(edge.targetHandle).toBe('avant-in');
  });

  it('fait passer un retour par le bas, des deux côtés', () => {
    // « Vendu » revient « En rayon » : tiré de droite à gauche, il traverserait
    // tout ce qui les sépare.
    const retour = { ...vendu, allowedTargets: ['rayon'] };
    const edge = par(flowEdges([enStock, enRayon, retour]), 'vendu->rayon');
    expect(edge.sourceHandle).toBe('retour-out');
    expect(edge.targetHandle).toBe('retour-in');
  });

  it('traite un aller-retour entre deux colonnes voisines comme un retour', () => {
    const retour = { ...enRayon, allowedTargets: ['stock'] };
    expect(par(flowEdges([enStock, retour, vendu]), 'rayon->stock').sourceHandle).toBe(
      'retour-out',
    );
  });

  it('compte comme retour une cible à la même abscisse', () => {
    // Deux statuts d'une même colonne : la flèche ne progresse pas, et sortir à
    // droite pour rentrer à gauche la ferait repasser sur eux.
    const a = statut({ id: 'a', positionX: 320, positionY: 40, allowedTargets: ['b'] });
    const b = statut({ id: 'b', positionX: 320, positionY: 260 });
    expect(par(flowEdges([a, b]), 'a->b').sourceHandle).toBe('retour-out');
  });

  it('creuse les retours sous le statut le plus bas', () => {
    const retour = { ...vendu, allowedTargets: ['rayon'] };
    const edge = par(flowEdges([enStock, enRayon, retour]), 'vendu->rayon');
    // Le plus bas est « En stock » à 150, plus la hauteur d'un statut.
    expect((edge.data as { depth: number }).depth).toBeGreaterThan(150 + 74);
  });

  it('étage les retours, du plus court au plus profond', () => {
    // Superposés sur une même ligne, on ne distinguerait plus l'un de l'autre ;
    // en profondeur croissante avec la portée, ils s'emboîtent.
    const court = statut({ id: 'court', positionX: 320, positionY: 40, allowedTargets: ['stock'] });
    const long = statut({ id: 'long', positionX: 660, positionY: 20, allowedTargets: ['stock'] });
    const edges = flowEdges([enStock, court, long]);
    const dCourt = (par(edges, 'court->stock').data as { depth: number }).depth;
    const dLong = (par(edges, 'long->stock').data as { depth: number }).depth;
    expect(dLong).toBeGreaterThan(dCourt);
  });

  it('ne donne pas de profondeur à une progression', () => {
    expect(par(flowEdges([enStock, enRayon, vendu]), 'stock->rayon').data).toEqual({});
  });

  it('ne trace rien tant qu’aucun flux n’est défini', () => {
    // Flux libre : relier chaque paire ne dirait rien de plus qu'un écran vide.
    const libres = [enStock, enRayon, vendu].map((s) => ({
      ...s,
      flowDefined: false,
      allowedTargets: ['rayon'],
    }));
    expect(flowEdges(libres)).toEqual([]);
  });

  it('ignore une cible absente de la liste', () => {
    const bancal = { ...enStock, allowedTargets: ['fantome'] };
    expect(flowEdges([bancal])).toEqual([]);
  });

  it('distingue les retours des progressions par leur pointe', () => {
    const retour = { ...vendu, allowedTargets: ['rayon'] };
    const edges = flowEdges([enStock, enRayon, retour]);
    const couleur = (id: string) => (par(edges, id).markerEnd as { color: string }).color;
    expect(couleur('vendu->rayon')).not.toBe(couleur('stock->rayon'));
  });
});

describe('nodePosition', () => {
  it('suit la position enregistrée', () => {
    expect(nodePosition(enRayon, 0)).toEqual({ x: 320, y: 40 });
  });

  it('retombe sur une grille quand l’entreprise n’en a pas', () => {
    const sansPosition = statut({ id: 'x', positionX: null, positionY: null });
    expect(nodePosition(sansPosition, 4)).toEqual({ x: 300, y: 150 });
  });
});
