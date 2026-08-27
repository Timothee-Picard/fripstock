import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const push = vi.fn();
let params = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => params,
}));

const { SortableHeader } = await import('./sortable-header');

function rendre() {
  return render(
    <table>
      <thead>
        <tr>
          <SortableHeader field="salePrice">Prix</SortableHeader>
        </tr>
      </thead>
    </table>,
  );
}

/** Paramètres de la dernière URL poussée. */
function derniereUrl() {
  return new URLSearchParams(String(push.mock.calls.at(-1)?.[0]).split('?')[1]);
}

describe('SortableHeader', () => {
  beforeEach(() => {
    push.mockClear();
    params = new URLSearchParams();
  });

  it('trie en croissant au premier clic', async () => {
    rendre();
    await userEvent.click(screen.getByRole('button', { name: /Prix/ }));
    expect(derniereUrl().get('sort')).toBe('salePrice');
    expect(derniereUrl().get('direction')).toBe('asc');
  });

  it('inverse le sens au second clic sur la même colonne', async () => {
    params = new URLSearchParams({ sort: 'salePrice', direction: 'asc' });
    rendre();
    await userEvent.click(screen.getByRole('button', { name: /Prix/ }));
    expect(derniereUrl().get('direction')).toBe('desc');
  });

  it('repart du croissant quand on change de colonne', async () => {
    params = new URLSearchParams({ sort: 'reference', direction: 'desc' });
    rendre();
    await userEvent.click(screen.getByRole('button', { name: /Prix/ }));
    expect(derniereUrl().get('direction')).toBe('asc');
  });

  it('revient à la première page : trier change ce qu’elle contient', async () => {
    params = new URLSearchParams({ page: '4' });
    rendre();
    await userEvent.click(screen.getByRole('button', { name: /Prix/ }));
    expect(derniereUrl().get('page')).toBeNull();
  });

  it('annonce le sens courant aux lecteurs d’écran', () => {
    params = new URLSearchParams({ sort: 'salePrice', direction: 'desc' });
    rendre();
    expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'descending');
  });

  it('n’annonce aucun tri sur une colonne inactive', () => {
    rendre();
    expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'none');
  });
});
