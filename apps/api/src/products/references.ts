/**
 * Génération des références d'articles.
 *
 * La référence est ce qu'on écrit sur l'étiquette et ce qu'on dicte au
 * téléphone : elle doit être courte, sans caractère ambigu, et dire d'où vient
 * l'article.
 *
 * - acheté       → `A-0042`, compteur de l'entreprise ;
 * - en dépôt     → `D-MAR-001`, code du déposant et compteur qui lui est propre.
 *
 * Le numéro du dépôt repart à 1 pour chaque déposant : « le 3 de Martin » se
 * dit, et un relevé qui saute de 002 à 004 se remarque.
 */

/** Longueur du code déposant dans une référence (le MAR de D-MAR-001). */
const CODE_LENGTH = 3;

/**
 * Code court déduit du nom d'un déposant.
 *
 * Les accents sont dépliés et tout ce qui n'est pas une lettre disparaît :
 * « Nguyên-Bá » donne NGU, et la référence reste dictable. Un nom trop court
 * est complété, faute de quoi deux déposants « Li » et « Lo » donneraient des
 * codes de longueurs différentes.
 */
export function depositorCode(lastName: string, firstName?: string | null): string {
  const lettres = (texte: string) =>
    texte
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z]/g, '')
      .toUpperCase();

  const base = lettres(lastName) + lettres(firstName ?? '');
  // Un déposant sans une seule lettre exploitable reste possible : plutôt que
  // de refuser, on retombe sur un code neutre que le gérant pourra corriger.
  return (base || 'DEP').slice(0, CODE_LENGTH).padEnd(CODE_LENGTH, 'X');
}

/**
 * Rend le code libre le plus proche de `souhaite`.
 *
 * Deux « Martin » ne peuvent pas porter MAR tous les deux : le second devient
 * MAR2. Le suffixe s'ajoute en rognant la base pour que tous les codes gardent
 * la même longueur, ce qui aligne les références dans une liste.
 */
export function freeCode(souhaite: string, pris: Set<string>): string {
  if (!pris.has(souhaite)) return souhaite;
  for (let n = 2; n < 1000; n += 1) {
    const suffixe = String(n);
    const candidat = souhaite.slice(0, Math.max(1, CODE_LENGTH - suffixe.length)) + suffixe;
    if (!pris.has(candidat)) return candidat;
  }
  // Mille homonymes : on rend le code souhaité, la contrainte d'unicité en base
  // tranchera plutôt que de boucler indéfiniment.
  return souhaite;
}

/** `A-0042` — article acheté, numéro de l'entreprise. */
export function resaleReference(counter: number): string {
  return `A-${String(counter).padStart(4, '0')}`;
}

/** `D-MAR-001` — article déposé, code du déposant et son propre numéro. */
export function consignmentReference(code: string, counter: number): string {
  return `D-${code}-${String(counter).padStart(3, '0')}`;
}
