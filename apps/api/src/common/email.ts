/**
 * Normalise un email avant stockage ou recherche.
 *
 * Sans ça, `Alice@Test.fr` et `alice@test.fr` sont deux comptes distincts pour
 * la contrainte d'unicité : on pourrait créer un doublon, ou ne plus se
 * connecter après avoir changé la casse de son propre email.
 */
export function normaliserEmail(email: string): string {
  return email.trim().toLowerCase();
}
