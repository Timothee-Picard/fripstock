import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProductSummary } from '@/lib/types';

const sellBasket = vi.fn();
vi.mock('./products/actions', () => ({ sellBasket }));

const { Counter } = await import('./counter');

const article = (over: Partial<ProductSummary> = {}): ProductSummary =>
  ({
    id: 'p1',
    reference: 'A-0042',
    name: 'Veste en jean',
    photoUrl: null,
    salePrice: '32',
    soldPrice: null,
    quantity: 1,
    saleType: 'RESALE',
    soldAt: null,
    createdAt: '',
    depositContractId: null,
    category: { id: 'c1', name: 'Manteau' },
    shop: { id: 'b1', name: 'Centre-ville' },
    status: {
      id: 's1',
      name: 'En rayon',
      color: '#111',
      position: 1,
      isDefault: false,
      isSale: false,
      blocksSale: false,
      leavesStock: false,
      positionX: null,
      positionY: null,
      flowDefined: false,
      allowedTargets: [],
    },
    ...over,
  }) as ProductSummary;

const BOUTIQUE = { shopId: 'b1', shopName: 'Centre-ville' };

/** Réponse de la recherche du comptoir. */
function trouve(...produits: ProductSummary[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(produits) }),
  );
}

const champ = () => screen.getByLabelText("Référence ou nom de l'article");

async function ajouter(terme: string) {
  await userEvent.clear(champ());
  await userEvent.type(champ(), `${terme}{Enter}`);
}

