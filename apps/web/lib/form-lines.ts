/**
 * Lecture des tableaux de saisie ligne à ligne.
 *
 * Les deux écrans qui créent des produits en série — dépôt d'un contrat, achat
 * en lot — postent leurs cellules sous le nom `line:<id>:<champ>`, et l'ordre
 * des lignes vient des `lineId`. L'identifiant est propre au formulaire : il ne
 * sert qu'à regrouper les cellules d'une même ligne.
 */

export interface RawLine {
  id: string;
  /** Cellules de texte, déjà débarrassées de leurs espaces. */
  cells: Record<string, string>;
  attributes: { attributeDefinitionId: string; value: string | string[] }[];
}

export function readFormLines(data: FormData): RawLine[] {
  const ids = data.getAll('lineId').map(String);
  const prefixes = ids.map((id) => `line:${id}:`);

  // `keys()` répète une clé autant de fois qu'elle porte de valeurs : sans le
  // dédoublonnage, un attribut multiselect serait lu deux fois.
  const keys = [...new Set(data.keys())];

  return ids.map((id, index) => {
    const prefix = prefixes[index];
    const cells: Record<string, string> = {};
    const attributes: RawLine['attributes'] = [];

    for (const key of keys) {
      if (!key.startsWith(prefix)) continue;
      const champ = key.slice(prefix.length);

      if (champ.startsWith('attr:')) {
        const values = data.getAll(key).map(String).filter(Boolean);
        if (values.length === 0) continue;
        attributes.push({
          attributeDefinitionId: champ.slice('attr:'.length),
          // Une case cochée seule et un multiselect à une valeur sont
          // indiscernables ici : l'API normalise selon le type réel.
          value: values.length === 1 ? values[0] : values,
        });
        continue;
      }

      const value = String(data.get(key) ?? '').trim();
      if (value !== '') cells[champ] = value;
    }

    return { id, cells, attributes };
  });
}

/** Nombre lu dans une cellule, virgule décimale comprise. */
export function cellNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value.replace(',', '.'));
  return Number.isNaN(n) ? undefined : n;
}
