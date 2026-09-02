import { describe, expect, it } from 'vitest';
import { arrangeModules } from './dashboard-modules';

const bloc = (key: string, defaultVisible = true) => ({ key, defaultVisible });

describe('arrangeModules', () => {
  it('suit l’ordre enregistré', () => {
    const arranged = arrangeModules(
      [bloc('a'), bloc('b'), bloc('c')],
      [
        { key: 'c', visible: true },
        { key: 'a', visible: false },
        { key: 'b', visible: true },
      ],
    );
    expect(arranged.map((m) => m.key)).toEqual(['c', 'a', 'b']);
    expect(arranged.map((m) => m.visible)).toEqual([true, false, true]);
  });

  it('pose à la fin ce qui n’a jamais été rangé, avec sa visibilité par défaut', () => {
    // Un module ajouté par une nouvelle version, ou un attribut créé depuis :
    // il ne doit pas disparaître faute d'être dans une liste écrite avant lui.
    const arranged = arrangeModules(
      [bloc('a'), bloc('attribute:x', false)],
      [{ key: 'a', visible: true }],
    );
    expect(arranged).toEqual([
      { key: 'a', defaultVisible: true, visible: true },
      { key: 'attribute:x', defaultVisible: false, visible: false },
    ]);
  });

  it('oublie sans bruit un module rangé qui n’existe plus', () => {
    // Attribut supprimé, droit retiré : la préférence survit à la carte.
    const arranged = arrangeModules(
      [bloc('a')],
      [
        { key: 'attribute:disparu', visible: true },
        { key: 'a', visible: true },
      ],
    );
    expect(arranged.map((m) => m.key)).toEqual(['a']);
  });

  it('garde l’ordre naturel quand rien n’a jamais été rangé', () => {
    const arranged = arrangeModules([bloc('a'), bloc('b')], []);
    expect(arranged.map((m) => m.key)).toEqual(['a', 'b']);
  });
});
