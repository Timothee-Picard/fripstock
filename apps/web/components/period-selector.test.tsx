import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const push = vi.fn();
let params = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => params,
}));

const { PeriodSelector } = await import('./period-selector');

function ilYA(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

describe('PeriodSelector', () => {
  beforeEach(() => {
    push.mockClear();
    params = new URLSearchParams();
  });

  it('propose les quatre raccourcis usuels', () => {
    render(<PeriodSelector />);
    for (const label of ['7 jours', '30 jours', '3 mois', '1 an']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('met en avant 30 jours quand rien n’est choisi — c’est le défaut du serveur', () => {
    render(<PeriodSelector />);
    expect(screen.getByRole('button', { name: '30 jours' }).className).toContain('bg-slate-900');
    expect(screen.getByRole('button', { name: '7 jours' }).className).not.toContain('bg-slate-900');
  });

  it('écrit la borne dans l’URL, pour que la vue soit partageable', async () => {
    render(<PeriodSelector />);
    await userEvent.click(screen.getByRole('button', { name: '7 jours' }));
    // `scroll: false` : le sélecteur est au milieu de la page, changer de
    // période ne doit pas renvoyer en haut.
    expect(push).toHaveBeenCalledWith(`/dashboard?from=${ilYA(7)}`, { scroll: false });
  });

  it('met en avant le raccourci actif lu depuis l’URL', () => {
    params = new URLSearchParams({ from: ilYA(90) });
    render(<PeriodSelector />);
    expect(screen.getByRole('button', { name: '3 mois' }).className).toContain('bg-slate-900');
  });

  it('conserve les autres paramètres de l’URL', async () => {
    params = new URLSearchParams({ shopId: 'b1' });
    render(<PeriodSelector />);
    await userEvent.click(screen.getByRole('button', { name: '1 an' }));
    expect(String(push.mock.calls[0][0])).toContain('shopId=b1');
  });
});
