import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NavEntry } from '@/lib/navigation';
import type { Session } from '@/lib/types';

let pathname = '/dashboard';

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}));
vi.mock('@/app/(auth)/actions', () => ({ logout: vi.fn() }));

const { Sidebar } = await import('./sidebar');

const session = {
  firstName: 'Camille',
  lastName: 'Durand',
  isManager: true,
  company: { name: 'Friperie Démo' },
  shops: [],
} as unknown as Session;

const entries: NavEntry[] = [
  { href: '/dashboard', label: 'Tableau de bord', icon: 'dashboard' },
  { href: '/dashboard/products', label: 'Produits', icon: 'products' },
];

function rendre(collapsed = false) {
  return render(<Sidebar session={session} entries={entries} initialCollapsed={collapsed} />);
}

describe('Sidebar', () => {
  beforeEach(() => {
    pathname = '/dashboard';
    document.cookie = 'fripstock_sidebar=; path=/; max-age=0';
  });

  it('mène au profil depuis le nom, plutôt que par une entrée de menu', () => {
    rendre();
    const lien = screen.getByTitle('Camille Durand — mon profil');
    expect(lien).toHaveAttribute('href', '/dashboard/profile');
    expect(screen.queryByText('Mon profil')).toBeNull();
  });

  it('porte la déconnexion, et laisse les alertes à l’en-tête', () => {
    rendre();
    expect(screen.getByLabelText('Déconnexion')).toBeInTheDocument();
    // Les alertes concernent la page, pas la navigation.
    expect(screen.queryByLabelText('Notifications')).toBeNull();
  });

  it('range l’identité en bas, après les sections', () => {
    const { container } = rendre();
    const liens = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(liens.at(-1)).toBe('/dashboard/profile');
  });

  it('masque les libellés une fois replié, et garde les repères', () => {
    rendre(true);
    expect(screen.queryByText('Produits')).toBeNull();
    // Le titre reste le seul moyen de nommer une icône seule.
    expect(screen.getByTitle('Produits')).toBeInTheDocument();
    expect(screen.getByTitle('Camille Durand — mon profil')).toBeInTheDocument();
  });

  it('replie au clic et retient le choix dans un cookie', async () => {
    rendre();
    await userEvent.click(screen.getByLabelText('Replier le menu'));
    expect(screen.queryByText('Produits')).toBeNull();
    expect(document.cookie).toContain('fripstock_sidebar=1');
  });

  it('déplie de nouveau, et l’écrit aussi', async () => {
    rendre(true);
    await userEvent.click(screen.getByLabelText('Déplier le menu'));
    expect(screen.getByText('Produits')).toBeInTheDocument();
    expect(document.cookie).toContain('fripstock_sidebar=0');
  });

  it('marque la section courante', () => {
    pathname = '/dashboard/products';
    rendre();
    expect(screen.getByTitle('Produits')).toHaveAttribute('aria-current', 'page');
  });

  it('ne garde pas le tableau de bord actif sur les autres écrans', () => {
    // `/dashboard` préfixe toutes les routes : sans égalité stricte, deux
    // entrées seraient actives à la fois.
    pathname = '/dashboard/products';
    rendre();
    expect(screen.getByTitle('Tableau de bord')).not.toHaveAttribute('aria-current');
  });

  it('reste actif sur une sous-page de la section', () => {
    pathname = '/dashboard/products/abc/edit';
    rendre();
    expect(screen.getByTitle('Produits')).toHaveAttribute('aria-current', 'page');
  });
});
