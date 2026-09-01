import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { RemovalItem } from '@/lib/types';

vi.mock('./products/actions', () => ({ markRemovalDone: vi.fn() }));

const { Removals } = await import('./removals-card');

const item = (over: Partial<RemovalItem> = {}): RemovalItem => ({
  id: 'p1',
  name: 'Robe rouge',
  reference: 'A-0042',
  soldAt: '2026-08-27T12:00:00.000Z',
  shop: { id: 'b1', name: 'Centre-ville' },
  status: { id: 's4', name: 'Vendu', color: '#10b981', isOnlineSale: false },
  ...over,
});

/** Une liste telle que l'API la rend : bornée, avec son compte réel. */
const liste = (items: RemovalItem[], total = items.length) => ({ items, total });

const enLigne = item({
  id: 'p2',
  name: 'Trench beige',
  status: { id: 's5', name: 'Vendu en ligne', color: '#0ea5e9', isOnlineSale: true },
});

describe('Removals', () => {
  it('ne montre rien quand il n’y a aucune corvée', () => {
    // Une carte vide deviendrait un bandeau permanent qu'on cesse de voir.
    const { container } = render(<Removals toDelist={liste([])} toPull={liste([])} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('ne montre rien non plus sans aucun des deux droits', () => {
    const { container } = render(<Removals />);
    expect(container).toBeEmptyDOMElement();
  });

  it('sépare les annonces à dépublier des vêtements à décrocher', () => {
    render(<Removals toDelist={liste([item()])} toPull={liste([enLigne])} />);
    expect(screen.getByText('Annonces à retirer du site')).toBeInTheDocument();
    expect(screen.getByText('Vêtements à décrocher')).toBeInTheDocument();
  });

  it('ne montre que sa liste à qui n’a qu’un des deux droits', () => {
    render(<Removals toDelist={liste([item()])} />);
    expect(screen.getByText('Annonces à retirer du site')).toBeInTheDocument();
    expect(screen.queryByText('Vêtements à décrocher')).not.toBeInTheDocument();
  });

  it('compte les corvées, pour savoir sans lire', () => {
    render(<Removals toDelist={liste([item(), item({ id: 'p3' })])} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('porte le statut de chaque article : c’est lui qui explique le geste', () => {
    render(<Removals toDelist={liste([item()])} toPull={liste([enLigne])} />);
    expect(screen.getByText('Vendu')).toBeInTheDocument();
    expect(screen.getByText('Vendu en ligne')).toBeInTheDocument();
  });

  it('mène à la fiche et propose de solder la corvée', () => {
    render(<Removals toDelist={liste([item()])} />);
    expect(screen.getByRole('link', { name: 'Robe rouge' })).toHaveAttribute(
      'href',
      '/dashboard/products/p1',
    );
    expect(screen.getByRole('button', { name: 'Retrait effectué' })).toBeInTheDocument();
  });

  it('date la vente dans le fuseau de la boutique', () => {
    render(<Removals toDelist={liste([item()])} />);
    expect(screen.getByText('vendu le 27/08/2026')).toBeInTheDocument();
  });

  describe('quand il y en a beaucoup', () => {
    const beaucoup = (n: number) =>
      Array.from({ length: n }, (_, i) => item({ id: `p${i}`, name: `Article ${i}` }));

    it('n’affiche que ce que l’API a renvoyé, sans rien déplier', () => {
      // Le tableau de bord ne charge que les cinq derniers : proposer d'en
      // afficher plus obligerait à ramener la liste entière à chaque ouverture.
      render(<Removals toDelist={liste(beaucoup(5), 30)} />);
      expect(screen.getAllByRole('link', { name: /^Article / })).toHaveLength(5);
      expect(screen.queryByRole('button', { name: /Afficher/ })).not.toBeInTheDocument();
    });

    it('compte le total, pas ce qui est affiché', () => {
      render(<Removals toDelist={liste(beaucoup(5), 30)} />);
      expect(screen.getByText('30')).toBeInTheDocument();
    });

    it('dit combien sont montrés quand il en reste', () => {
      // « 5 » tout court se lirait comme « il n'en reste que cinq ».
      render(<Removals toDelist={liste(beaucoup(5), 30)} />);
      expect(screen.getByText(/5 sur 30/)).toBeInTheDocument();
    });

    it('ne le dit pas quand la liste est complète', () => {
      render(<Removals toDelist={liste(beaucoup(3))} />);
      expect(screen.queryByText(/sur 3/)).not.toBeInTheDocument();
    });

    it('renvoie vers la liste complète, seule à tout porter', () => {
      render(<Removals toDelist={liste(beaucoup(5), 30)} />);
      expect(screen.getByRole('link', { name: 'Voir la liste complète' })).toHaveAttribute(
        'href',
        '/dashboard/removals',
      );
    });

    it('ne propose aucune action groupée : elle vit sur la liste complète', () => {
      // Solder d'un coup se fait par endroit où aller, ce que seul l'écran des
      // retraits sait présenter.
      render(<Removals toDelist={liste(beaucoup(5), 30)} />);
      expect(screen.queryByRole('button', { name: /Tout / })).not.toBeInTheDocument();
    });
  });
});
