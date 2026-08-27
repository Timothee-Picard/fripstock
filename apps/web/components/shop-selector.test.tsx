import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShopAccess } from '@/lib/types';

const push = vi.fn();
let params = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/dashboard',
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
const selecteur = () => screen.getByRole('combobox');

describe('ShopSelector', () => {
  beforeEach(() => {
    push.mockClear();
    params = new URLSearchParams();
  });

  it('ne s’affiche pas avec une seule boutique — il n’y a rien à choisir', () => {
    const { container } = render(<ShopSelector shops={[shop('b1', 'Centre-ville')]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('propose « Toutes les boutiques » en plus de chacune', () => {
    render(<ShopSelector shops={deux} />);
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Toutes les boutiques',
      'Centre-ville',
      'Gare',
    ]);
  });

  it('écrit le choix dans l’URL, pour que le serveur le lise', async () => {
    render(<ShopSelector shops={deux} />);
    await userEvent.selectOptions(selecteur(), 'b2');
    expect(push).toHaveBeenCalledWith('/dashboard?shopId=b2');
  });

  it('retire le paramètre pour « Toutes les boutiques »', async () => {
    params = new URLSearchParams({ shopId: 'b2' });
    render(<ShopSelector shops={deux} />);
    await userEvent.selectOptions(selecteur(), '');
    expect(push).toHaveBeenCalledWith('/dashboard');
  });

  it('reprend la boutique lue dans l’URL', () => {
    params = new URLSearchParams({ shopId: 'b2' });
    render(<ShopSelector shops={deux} />);
    expect(selecteur()).toHaveValue('b2');
  });

  it('conserve les autres paramètres, comme la période', async () => {
    params = new URLSearchParams({ from: '2026-08-01' });
    render(<ShopSelector shops={deux} />);
    await userEvent.selectOptions(selecteur(), 'b1');
    expect(String(push.mock.calls[0][0])).toContain('from=2026-08-01');
  });

  it('repart de la première page : la pagination ne vaut plus', async () => {
    params = new URLSearchParams({ page: '3' });
    render(<ShopSelector shops={deux} />);
    await userEvent.selectOptions(selecteur(), 'b1');
    expect(String(push.mock.calls[0][0])).not.toContain('page=');
  });
});
