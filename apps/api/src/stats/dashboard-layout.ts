/**
 * Rangement des modules du tableau de bord.
 *
 * Ce que l'utilisateur a rangé est une **liste ordonnée** de clés, chacune
 * affichée ou masquée. L'ordre du tableau est l'ordre à l'écran : rien d'autre
 * ne le porte, et une position stockée à côté se serait désynchronisée au
 * premier glisser-déposer.
 *
 * L'API ne connaît pas le catalogue des modules — c'est l'écran qui sait quels
 * blocs il sait dessiner, et il en apparaîtra d'autres. Elle valide donc la
 * **forme** (des clés plausibles, en nombre borné) et non le sens : une clé
 * devenue inconnue est simplement ignorée à l'affichage, pas une erreur 400 qui
 * bloquerait l'enregistrement de tout le reste. Une clé absente de la liste est
 * un module que l'utilisateur n'a jamais rangé : l'écran le pose à la fin, avec
 * sa visibilité par défaut.
 */

/**
 * Clés acceptées : un identifiant de module (`sales-curve`), éventuellement
 * suivi d'un identifiant de ressource (`attribute:clx…`) pour les modules dont
 * il existe un exemplaire par attribut.
 */
export const MODULE_KEY = /^[a-z][a-z0-9-]{0,39}(:[A-Za-z0-9_-]{1,40})?$/;

/**
 * Borne du nombre de modules rangés. Large devant le catalogue réel — une
 * poignée de blocs fixes plus un par attribut — mais assez basse pour qu'un
 * client bavard ne fasse pas grossir la ligne sans fin.
 */
export const MAX_MODULES = 60;

export interface LayoutEntry {
  key: string;
  visible: boolean;
}

/**
 * Relecture défensive de la colonne JSON.
 *
 * Elle a pu être écrite par une version antérieure de l'écran, ou à la main :
 * tout ce qui n'a pas la forme attendue est écarté silencieusement, faute de
 * quoi un tableau de bord deviendrait illisible pour cause de préférence
 * abîmée.
 */
export function readLayout(stored: unknown): LayoutEntry[] {
  if (!Array.isArray(stored)) return [];
  const entries: LayoutEntry[] = [];
  const seen = new Set<string>();
  for (const raw of stored) {
    if (typeof raw !== 'object' || raw === null) continue;
    const { key, visible } = raw as { key?: unknown; visible?: unknown };
    if (typeof key !== 'string' || !MODULE_KEY.test(key) || seen.has(key)) continue;
    seen.add(key);
    entries.push({ key, visible: visible !== false });
    if (entries.length === MAX_MODULES) break;
  }
  return entries;
}
