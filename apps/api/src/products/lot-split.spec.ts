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

  describe('prix de vente manquants', () => {
    it('partage à parts égales quand aucun prix n’est fixé', () => {
      expect(splitCost(6, [null, null, null])).toEqual([2, 2, 2]);
    });

    it('donne à un article sans prix la moyenne des autres', () => {
      // Deux articles à 10 et 20 : le troisième compte pour 15.
      expect(splitCost(45, [10, 20, null])).toEqual([10, 20, 15]);
    });

    it('ne fait pas porter tout le lot aux seuls articles étiquetés', () => {
      // Sans cette règle, le t-shirt non étiqueté prendrait zéro et les trois
      // autres paieraient le lot entier.
      const parts = splitCost(40, [10, 10, 10, null]);
      expect(parts).toEqual([10, 10, 10, 10]);
    });

    it('applique la moyenne à chacun des articles sans prix', () => {
      expect(splitCost(60, [20, 40, null, null])).toEqual([10, 20, 15, 15]);
    });

    it('distingue un prix à zéro d’un prix absent', () => {
      // Zéro est un prix décidé : l'article est donné, il ne porte rien.
      expect(splitCost(30, [10, 20, 0])).toEqual([10, 20, 0]);
      // Absent veut dire « pas encore su » : il prend la moyenne.
      expect(splitCost(45, [10, 20, null])).toEqual([10, 20, 15]);
    });

    it('retombe sur des parts égales si tous les prix fixés valent zéro', () => {
      expect(splitCost(6, [0, 0, null])).toEqual([2, 2, 2]);
    });

    it('retombe exactement sur le prix payé, moyenne comprise', () => {
      const parts = splitCost(7, [10, 20, null]);
      expect(somme(parts)).toBe(7);
    });
  });

  it('partage à parts égales aussi quand tous les poids sont nuls', () => {
    expect(splitCost(1, [0, 0, 0])).toEqual([0.34, 0.33, 0.33]);
  });

  it('sert les centimes restants aux plus gros restes, dans l’ordre', () => {
    // 1 € entre trois parts égales : deux tiers arrondis au-dessus.
    expect(splitCost(1, [1, 1, 1])).toEqual([0.34, 0.33, 0.33]);
  });

  it('traite un poids négatif comme un prix à zéro', () => {
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
