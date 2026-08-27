import { splitCost } from './lot-split';

/** Somme arrondie, pour comparer au prix payé sans bruit de flottant. */
const somme = (parts: number[]) => Math.round(parts.reduce((t, p) => t + p, 0) * 100) / 100;

describe('splitCost', () => {
  it('répartit au prorata du prix de vente', () => {
    // 4 t-shirts à 10 € et 2 chemises à 20 €, lot payé 7 €.
    expect(splitCost(7, [10, 10, 10, 10, 20, 20])).toEqual([0.88, 0.88, 0.87, 0.87, 1.75, 1.75]);
  });

  it('retombe exactement sur le prix payé', () => {
    expect(somme(splitCost(7, [10, 10, 10, 10, 20, 20]))).toBe(7);
  });

  it.each([
    [7, [10, 10, 10]],
    [10, [3, 3, 3]],
    [0.01, [1, 1, 1]],
    [99.99, [1, 2, 3, 4, 5, 6, 7]],
    [1, [1, 1, 1, 1, 1, 1, 1]],
  ])('retombe sur %p quel que soit le nombre de parts', (total, weights) => {
    expect(somme(splitCost(total, weights))).toBe(total);
  });

  it('donne le même taux de marge à des articles de même prix', () => {
    const parts = splitCost(10, [20, 20]);
    expect(parts).toEqual([5, 5]);
  });

  it('partage à parts égales quand aucun prix de vente n’est donné', () => {
    expect(splitCost(6, [0, 0, 0])).toEqual([2, 2, 2]);
  });

  it('partage à parts égales aussi quand la liste est vide de poids utiles', () => {
    expect(splitCost(1, [0, 0, 0])).toEqual([0.34, 0.33, 0.33]);
  });

  it('sert les centimes restants aux plus gros restes, dans l’ordre', () => {
    // 1 € entre trois parts égales : deux tiers arrondis au-dessus.
    expect(splitCost(1, [1, 1, 1])).toEqual([0.34, 0.33, 0.33]);
  });

  it('traite un poids négatif comme nul', () => {
    expect(splitCost(4, [-5, 10, 10])).toEqual([0, 2, 2]);
  });

  it('donne tout à l’unique article d’un lot d’un seul', () => {
    expect(splitCost(7, [10])).toEqual([7]);
  });

  it('rend une liste vide pour un lot sans article', () => {
    expect(splitCost(7, [])).toEqual([]);
  });

  it('accepte un lot gratuit', () => {
    expect(splitCost(0, [10, 20])).toEqual([0, 0]);
  });

  it('gère un prix payé aux centimes', () => {
    expect(somme(splitCost(12.34, [7, 11, 13]))).toBe(12.34);
  });
});
