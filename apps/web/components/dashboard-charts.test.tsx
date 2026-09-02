import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Dashboard } from '@/lib/types';

// recharts ne dessine rien dans un conteneur de taille nulle, ce que jsdom
// renvoie toujours : on lui impose des dimensions pour que le SVG existe.
vi.mock('recharts', async () => {
  const recharts = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...recharts,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <recharts.ResponsiveContainer width={600} height={300}>
        {children as React.ReactElement}
      </recharts.ResponsiveContainer>
    ),
  };
});

const { AttributeBars, CategoryBars, RotationBars, SalesCurve, StockPie } =
  await import('./dashboard-charts');

const byDay: NonNullable<Dashboard['byDay']> = [
  { day: '2026-08-10', revenue: 30, count: 2 },
  { day: '2026-08-11', revenue: 50, count: 1 },
];

const categories: NonNullable<Dashboard['topCategories']> = [
  { id: 'c1', name: 'Robe', revenue: 80, count: 3 },
  { id: 'c2', name: 'Sac', revenue: 20, count: 1 },
];

const byStatus: NonNullable<Dashboard['stock']>['byStatus'] = [
  { id: 's1', name: 'En stock', color: '#111111', leavesStock: false, count: 4, value: 100 },
  { id: 's2', name: 'Vendu', color: '#222222', leavesStock: true, count: 2, value: 60 },
];

const rotation: NonNullable<Dashboard['rotation']> = {
  count: 4,
  averageDays: 18.5,
  medianDays: 12,
  buckets: [
    { from: 0, to: 7, count: 1 },
    { from: 7, to: 14, count: 2 },
    { from: 14, to: 30, count: 0 },
    { from: 30, to: 60, count: 0 },
    { from: 60, to: 90, count: 0 },
    { from: 90, to: null, count: 1 },
  ],
};

const couleur: NonNullable<Dashboard['topAttributes']>[number] = {
  id: 'a1',
  name: 'Couleur',
  type: 'SELECT',
  values: [
    { value: 'Rouge', revenue: 70, count: 5 },
    { value: 'Bleu', revenue: 50, count: 2 },
  ],
};

describe('SalesCurve', () => {
  it('trace un point par jour vendu', () => {
    const { container } = render(<SalesCurve data={byDay} />);
    // Un point par jour : c'est ce qui manquait quand la clé ne correspondait
    // plus aux données, le graphique restait vide sans rien signaler.
    expect(container.querySelectorAll('.recharts-line-dot').length).toBe(byDay.length);
  });

  it('date l’axe horizontal en jour/mois', () => {
    render(<SalesCurve data={byDay} />);
    expect(screen.getByText('10/08')).toBeInTheDocument();
    expect(screen.getByText('11/08')).toBeInTheDocument();
  });

  it('le dit plutôt que d’afficher une courbe vide', () => {
    render(<SalesCurve data={[]} />);
    expect(screen.getByText('Aucune vente sur la période.')).toBeInTheDocument();
  });
});

describe('CategoryBars', () => {
  it('trace une barre par catégorie', () => {
    const { container } = render(<CategoryBars data={categories} />);
    expect(container.querySelectorAll('.recharts-bar-rectangle').length).toBe(categories.length);
  });

  it('nomme les catégories sur l’axe', () => {
    const { container } = render(<CategoryBars data={categories} />);
    // Les <text> du SVG, et non `getByText` : recharts garde aussi un span de
    // mesure hors écran qui porte les mêmes libellés.
    const libelles = [...container.querySelectorAll('text')].map((t) => t.textContent);
    expect(libelles).toContain('Robe');
    expect(libelles).toContain('Sac');
  });

  it('le dit quand rien n’a été vendu', () => {
    render(<CategoryBars data={[]} />);
    expect(screen.getByText('Aucune vente sur la période.')).toBeInTheDocument();
  });
});

describe('StockPie', () => {
  const parts = (container: HTMLElement) =>
    container.querySelectorAll('.recharts-pie-sector').length;

  it('trace une part par statut', () => {
    const { container } = render(<StockPie data={byStatus} />);
    expect(parts(container)).toBe(byStatus.length);
  });

  it('reprend les couleurs choisies par le gérant pour ses statuts', () => {
    const { container } = render(<StockPie data={byStatus} />);
    expect(container.innerHTML).toContain('#111111');
    expect(container.innerHTML).toContain('#222222');
  });

  it('écarte les statuts sans aucun article', () => {
    const { container } = render(<StockPie data={[byStatus[0], { ...byStatus[1], count: 0 }]} />);
    expect(parts(container)).toBe(1);
  });

  it('le dit quand le stock est vide', () => {
    render(<StockPie data={[]} />);
    expect(screen.getByText('Aucun produit en stock.')).toBeInTheDocument();
  });
});

describe('RotationBars', () => {
  it('annonce la moyenne et la médiane en toutes lettres', () => {
    render(<RotationBars data={rotation} />);
    expect(screen.getByText('18,5 j')).toBeInTheDocument();
    expect(screen.getByText('12 j')).toBeInTheDocument();
  });

  it('trace une barre par tranche et nomme la dernière comme ouverte', () => {
    const { container } = render(<RotationBars data={rotation} />);
    // recharts ne dessine que les barres non nulles : les tranches vides sont
    // sur l'axe, pas dans le SVG.
    expect(container.querySelectorAll('.recharts-bar-rectangle').length).toBe(
      rotation.buckets.filter((b) => b.count > 0).length,
    );
    const libelles = [...container.querySelectorAll('text')].map((t) => t.textContent);
    expect(libelles).toContain('≤ 7 j');
    expect(libelles).toContain('7 à 14 j');
    expect(libelles).toContain('90 j et +');
  });

  it('le dit quand rien n’a été vendu', () => {
    render(<RotationBars data={{ ...rotation, count: 0 }} />);
    expect(screen.getByText('Aucune vente sur la période.')).toBeInTheDocument();
  });
});

describe('AttributeBars', () => {
  it('trace une barre par valeur et les nomme', () => {
    const { container } = render(<AttributeBars data={couleur} />);
    expect(container.querySelectorAll('.recharts-bar-rectangle').length).toBe(2);
    const libelles = [...container.querySelectorAll('text')].map((t) => t.textContent);
    expect(libelles).toContain('Rouge');
    expect(libelles).toContain('Bleu');
  });

  it('mesure l’axe en nombre d’articles, pas en euros', () => {
    const { container } = render(<AttributeBars data={couleur} />);
    const graduations = [...container.querySelectorAll('text')]
      .map((t) => Number(t.textContent))
      .filter((n) => !Number.isNaN(n));
    // Cinq articles au plus : l'axe s'arrête juste au-dessus. S'il portait le
    // chiffre d'affaires, il monterait à 70.
    expect(Math.max(...graduations)).toBeLessThan(10);
  });

  it('distingue « pas de vente » de « attribut jamais renseigné »', () => {
    render(<AttributeBars data={{ ...couleur, values: [] }} />);
    expect(
      screen.getByText('Aucune vente renseignant cet attribut sur la période.'),
    ).toBeInTheDocument();
  });
});
