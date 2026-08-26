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
function cellule(valeur: Cellule): string {
  if (valeur === null || valeur === undefined) return '';
  let texte = typeof valeur === 'string' ? valeur : String(valeur);
  if (/^[=+\-@\t\r]/.test(texte)) texte = `'${texte}`;
  if (texte.includes('"') || texte.includes(SEPARATEUR) || /[\r\n]/.test(texte)) {
    return `"${texte.replace(/"/g, '""')}"`;
  }
  return texte;
}

export function versCsv(entetes: string[], lignes: Cellule[][]): string {
  const contenu = [entetes, ...lignes]
    .map((ligne) => ligne.map(cellule).join(SEPARATEUR))
    .join('\r\n');
  return BOM + contenu + '\r\n';
}

/** `12.50` → `12,50` : Excel en français attend la virgule décimale. */
export function nombreFr(valeur: string | number | null | undefined): string {
  if (valeur === null || valeur === undefined) return '';
  return String(valeur).replace('.', ',');
}

export function dateFr(valeur: Date | null): string {
  return valeur ? valeur.toLocaleDateString('fr-FR') : '';
}

export function ouiNon(valeur: boolean | null): string {
  if (valeur === null || valeur === undefined) return '';
  return valeur ? 'oui' : 'non';
}
