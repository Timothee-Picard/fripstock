import type { Status } from '@/lib/types';

/**
 * Pastille de statut.
 *
 * La couleur vient de la base — chaque entreprise choisit la sienne — mais elle
 * ne sert plus d'aplat. Un aplat saturé oblige à trancher entre texte blanc et
 * texte noir selon la teinte, et une colonne de la liste des produits se
 * retrouvait à alterner les deux d'une ligne à l'autre. Les six statuts de base
 * tombaient entre 4,2 et 4,8 pour 1 : « Rendu au client » passait même sous le
 * minimum AA, et les autres le frôlaient.
 *
 * La teinte retenue devient donc un fond très clair, un texte foncé de la même
 * teinte et un liseré intermédiaire — la couleur reste reconnaissable d'un coup
 * d'œil, et le texte est toujours foncé, donc la colonne est homogène.
 */
export function StatusBadge({ status }: { status: Pick<Status, 'name' | 'color'> }) {
  const { background, text, border } = badgeColors(status.color);
  return (
    <span
      className="inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: background, color: text, borderColor: border }}
    >
      {status.name}
    </span>
  );
}

/** Repli neutre : une couleur illisible ne doit pas rendre la pastille illisible. */
const NEUTRAL = { background: '#f1f5f9', text: '#334155', border: '#cbd5e1' };

/** Contraste visé entre le texte et le fond — 7:1, le niveau AAA. */
const TARGET_CONTRAST = 7;

/**
 * Décline une teinte en fond, texte et liseré.
 *
 * La lightness du texte n'est pas une constante mais le **résultat d'une
 * recherche** : à lightness HSL égale, un jaune est bien plus lumineux qu'un
 * bleu, donc une valeur fixe tiendrait pour certaines teintes et pas pour
 * d'autres. On assombrit donc jusqu'à atteindre la cible, ce qui la garantit
 * quelle que soit la couleur saisie — y compris un jaune pur ou un blanc.
 */
function badgeColors(color: string): { background: string; text: string; border: string } {
  const hsl = parseHex(color);
  if (!hsl) return NEUTRAL;
  const [h, s] = hsl;

  const background = hslToHex(h, s, 0.94);
  const border = hslToHex(h, s, 0.84);
  // La saturation du texte est bornée : au-delà, un foncé très saturé vire au
  // fluo plutôt qu'à l'encre.
  const textSaturation = Math.min(s, 0.9);

  let lightness = 0.45;
  while (
    lightness > 0.05 &&
    contrast(hslToHex(h, textSaturation, lightness), background) < TARGET_CONTRAST
  ) {
    lightness -= 0.01;
  }

  return { background, text: hslToHex(h, textSaturation, lightness), border };
}

/** `#rrggbb` → teinte et saturation HSL. `null` si la chaîne n'est pas une couleur. */
function parseHex(color: string): [number, number] | null {
  const hex = color.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r
      ? ((g - b) / d + (g < b ? 6 : 0)) / 6
      : max === g
        ? ((b - r) / d + 2) / 6
        : ((r - g) / d + 4) / 6;
  return [h, s];
}

function hslToHex(h: number, s: number, l: number): string {
  const composante = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${composante(0)}${composante(8)}${composante(4)}`;
}

/** Rapport de contraste WCAG entre deux couleurs `#rrggbb`. */
function contrast(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
