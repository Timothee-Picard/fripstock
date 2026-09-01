import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShopAccess } from '@/lib/types';

const push = vi.fn();
let params = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => params,
}));

const { ShopSelector } = await import('./shop-selector');

const shop = (id: string, name: string): ShopAccess => ({
  shopId: id,
  name,
  allRights: true,
  permissions: [],
});

const deux = [shop('b1', 'Centre-ville'), shop('b2', 'Gare')];
const choix = (nom: string) => screen.getByRole('button', { name: nom });

describe('ShopSelector', () => {
  beforeEach(() => {
    push.mockClear();
    params = new URLSearchParams();
  });

  it('ne s’affiche pas avec une seule boutique — il n’y a rien à choisir', () => {
    const { container } = render(
      <ShopSelector shops={[shop('b1', 'Centre-ville')]} canSeeOnline={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('propose « Tout » en plus de chacune', () => {
    render(<ShopSelector shops={deux} canSeeOnline={false} />);
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Tout',
      'Centre-ville',
      'Gare',
    ]);
  });

  it('dit ce que la boutique choisie commande, pour qu’on ne le devine pas', () => {
    render(<ShopSelector shops={deux} canSeeOnline={false} />);
    expect(
      screen.getByText(/recette du jour, vente rapide, statistiques et retraits/i),
    ).toBeInTheDocument();
  });

  it('écrit le choix dans l’URL, pour que le serveur le lise', async () => {
    render(<ShopSelector shops={deux} canSeeOnline={false} />);
    await userEvent.click(choix('Gare'));
    expect(push).toHaveBeenCalledWith('/dashboard?shopId=b2', { scroll: false });
  });

  it('retire le paramètre pour « Tout »', async () => {
    params = new URLSearchParams({ shopId: 'b2' });
    render(<ShopSelector shops={deux} canSeeOnline={false} />);
    await userEvent.click(choix('Tout'));
    expect(push).toHaveBeenCalledWith('/dashboard', { scroll: false });
  });

  it('marque la boutique lue dans l’URL', () => {
    params = new URLSearchParams({ shopId: 'b2' });
    render(<ShopSelector shops={deux} canSeeOnline={false} />);
    expect(choix('Gare')).toHaveAttribute('aria-pressed', 'true');
    expect(choix('Tout')).toHaveAttribute('aria-pressed', 'false');
  });

  it('conserve les autres paramètres, comme la période', async () => {
    params = new URLSearchParams({ from: '2026-08-01' });
    render(<ShopSelector shops={deux} canSeeOnline={false} />);
    await userEvent.click(choix('Centre-ville'));
    expect(String(push.mock.calls[0][0])).toContain('from=2026-08-01');
  });

  it('ramène toujours au tableau de bord : il ne gouverne que cet écran', async () => {
    render(<ShopSelector shops={deux} canSeeOnline={false} />);
    await userEvent.click(choix('Centre-ville'));
    expect(String(push.mock.calls[0][0]).startsWith('/dashboard')).toBe(true);
  });

  describe('boutique en ligne', () => {
    it('l’ajoute en dernier, après les boutiques physiques', () => {
      // C'est un point de vente de plus, pas une catégorie à part.
      render(<ShopSelector shops={deux} canSeeOnline />);
      expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
        'Tout',
        'Centre-ville',
        'Gare',
        'En ligne',
      ]);
    });

    it('ne la propose pas à qui n’y a pas affaire', () => {
      render(<ShopSelector shops={deux} canSeeOnline={false} />);
      expect(screen.queryByRole('button', { name: 'En ligne' })).not.toBeInTheDocument();
    });

    it('s’affiche pour elle seule, même sans deuxième boutique', () => {
      render(<ShopSelector shops={[shop('b1', 'Centre-ville')]} canSeeOnline />);
      expect(screen.getByRole('button', { name: 'En ligne' })).toBeInTheDocument();
    });

    it('écrit le canal plutôt qu’une boutique', async () => {
      render(<ShopSelector shops={deux} canSeeOnline />);
      await userEvent.click(choix('En ligne'));
      expect(push).toHaveBeenCalledWith('/dashboard?channel=online', { scroll: false });
    });

    it('les deux ne coexistent jamais : on regarde un endroit à la fois', async () => {
      params = new URLSearchParams({ shopId: 'b2' });
      render(<ShopSelector shops={deux} canSeeOnline />);
      await userEvent.click(choix('En ligne'));
      const url = String(push.mock.calls[0][0]);
      expect(url).toContain('channel=online');
      expect(url).not.toContain('shopId');
    });

    it('revenir à une boutique efface le canal', async () => {
      params = new URLSearchParams({ channel: 'online' });
      render(<ShopSelector shops={deux} canSeeOnline />);
      await userEvent.click(choix('Gare'));
      const url = String(push.mock.calls[0][0]);
      expect(url).toContain('shopId=b2');
      expect(url).not.toContain('channel');
    });

    it('se reconnaît comme active depuis l’URL', () => {
      params = new URLSearchParams({ channel: 'online' });
      render(<ShopSelector shops={deux} canSeeOnline />);
      expect(choix('En ligne')).toHaveAttribute('aria-pressed', 'true');
      expect(choix('Tout')).toHaveAttribute('aria-pressed', 'false');
    });
  });
});
