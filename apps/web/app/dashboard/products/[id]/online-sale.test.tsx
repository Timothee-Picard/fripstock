import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Product, Status } from '@/lib/types';

vi.mock('../actions', () => ({ setOnline: vi.fn(), markRemovalDone: vi.fn() }));

const { OnlineSale, PendingRemoval } = await import('./online-sale');

const status = (over: Partial<Status> = {}): Status =>
  ({
    id: 's1',
    name: 'En rayon',
    color: '#3b82f6',
    isSale: false,
    blocksSale: false,
    leavesStock: false,
    isOnlineSale: false,
    ...over,
  }) as Status;

const product = (over: Partial<Product> = {}): Product =>
  ({
    id: 'p1',
    name: 'Robe rouge',
    salePrice: '30',
    onlinePrice: null,
    isOnline: false,
    pendingRemoval: false,
    status: status(),
    ...over,
  }) as Product;

describe('OnlineSale', () => {
  it('propose de mettre en ligne un article qui ne l’est pas', () => {
    render(<OnlineSale product={product()} editable />);
    expect(screen.getByRole('button', { name: 'Mettre en ligne' })).toBeEnabled();
  });

  it('annonce le prix boutique quand aucun prix web n’est fixé', () => {
    // Le champ vide n'est pas un oubli : c'est la façon de dire « même prix ».
    render(<OnlineSale product={product({ isOnline: true })} editable />);
    expect(screen.getByText(/30,00\s*€.*prix boutique/)).toBeInTheDocument();
  });

  it('annonce le prix web dès qu’il diffère', () => {
    render(<OnlineSale product={product({ isOnline: true, onlinePrice: '25' })} editable />);
    // La mention « prix boutique » disparaît de la phrase — l'étiquette du
    // champ la garde, elle, pour expliquer ce que vaut un champ vide.
    expect(screen.getByText(/Proposé sur le site à 25,00\s*€\.$/)).toBeInTheDocument();
  });

  it('interdit de publier un article sorti du stock', () => {
    // C'est le flag qui décide, pas le libellé : l'annoncer ferait vendre ce
    // qu'on n'a plus.
    const parti = product({ status: status({ name: 'Vendu', isSale: true, leavesStock: true }) });
    render(<OnlineSale product={parti} editable />);
    expect(screen.getByRole('button', { name: 'Mettre en ligne' })).toBeDisabled();
  });

  it('laisse dépublier un article déjà parti : la corvée reste à faire', () => {
    const parti = product({
      isOnline: true,
      status: status({ name: 'Vendu', isSale: true, leavesStock: true }),
    });
    render(<OnlineSale product={parti} editable />);
    expect(screen.getByRole('button', { name: 'Retirer du site' })).toBeEnabled();
  });

  it('sans le droit, montre l’état mais n’offre aucun bouton', () => {
    // Masquer l'information ferait croire que l'article n'est pas en ligne.
    render(<OnlineSale product={product({ isOnline: true })} editable={false} />);
    expect(screen.getByText(/En ligne à/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText(/Gérer la vente en ligne/)).toBeInTheDocument();
  });
});

describe('PendingRemoval', () => {
  it('ne s’affiche pas quand il n’y a rien à retirer', () => {
    const { container } = render(<PendingRemoval product={product()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('après une vente en boutique, envoie dépublier l’annonce', () => {
    const vendu = product({
      pendingRemoval: true,
      status: status({ name: 'Vendu', isSale: true, leavesStock: true }),
    });
    render(<PendingRemoval product={vendu} />);
    expect(screen.getByText(/l'annonce est encore en ligne/i)).toBeInTheDocument();
  });

  it('après une vente en ligne, envoie décrocher le vêtement', () => {
    // Le sens se lit sur `isOnlineSale`, jamais sur le libellé du statut.
    const vendu = product({
      pendingRemoval: true,
      status: status({
        name: 'Vendu en ligne',
        isSale: true,
        leavesStock: true,
        isOnlineSale: true,
      }),
    });
    render(<PendingRemoval product={vendu} />);
    expect(screen.getByText(/encore en boutique/i)).toBeInTheDocument();
  });
});
