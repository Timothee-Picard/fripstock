import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from './status-badge';

/** Les six couleurs posées à la création d'une entreprise (BASE_STATUSES côté API). */
const BASE = ['#6b7280', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444'];

/** `rgb(1, 2, 3)` — ce que jsdom rend d'un style inline — en canaux 0–1. */
function canaux(css: string): [number, number, number] {
  const m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(css);
  if (!m) throw new Error(`couleur illisible : ${css}`);
  return [Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255];
}

function luminance(css: string): number {
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = canaux(css).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Rapport de contraste WCAG du texte de la pastille sur son fond. */
function contraste(element: HTMLElement): number {
  const [a, b] = [luminance(element.style.color), luminance(element.style.backgroundColor)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function pastille(color: string, name = 'x'): HTMLElement {
  render(<StatusBadge status={{ name, color }} />);
  return screen.getByText(name);
}

describe('StatusBadge', () => {
  it('affiche le libellé choisi par le gérant', () => {
    render(<StatusBadge status={{ name: 'En rayon', color: '#3b82f6' }} />);
    expect(screen.getByText('En rayon')).toBeInTheDocument();
  });

  // Le cœur du composant : la garantie, pas une valeur en dur. Le jeu de base
  // tombait entre 4,2 et 4,8 pour 1 avec l'aplat saturé qui a précédé.
  it.each(BASE)('atteint AAA (7:1) sur la couleur de base %s', (color) => {
    expect(contraste(pastille(color))).toBeGreaterThanOrEqual(7);
  });

  // Une lightness fixe suffirait pour un bleu et pas pour un jaune : à valeur
  // HSL égale, les teintes n'ont pas la même luminance. D'où la recherche.
  it.each(['#ffff00', '#00ffff', '#00ff00', '#ffffff', '#000000'])(
    'tient aussi sur une teinte extrême (%s)',
    (color) => {
      expect(contraste(pastille(color))).toBeGreaterThanOrEqual(7);
    },
  );

  it('garde la teinte reconnaissable : deux statuts ne se confondent pas', () => {
    const rouge = pastille('#ef4444', 'rouge');
    const bleu = pastille('#3b82f6', 'bleu');
    expect(rouge.style.backgroundColor).not.toBe(bleu.style.backgroundColor);
    // Le fond d'un rouge penche vers le rouge, celui d'un bleu vers le bleu.
    expect(canaux(rouge.style.backgroundColor)[0]).toBeGreaterThan(
      canaux(rouge.style.backgroundColor)[2],
    );
    expect(canaux(bleu.style.backgroundColor)[2]).toBeGreaterThan(
      canaux(bleu.style.backgroundColor)[0],
    );
  });

  it('écrit toujours en foncé sur clair, pour que la colonne reste homogène', () => {
    for (const color of BASE) {
      const p = pastille(color, `s-${color}`);
      expect(luminance(p.style.color)).toBeLessThan(luminance(p.style.backgroundColor));
    }
  });

  it('reste lisible si la couleur est mal formée', () => {
    expect(contraste(pastille('rouge', 'cassé'))).toBeGreaterThanOrEqual(7);
  });

  it('ne coupe pas un libellé en deux lignes', () => {
    render(<StatusBadge status={{ name: 'Rendu au client', color: '#8b5cf6' }} />);
    expect(screen.getByText('Rendu au client').className).toContain('whitespace-nowrap');
  });
});
