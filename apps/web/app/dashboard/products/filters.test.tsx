import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Category, Depositor, Shop, Status } from '@/lib/types';

const push = vi.fn();
let params = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => params,
}));

const { Filters } = await import('./filters');

const shops = [{ id: 'b1', name: 'Centre-ville' }] as Shop[];
const categories = [{ id: 'c1', name: 'Sac' }] as Category[];
const statuses = [{ id: 's1', name: 'En stock' }] as Status[];
const depositors = [{ id: 'd1', lastName: 'Martin', firstName: 'Sophie' }] as Depositor[];

function rendre(clients: Depositor[] = depositors) {
  return render(
    <Filters shops={shops} categories={categories} statuses={statuses} depositors={clients} />,
  );
}

/** Paramètres de la dernière URL poussée. */
function derniereUrl() {
  return new URLSearchParams(String(push.mock.calls.at(-1)?.[0]).split('?')[1]);
}

describe('Filters', () => {
  beforeEach(() => {
    push.mockClear();
    params = new URLSearchParams();
  });

  it('cherche sur validation du formulaire', async () => {
    rendre();
    await userEvent.type(screen.getByPlaceholderText('Nom, référence…'), 'bott{Enter}');
    expect(derniereUrl().get('search')).toBe('bott');
  });

  it('filtre par client déposant', async () => {
    rendre();
    await userEvent.selectOptions(screen.getByLabelText('Déposant'), 'd1');
    expect(derniereUrl().get('depositorId')).toBe('d1');
  });

  it('cache le filtre déposant à qui n’a pas le droit de les consulter', () => {
    rendre([]);
    expect(screen.queryByLabelText('Déposant')).toBeNull();
  });

  it('filtre par boutique', async () => {
    rendre();
    await userEvent.selectOptions(screen.getByLabelText('Boutique'), 'b1');
    expect(derniereUrl().get('shopId')).toBe('b1');
  });

  it('isole le stock central sans le confondre avec une boutique', async () => {
    rendre();
    await userEvent.selectOptions(screen.getByLabelText('Boutique'), '__central');
    const url = derniereUrl();
    expect(url.get('unassigned')).toBe('true');
    expect(url.get('shopId')).toBeNull();
  });

  it('revient au filtre vide quand on choisit « Toutes »', async () => {
    params = new URLSearchParams({ shopId: 'b1' });
    rendre();
    await userEvent.selectOptions(screen.getByLabelText('Boutique'), '');
    const url = derniereUrl();
    expect(url.get('shopId')).toBeNull();
    expect(url.get('unassigned')).toBeNull();
  });

  it('filtre par catégorie et par statut', async () => {
    rendre();
    await userEvent.selectOptions(screen.getByLabelText('Catégorie'), 'c1');
    expect(derniereUrl().get('categoryId')).toBe('c1');

    await userEvent.selectOptions(screen.getByLabelText('Statut'), 's1');
    expect(derniereUrl().get('statusId')).toBe('s1');
  });

  it('filtre par mode de vente avec les valeurs de l’API', async () => {
    rendre();
    await userEvent.selectOptions(screen.getByLabelText('Type de vente'), 'CONSIGNMENT');
    expect(derniereUrl().get('saleType')).toBe('CONSIGNMENT');
  });

  it('repart de la première page à chaque changement de filtre', async () => {
    params = new URLSearchParams({ page: '3' });
    rendre();
    await userEvent.selectOptions(screen.getByLabelText('Catégorie'), 'c1');
    expect(derniereUrl().get('page')).toBeNull();
  });

  it('reprend les filtres déjà présents dans l’URL', () => {
    params = new URLSearchParams({ search: 'bott', shopId: 'b1', categoryId: 'c1' });
    rendre();
    expect(screen.getByPlaceholderText('Nom, référence…')).toHaveValue('bott');
    expect(screen.getByLabelText('Boutique')).toHaveValue('b1');
    expect(screen.getByLabelText('Catégorie')).toHaveValue('c1');
  });

  it('conserve les autres filtres en changeant l’un d’eux', async () => {
    params = new URLSearchParams({ search: 'bott' });
    rendre();
    await userEvent.selectOptions(screen.getByLabelText('Catégorie'), 'c1');
    expect(derniereUrl().get('search')).toBe('bott');
  });
});
