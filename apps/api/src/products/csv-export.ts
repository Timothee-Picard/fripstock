/**
 * Génération du CSV d'export.
 *
 * Séparateur `;` et UTF-8 **avec BOM** : c'est ce qu'attend Excel en français.
 * Sans le BOM, « Matière » s'ouvre en « MatiÃ¨re » ; avec une virgule, tout
 * atterrit dans une seule colonne.
 */
/**
 * Ce qu'une cellule peut contenir. Volontairement restreint : accepter
 * `unknown` laisserait un objet finir en « [object Object] » dans un fichier
 * censé être lu par un humain.
 */
export type Cellule = string | number | boolean | null | undefined;

const SEPARATEUR = ';';
const BOM = '﻿';

/**
 * Échappe une cellule.
 *
 * Le préfixe sur `=`, `+`, `-` et `@` neutralise l'injection de formule : une
 * référence produit saisie `=1+1` serait sinon exécutée à l'ouverture du
 * fichier, et `=HYPERLINK(...)` est un vecteur d'exfiltration connu.
 */
function cellule(value: Cellule): string {
  if (value === null || value === undefined) return '';
  let text = typeof value === 'string' ? value : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (text.includes('"') || text.includes(SEPARATEUR) || /[\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function versCsv(headers: string[], lines: Cellule[][]): string {
  const content = [headers, ...lines]
    .map((line) => line.map(cellule).join(SEPARATEUR))
    .join('\r\n');
  return BOM + content + '\r\n';
}

/** `12.50` → `12,50` : Excel en français attend la virgule décimale. */
export function frNumber(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value).replace('.', ',');
}

export function dateFr(value: Date | null): string {
  return value ? value.toLocaleDateString('fr-FR') : '';
}

export function ouiNon(value: boolean | null): string {
  if (value === null || value === undefined) return '';
  return value ? 'oui' : 'non';
}
