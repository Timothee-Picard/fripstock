import { describe, expect, it } from 'vitest';
import { grouperRetraits } from './sections';
import type { RemovalItem } from '@/lib/types';

const article = (
  id: string,
  enLigne: boolean,
  shop: { id: string; name: string } | null,
): RemovalItem =>
  ({
    id,
    name: `Article ${id}`,
    shop,
    status: { id: 's', name: enLigne ? 'Vendu en ligne' : 'Vendu', isOnlineSale: enLigne },
  }) as RemovalItem;

const gare = { id: 'b2', name: 'Boutique Gare' };
const centre = { id: 'b1', name: 'Boutique Centre-ville' };

describe('grouperRetraits', () => {
  it('range les annonces à retirer sous la boutique en ligne', () => {
    // Vendu au comptoir : le geste se fait sur le site, d'un seul endroit.
    const sections = grouperRetraits([article('a', false, gare), article('b', false, centre)]);
    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe('Boutique en ligne');
    expect(sections[0].items).toHaveLength(2);
  });

  it('range les vêtements à décrocher boutique par boutique', () => {
    // Vendu sur le site : le geste se fait là où pend le vêtement, et une
    // tournée se fait boutique par boutique.
    const sections = grouperRetraits([article('a', true, gare), article('b', true, centre)]);
    expect(sections.map((s) => s.title)).toEqual(['Boutique Centre-ville', 'Boutique Gare']);
  });

  it('met la boutique en ligne en tête : elle se traite sans se déplacer', () => {
    const sections = grouperRetraits([article('a', true, gare), article('b', false, gare)]);
    expect(sections[0].title).toBe('Boutique en ligne');
    expect(sections[1].title).toBe('Boutique Gare');
  });

  it('trie les boutiques par leur nom, pas par ordre d’arrivée', () => {
    const sections = grouperRetraits([article('a', true, gare), article('b', true, centre)]);
    expect(sections[0].title).toBe('Boutique Centre-ville');
  });

  it('ne se fie pas au libellé du statut mais à son flag', () => {
    const menteur = {
      ...article('a', false, gare),
      status: { id: 's', name: 'Vendu en ligne', isOnlineSale: false },
    } as RemovalItem;
    expect(grouperRetraits([menteur])[0].title).toBe('Boutique en ligne');
  });

  it('rattache un article sans boutique au stock central', () => {
    // La règle ne devrait pas en produire — un article du stock central n'est
    // sur aucun portant — mais l'écran ne doit pas le perdre s'il en arrive un.
    const sections = grouperRetraits([article('a', true, null)]);
    expect(sections[0].title).toBe('Stock central');
  });

  it('ne rend aucune section sans retrait', () => {
    expect(grouperRetraits([])).toEqual([]);
  });
});
