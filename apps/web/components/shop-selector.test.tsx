import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShopSelector } from './shop-selector';
import type { ShopAccess } from '@/lib/types';

const shop = (id: string, name: string): ShopAccess => ({
  shopId: id,
  name,
  allRights: true,
  permissions: [],
});

const deux = [shop('b1', 'Centre-ville'), shop('b2', 'Gare')];

describe('ShopSelector', () => {
  beforeEach(() => localStorage.clear());

  it('ne s’affiche pas avec une seule boutique — il n’y a rien à choisir', () => {
    const { container } = render(<ShopSelector shops={[shop('b1', 'Centre-ville')]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('ne s’affiche pas non plus sans boutique', () => {
    const { container } = render(<ShopSelector shops={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('propose toutes les boutiques dès qu’il y en a deux', () => {
    render(<ShopSelector shops={deux} />);
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Centre-ville',
      'Gare',
    ]);
  });

  it('mémorise le choix pour la prochaine visite', async () => {
    render(<ShopSelector shops={deux} />);
    await userEvent.selectOptions(screen.getByRole('combobox'), 'b2');
    expect(localStorage.getItem('fripstock.activeShop')).toBe('b2');
  });

  it('restaure le choix mémorisé au montage', async () => {
    localStorage.setItem('fripstock.activeShop', 'b2');
    render(<ShopSelector shops={deux} />);
    expect(await screen.findByRole('combobox')).toHaveValue('b2');
  });

  it('ignore un choix mémorisé qui ne correspond plus à aucune boutique', () => {
    localStorage.setItem('fripstock.activeShop', 'boutique-fermee');
    render(<ShopSelector shops={deux} />);
    expect(screen.getByRole('combobox')).toHaveValue('b1');
  });

  it('reste utilisable quand le stockage est bloqué, en navigation privée', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqué');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqué');
    });
    render(<ShopSelector shops={deux} />);
    await userEvent.selectOptions(screen.getByRole('combobox'), 'b2');
    expect(screen.getByRole('combobox')).toHaveValue('b2');
    setItem.mockRestore();
    vi.restoreAllMocks();
  });
});
