import { describe, expect, it } from 'vitest';
import { splitCost } from './lot-split';

/**
 * Ces cas sont les mêmes que ceux de `lot-split.spec.ts` côté API : l'aperçu à
 * l'écran doit annoncer, au centime près, ce que le serveur écrira.
 */
const somme = (parts: number[]) => Math.round(parts.reduce((t, p) => t + p, 0) * 100) / 100;

describe('splitCost', () => {
  it('répartit au prorata du prix de vente', () => {
    expect(splitCost(7, [10, 10, 10, 10, 20, 20])).toEqual([0.88, 0.88, 0.87, 0.87, 1.75, 1.75]);
  });

  it.each([
    [7, [10, 10, 10]],
    [10, [3, 3, 3]],
    [0.01, [1, 1, 1]],
    [99.99, [1, 2, 3, 4, 5, 6, 7]],
    [12.34, [7, 11, 13]],
  ])('retombe exactement sur %p', (total, weights) => {
    expect(somme(splitCost(total, weights))).toBe(total);
  });

  it('partage à parts égales sans prix de vente', () => {
    expect(splitCost(6, [0, 0, 0])).toEqual([2, 2, 2]);
  });

  it('sert les centimes restants aux plus gros restes', () => {
    expect(splitCost(1, [1, 1, 1])).toEqual([0.34, 0.33, 0.33]);
  });

  it('traite un poids négatif comme nul', () => {
    expect(splitCost(4, [-5, 10, 10])).toEqual([0, 2, 2]);
  });

  it('rend une liste vide pour un lot sans article', () => {
    expect(splitCost(7, [])).toEqual([]);
  });

  it('accepte un lot gratuit', () => {
    expect(splitCost(0, [10, 20])).toEqual([0, 0]);
  });
});
