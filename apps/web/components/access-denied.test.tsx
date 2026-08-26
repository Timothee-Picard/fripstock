import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const { AccessDenied } = await import('./access-denied');

describe('AccessDenied', () => {
  it('nomme ce à quoi l’accès est refusé', () => {
    render(<AccessDenied what="Contrats de dépôt" permission="deposits.manage" />);
    expect(screen.getByText('Contrats de dépôt')).toBeInTheDocument();
  });

  it('affiche le libellé lisible de la permission, pas sa clé technique', () => {
    render(<AccessDenied what="Déposants" permission="depositors.manage" />);
    expect(screen.getByText(/Gérer les déposants/)).toBeInTheDocument();
    expect(screen.queryByText(/depositors\.manage/)).not.toBeInTheDocument();
  });

  it('renvoie vers un écran encore accessible', () => {
    render(<AccessDenied what="Produits" permission="products.view" />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/dashboard');
  });
});
