import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NavEntry } from '@/lib/navigation';
import type { Session } from '@/lib/types';

let pathname = '/dashboard';

vi.mock('next/navigation', () => ({ usePathname: () => pathname }));
vi.mock('@/app/(auth)/actions', () => ({ logout: vi.fn() }));

const { MobileNav } = await import('./mobile-nav');

const session = {
  firstName: 'Camille',
  lastName: 'Durand',
  isManager: true,
  company: { name: 'Friperie Démo' },
} as unknown as Session;

const entries: NavEntry[] = [
  { href: '/dashboard', label: 'Tableau de bord', icon: 'dashboard' },
  { href: '/dashboard/products', label: 'Produits', icon: 'products' },
];

const rendre = () => render(<MobileNav session={session} entries={entries} />);
const ouvrir = () => userEvent.click(screen.getByLabelText('Ouvrir le menu'));

describe('MobileNav', () => {
  beforeEach(() => {
    pathname = '/dashboard';
  });

  it('reste fermé tant qu’on ne le demande pas', () => {
    rendre();
    expect(screen.queryByText('Produits')).toBeNull();
  });

  it('ouvre la navigation, seule façon de changer d’écran sur mobile', async () => {
    rendre();
    await ouvrir();
    expect(screen.getByText('Produits')).toBeInTheDocument();
    expect(screen.getByText('Déconnexion')).toBeInTheDocument();
  });

  it('se ferme au choix d’une section', async () => {
    rendre();
    await ouvrir();
    // Le panneau recouvre la page : le laisser ouvert masquerait l'écran
    // qu'on vient de demander.
    await userEvent.click(screen.getByText('Produits'));
    expect(screen.queryByText('Produits')).toBeNull();
  });

  it('se ferme au toucher à côté', async () => {
    rendre();
    await ouvrir();
    await userEvent.click(screen.getAllByLabelText('Fermer le menu')[0]);
    expect(screen.queryByText('Produits')).toBeNull();
  });

  it('se ferme aussi depuis le profil', async () => {
    rendre();
    await ouvrir();
    await userEvent.click(screen.getByText('Camille Durand'));
    expect(screen.queryByText('Camille Durand')).toBeNull();
  });

  it('marque la section courante', async () => {
    pathname = '/dashboard/products';
    rendre();
    await ouvrir();
    expect(screen.getByText('Produits').closest('a')).toHaveAttribute('aria-current', 'page');
  });

  it('ne montre que les entrées reçues, déjà filtrées par les permissions', async () => {
    rendre();
    await ouvrir();
    expect(screen.queryByText('Utilisateurs')).toBeNull();
  });
});
