import { readLayout } from './dashboard-layout';

describe('readLayout', () => {
  it('lit une liste de modules rangés', () => {
    expect(
      readLayout([
        { key: 'sales-curve', visible: true },
        { key: 'attribute:clx123', visible: false },
      ]),
    ).toEqual([
      { key: 'sales-curve', visible: true },
      { key: 'attribute:clx123', visible: false },
    ]);
  });

  it('rend une liste vide quand rien n’a jamais été rangé', () => {
    expect(readLayout(null)).toEqual([]);
    expect(readLayout({ modules: [] })).toEqual([]);
  });

  it('écarte ce qui n’a pas la forme attendue plutôt que d’échouer', () => {
    // La colonne a pu être écrite par une version antérieure de l'écran ou à la
    // main : un tableau de bord ne doit pas devenir illisible pour ça.
    expect(
      readLayout([
        null,
        'sales-curve',
        { visible: true },
        { key: 42, visible: true },
        { key: 'Ventes du jour !', visible: true },
        { key: 'stock-pie', visible: true },
      ]),
    ).toEqual([{ key: 'stock-pie', visible: true }]);
  });

  it('ne garde qu’une ligne par module', () => {
    expect(
      readLayout([
        { key: 'rotation', visible: false },
        { key: 'rotation', visible: true },
      ]),
    ).toEqual([{ key: 'rotation', visible: false }]);
  });

  it('considère visible tout ce qui n’est pas explicitement masqué', () => {
    expect(readLayout([{ key: 'rotation' }])).toEqual([{ key: 'rotation', visible: true }]);
  });

  it('borne le nombre de modules relus', () => {
    const stored = Array.from({ length: 80 }, (_, i) => ({ key: `module-${i}`, visible: true }));
    expect(readLayout(stored)).toHaveLength(60);
  });
});
