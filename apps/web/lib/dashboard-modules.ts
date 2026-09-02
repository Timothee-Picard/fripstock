import type { DashboardLayoutEntry } from './types';

/**
 * Préfixe des modules dont il existe un exemplaire par attribut
 * (`attribute:<id>`) : la meilleure couleur, la meilleure marque…
 *
 * Une clé et non un index : l'ordre des attributs change dès qu'on en renomme
 * un, et un rangement enregistré doit survivre à ça.
 */
export const ATTRIBUTE_MODULE_PREFIX = 'attribute:';

export interface ModuleShape {
  key: string;
  /**
   * Visibilité d'un module que l'utilisateur n'a jamais rangé.
   *
   * Faux pour les classements par attribut : une entreprise en a quatre ou
   * cinq, et les afficher tous d'office noierait le tableau de bord sous des
   * cartes que personne n'a demandées. Ils s'ajoutent depuis « Personnaliser ».
   */
  defaultVisible: boolean;
}

/**
 * Croise les modules que l'écran sait dessiner avec le rangement enregistré.
 *
 * Trois cas, et c'est tout l'intérêt de passer par ici :
 *
 * - **rangé et disponible** : il prend la place et la visibilité enregistrées ;
 * - **disponible mais jamais rangé** (module nouveau, attribut créé depuis) :
 *   il se pose à la fin, avec sa visibilité par défaut — plutôt que de
 *   disparaître parce qu'il n'est pas dans une liste écrite avant lui ;
 * - **rangé mais plus disponible** (attribut supprimé, droit retiré) : il
 *   s'efface sans bruit.
 */
export function arrangeModules<T extends ModuleShape>(
  available: T[],
  layout: DashboardLayoutEntry[],
): (T & { visible: boolean })[] {
  const byKey = new Map(available.map((m) => [m.key, m]));
  const arranged: (T & { visible: boolean })[] = [];

  for (const entry of layout) {
    const bloc = byKey.get(entry.key);
    if (!bloc) continue;
    byKey.delete(entry.key);
    arranged.push({ ...bloc, visible: entry.visible });
  }
  // `byKey` ne contient plus que les modules jamais rangés, dans l'ordre
  // naturel de `available` puisqu'une Map conserve l'ordre d'insertion.
  for (const bloc of byKey.values()) {
    arranged.push({ ...bloc, visible: bloc.defaultVisible });
  }
  return arranged;
}
