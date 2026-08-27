import { describe, expect, it } from 'vitest';
import { cellNumber, isBlank, readFormLines, usableLines } from './form-lines';

/** Un FormData tel que le poste un tableau de saisie. */
function form(champs: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(champs)) {
    if (Array.isArray(value)) value.forEach((v) => data.append(key, v));
    else data.set(key, value);
  }
  return data;
}

const ligne = (id: string, champs: Record<string, string | string[]>) =>
  Object.fromEntries(Object.entries(champs).map(([k, v]) => [`line:${id}:${k}`, v]));

describe('readFormLines', () => {
  it('regroupe les cellules par ligne, dans l’ordre des lineId', () => {
    const lines = readFormLines(
      form({
        lineId: ['a', 'b'],
        ...ligne('a', { name: 'Robe', salePrice: '15' }),
        ...ligne('b', { name: 'Sac' }),
      }),
    );
    expect(lines.map((l) => l.cells.name)).toEqual(['Robe', 'Sac']);
    expect(lines[0].cells.salePrice).toBe('15');
  });

  it('écarte les cellules vides plutôt que de porter des chaînes vides', () => {
    const [line] = readFormLines(
      form({ lineId: 'a', ...ligne('a', { name: 'Robe', reference: '  ' }) }),
    );
    expect(line.cells).not.toHaveProperty('reference');
  });

  it('rassemble les attributs, valeur seule ou liste', () => {
    const [line] = readFormLines(
      form({
        lineId: 'a',
        ...ligne('a', { name: 'Robe', 'attr:a1': 'o1', 'attr:a2': ['o2', 'o3'], 'attr:a3': '' }),
      }),
    );
    expect(line.attributes).toEqual([
      { attributeDefinitionId: 'a1', value: 'o1' },
      { attributeDefinitionId: 'a2', value: ['o2', 'o3'] },
    ]);
  });

  it('ne confond pas les cellules de deux lignes', () => {
    const lines = readFormLines(
      form({
        lineId: ['a', 'ab'],
        ...ligne('a', { name: 'Robe' }),
        ...ligne('ab', { name: 'Sac' }),
      }),
    );
    expect(lines.map((l) => l.cells.name)).toEqual(['Robe', 'Sac']);
  });
});

describe('isBlank', () => {
  const line = (cells: Record<string, string>, attributes: never[] = []) => ({
    id: 'a',
    cells,
    attributes,
  });

  it('tient pour vide une ligne sans rien', () => {
    expect(isBlank(line({}))).toBe(true);
  });

  it('tient pour vide une ligne où seule la catégorie est héritée', () => {
    // Le tableau recopie la catégorie de la ligne précédente par confort :
    // cette ligne-là reste visuellement vide.
    expect(isBlank(line({ categoryId: 'c1' }))).toBe(true);
  });

  it('ne tient pas pour vide une ligne où un prix est saisi', () => {
    expect(isBlank(line({ categoryId: 'c1', salePrice: '15' }))).toBe(false);
  });

  it('ne tient pas pour vide une ligne qui ne porte qu’un attribut', () => {
    expect(isBlank(line({}, [{ attributeDefinitionId: 'a1', value: 'o1' }] as never))).toBe(false);
  });
});

describe('usableLines', () => {
  it('écarte la ligne vide gardée en bas du tableau', () => {
    const { lines, error } = usableLines(
      form({
        lineId: ['a', 'b'],
        ...ligne('a', { name: 'Robe', categoryId: 'c1' }),
        ...ligne('b', { categoryId: 'c1' }),
      }),
    );
    expect(error).toBeUndefined();
    expect(lines).toHaveLength(1);
  });

  it('refuse une ligne à moitié remplie au lieu de la faire disparaître', () => {
    const { lines, error } = usableLines(
      form({
        lineId: ['a', 'b'],
        ...ligne('a', { name: 'Robe', categoryId: 'c1' }),
        ...ligne('b', { categoryId: 'c1', salePrice: '15' }),
      }),
    );
    expect(error).toBe('Ligne 2 : le nom est obligatoire.');
    expect(lines).toEqual([]);
  });

  it('numérote la ligne fautive parmi les lignes remplies', () => {
    // La ligne vide intercalée ne décale pas le numéro annoncé.
    const { error } = usableLines(
      form({
        lineId: ['a', 'vide', 'b'],
        ...ligne('a', { name: 'Robe' }),
        ...ligne('b', { salePrice: '15' }),
      }),
    );
    expect(error).toBe('Ligne 2 : le nom est obligatoire.');
  });

  it('rend une liste vide pour un tableau entièrement vierge', () => {
    expect(usableLines(form({ lineId: ['a'] }))).toEqual({ lines: [] });
  });
});

describe('cellNumber', () => {
  it('accepte la virgule décimale', () => {
    expect(cellNumber('12,50')).toBe(12.5);
  });

  it('rend undefined pour une cellule absente', () => {
    expect(cellNumber(undefined)).toBeUndefined();
  });

  it('rend undefined plutôt que NaN pour une saisie illisible', () => {
    expect(cellNumber('douze')).toBeUndefined();
  });

  it('accepte zéro, qui est une valeur', () => {
    expect(cellNumber('0')).toBe(0);
  });
});