describe('Counter', () => {
  beforeEach(() => {
    sellBasket.mockReset().mockResolvedValue({});
    trouve();
  });

  it('ouvre avec le curseur dans le champ — le client attend', () => {
    render(<Counter {...BOUTIQUE} />);
    expect(champ()).toHaveFocus();
  });

  it('ajoute directement l’article dont la référence correspond exactement', async () => {
    trouve(article());
    render(<Counter {...BOUTIQUE} />);
    await ajouter('A-0042');
    expect(await screen.findByText('Veste en jean')).toBeInTheDocument();
    // Pas de liste à cliquer : l'article est entré tout seul.
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('reconnaît la référence quelle que soit la casse', async () => {
    trouve(article());
    render(<Counter {...BOUTIQUE} />);
    await ajouter('a-0042');
    expect(await screen.findByText('Veste en jean')).toBeInTheDocument();
  });

  it('propose une liste quand la saisie n’est pas une référence', async () => {
    trouve(article(), article({ id: 'p2', reference: 'A-0031', name: 'Veste tailleur' }));
    render(<Counter {...BOUTIQUE} />);
    await ajouter('veste');
    const choix = await screen.findAllByRole('button', { name: /Veste/ });
    expect(choix).toHaveLength(2);

    await userEvent.click(choix[0]);
    expect(screen.getByLabelText('Prix de Veste en jean')).toBeInTheDocument();
  });

  it('le dit quand rien ne correspond', async () => {
    render(<Counter {...BOUTIQUE} />);
    await ajouter('inconnu');
    expect(await screen.findByText(/Aucun article vendable/)).toBeInTheDocument();
  });

  it('vide le champ après un ajout, pour l’article suivant', async () => {
    trouve(article());
    render(<Counter {...BOUTIQUE} />);
    await ajouter('A-0042');
    await waitFor(() => expect(champ()).toHaveValue(''));
  });

  it('n’ajoute pas deux fois le même article', async () => {
    trouve(article());
    render(<Counter {...BOUTIQUE} />);
    await ajouter('A-0042');
    await ajouter('A-0042');
    expect(screen.getAllByText('Veste en jean')).toHaveLength(1);
  });

  describe('un article déjà au panier', () => {
    it('disparaît des propositions', async () => {
      trouve(article(), article({ id: 'p2', reference: 'A-0031', name: 'Veste tailleur' }));
      render(<Counter {...BOUTIQUE} />);
      await ajouter('A-0042');

      await userEvent.type(champ(), 'veste');
      const propositions = await screen.findAllByRole('option');
      expect(propositions.map((o) => o.textContent)).toHaveLength(1);
      expect(propositions[0].textContent).toContain('Veste tailleur');
    });

    it('le dit plutôt que de ne rien faire quand on le retape', async () => {
      trouve(article());
      render(<Counter {...BOUTIQUE} />);
      await ajouter('A-0042');
      await ajouter('A-0042');
      expect(await screen.findByText(/déjà dans le panier/)).toBeInTheDocument();
    });

    it('ne se confond pas avec un article introuvable', async () => {
      render(<Counter {...BOUTIQUE} />);
      await ajouter('inconnu');
      expect(await screen.findByText(/Aucun article vendable/)).toBeInTheDocument();
    });

    it('revient dans les propositions une fois retiré du panier', async () => {
      trouve(article());
      render(<Counter {...BOUTIQUE} />);
      await ajouter('A-0042');
      await userEvent.click(screen.getByLabelText('Retirer Veste en jean'));

      await userEvent.type(champ(), 'veste');
      expect((await screen.findAllByRole('option'))[0].textContent).toContain('Veste en jean');
    });
  });

  it('totalise les prix des étiquettes', async () => {
    trouve(article());
    render(<Counter {...BOUTIQUE} />);
    await ajouter('A-0042');
    trouve(article({ id: 'p2', reference: 'A-0007', name: 'Ceinture', salePrice: '12' }));
    await ajouter('A-0007');
    expect(screen.getByRole('status')).toHaveTextContent('2 articles');
    expect(screen.getByRole('status')).toHaveTextContent('44,00 €');
  });

  it('suit un prix corrigé sur une seule ligne', async () => {
    trouve(article());
    render(<Counter {...BOUTIQUE} />);
    await ajouter('A-0042');
    await userEvent.type(screen.getByLabelText('Prix de Veste en jean'), '25');
    expect(screen.getByRole('status')).toHaveTextContent('25,00 €');
  });

  it('répartit une remise sur le total au prorata des prix', async () => {
    trouve(article());
    render(<Counter {...BOUTIQUE} />);
    await ajouter('A-0042');
    trouve(article({ id: 'p2', reference: 'A-0007', name: 'Ceinture', salePrice: '12' }));
    await ajouter('A-0007');

    await userEvent.type(screen.getByLabelText('Total négocié'), '22');
    // 32 et 12 sur 44 ramenés à 22 : exactement la moitié de chacun.
    expect(screen.getByRole('status')).toHaveTextContent('22,00 €');
    const lignes = screen.getAllByRole('row');
    expect(within(lignes[0]).getByText('16,00 €')).toBeInTheDocument();
    expect(within(lignes[1]).getByText('6,00 €')).toBeInTheDocument();
  });

  it('retire un article du panier', async () => {
    trouve(article());
    render(<Counter {...BOUTIQUE} />);
    await ajouter('A-0042');
    await userEvent.click(screen.getByLabelText('Retirer Veste en jean'));
    expect(screen.queryByText('Veste en jean')).not.toBeInTheDocument();
  });

  it('poste une ligne par article, avec son prix encaissé', async () => {
    trouve(article());
    const { container } = render(<Counter {...BOUTIQUE} />);
    await ajouter('A-0042');
    await userEvent.type(screen.getByLabelText('Total négocié'), '16');
    const lignes = [...container.querySelectorAll('input[name="line"]')].map(
      (i) => (i as HTMLInputElement).value,
    );
    expect(lignes).toEqual(['p1:16']);
  });

  it('avale les espaces à la frappe — un copier-coller en traîne souvent', async () => {
    render(<Counter {...BOUTIQUE} />);
    await userEvent.type(champ(), '  A-0042 ');
    expect(champ()).toHaveValue('A-0042');
  });

  it('propose les articles au fil de la frappe', async () => {
    trouve(article(), article({ id: 'p2', reference: 'A-0031', name: 'Veste tailleur' }));
    render(<Counter {...BOUTIQUE} />);
    await userEvent.type(champ(), 'ves');
    // Sans valider : la liste arrive d'elle-même.
    expect(await screen.findByText('Veste tailleur')).toBeInTheDocument();
  });

  it('attend deux caractères avant de chercher', async () => {
    const appels = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });
    vi.stubGlobal('fetch', appels);
    render(<Counter {...BOUTIQUE} />);
    await userEvent.type(champ(), 'v');
    await new Promise((r) => setTimeout(r, 300));
    expect(appels).not.toHaveBeenCalled();
  });

  it('restreint la recherche à la boutique choisie', async () => {
    const appels = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });
    vi.stubGlobal('fetch', appels);
    render(<Counter {...BOUTIQUE} />);
    await userEvent.type(champ(), 'veste');
    await waitFor(() => expect(appels).toHaveBeenCalled());
    expect(String(appels.mock.calls[0][0])).toContain('shopId=b1');
  });

  it('cherche partout quand aucune boutique n’est choisie', async () => {
    const appels = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });
    vi.stubGlobal('fetch', appels);
    render(<Counter />);
    await userEvent.type(champ(), 'veste');
    await waitFor(() => expect(appels).toHaveBeenCalled());
    expect(String(appels.mock.calls[0][0])).not.toContain('shopId');
  });

  it('annonce la boutique sur laquelle on travaille', () => {
    render(<Counter {...BOUTIQUE} />);
    expect(screen.getByText(/Centre-ville/)).toBeInTheDocument();
  });

  it('annonce « toutes les boutiques » à défaut', () => {
    render(<Counter />);
    expect(screen.getByText(/toutes les boutiques/)).toBeInTheDocument();
  });

  it('ajoute la seule proposition sans faire choisir', async () => {
    trouve(article({ reference: 'A-0099', name: 'Pull unique' }));
    render(<Counter {...BOUTIQUE} />);
    await ajouter('pull');
    expect(await screen.findByLabelText('Prix de Pull unique')).toBeInTheDocument();
  });

  describe('navigation au clavier', () => {
    const trois = [
      article({ id: 'p1', reference: 'A-0001', name: 'Veste en jean' }),
      article({ id: 'p2', reference: 'A-0002', name: 'Veste tailleur' }),
      article({ id: 'p3', reference: 'A-0003', name: 'Veste polaire' }),
    ];

    /** Proposition surlignée, telle qu'annoncée aux lecteurs d'écran. */
    const surlignee = () =>
      screen.queryAllByRole('option').find((o) => o.getAttribute('aria-selected') === 'true')
        ?.textContent;

    async function proposer() {
      trouve(...trois);
      render(<Counter {...BOUTIQUE} />);
      await userEvent.type(champ(), 'veste');
      await screen.findAllByRole('option');
    }

    it('n’en surligne aucune tant qu’on n’a pas touché aux flèches', async () => {
      await proposer();
      expect(surlignee()).toBeUndefined();
    });

    it('descend et remonte dans la liste', async () => {
      await proposer();
      await userEvent.keyboard('{ArrowDown}');
      expect(surlignee()).toContain('Veste en jean');
      await userEvent.keyboard('{ArrowDown}');
      expect(surlignee()).toContain('Veste tailleur');
      await userEvent.keyboard('{ArrowUp}');
      expect(surlignee()).toContain('Veste en jean');
    });

    it('boucle : après la dernière, on revient au champ puis en tête', async () => {
      await proposer();
      await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
      expect(surlignee()).toContain('Veste polaire');
      await userEvent.keyboard('{ArrowDown}');
      expect(surlignee()).toBeUndefined();
      await userEvent.keyboard('{ArrowDown}');
      expect(surlignee()).toContain('Veste en jean');
    });

    it('remonte du champ vers la dernière proposition', async () => {
      await proposer();
      await userEvent.keyboard('{ArrowUp}');
      expect(surlignee()).toContain('Veste polaire');
    });

    it('Entrée ajoute la proposition surlignée', async () => {
      await proposer();
      await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
      expect(await screen.findByLabelText('Prix de Veste tailleur')).toBeInTheDocument();
    });

    it('Échap referme la liste sans rien ajouter', async () => {
      await proposer();
      await userEvent.keyboard('{Escape}');
      expect(screen.queryAllByRole('option')).toHaveLength(0);
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('repart de zéro dès qu’on retape', async () => {
      await proposer();
      await userEvent.keyboard('{ArrowDown}');
      expect(surlignee()).toContain('Veste en jean');
      await userEvent.type(champ(), 's');
      expect(surlignee()).toBeUndefined();
    });

    it('désigne la proposition surlignée au lecteur d’écran', async () => {
      await proposer();
      expect(champ()).toHaveAttribute('aria-expanded', 'true');
      await userEvent.keyboard('{ArrowDown}');
      expect(champ()).toHaveAttribute('aria-activedescendant', 'comptoir-option-0');
    });

    it('suit aussi la souris, pour que les deux ne se contredisent pas', async () => {
      await proposer();
      await userEvent.hover(screen.getAllByRole('button', { name: /Veste polaire/ })[0]);
      expect(surlignee()).toContain('Veste polaire');
    });
  });

  it('ne montre le panier que lorsqu’il contient quelque chose', () => {
    render(<Counter {...BOUTIQUE} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Total négocié')).not.toBeInTheDocument();
  });
});
