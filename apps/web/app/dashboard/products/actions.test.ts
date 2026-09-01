import { beforeEach, describe, expect, it } from 'vitest';
import {
  ApiError,
  apiFetch,
  attraperRedirection,
  dernierAppel,
  form,
  resetMocks,
  revalidatePath,
} from '@/test/actions';

const {
  assignShop,
  createLot,
  sellBasket,
  changeStatus,
  createProduct,
  deleteProduct,
  markRemovalDone,
  markRemovalsDone,
  setOnline,
  toggleDepositorPayment,
  updateProduct,
  updateSale,
} = await import('./actions');

const base = { name: 'Bottines', categoryId: 'cat-1', saleType: 'RESALE' };

beforeEach(() => resetMocks({ id: 'p1' }));

describe('createProduct', () => {
  it('poste sur /products avec les noms de champs de l’API', async () => {
    await attraperRedirection(createProduct({}, form(base)));
    const { route, method, body } = dernierAppel();
    expect([route, method]).toEqual(['/products', 'POST']);
    expect(body).toMatchObject({ name: 'Bottines', categoryId: 'cat-1', saleType: 'RESALE' });
  });

  it('mène à la fiche du produit créé', async () => {
    expect(await attraperRedirection(createProduct({}, form(base)))).toBe('/dashboard/products/p1');
  });

  it('envoie null pour un produit laissé au stock central', async () => {
    await attraperRedirection(createProduct({}, form({ ...base, shopId: '' })));
    expect(dernierAppel().body?.shopId).toBeNull();
  });

  it('omet les champs facultatifs laissés vides', async () => {
    await attraperRedirection(createProduct({}, form(base)));
    const { body } = dernierAppel();
    expect(body).not.toHaveProperty('reference');
    expect(body).not.toHaveProperty('purchasePrice');
  });

  it('accepte la virgule décimale, telle qu’on la tape en français', async () => {
    await attraperRedirection(createProduct({}, form({ ...base, salePrice: '12,50' })));
    expect(dernierAppel().body?.salePrice).toBe(12.5);
  });

  it('ignore un prix illisible plutôt que d’envoyer NaN', async () => {
    await attraperRedirection(createProduct({}, form({ ...base, salePrice: 'douze' })));
    expect(dernierAppel().body).not.toHaveProperty('salePrice');
  });

  it('rassemble les valeurs d’attributs préfixées attr:', async () => {
    await attraperRedirection(
      createProduct(
        {},
        form({ ...base, 'attr:a1': 'Beige', 'attr:a2': ['S', 'M'], 'attr:a3': '' }),
      ),
    );
    expect(dernierAppel().body?.attributes).toEqual([
      { attributeDefinitionId: 'a1', value: 'Beige' },
      { attributeDefinitionId: 'a2', value: ['S', 'M'] },
    ]);
  });

  it('rend le message de l’API sans rediriger', async () => {
    apiFetch.mockRejectedValue(new ApiError(400, 'Cette catégorie n’appartient pas.'));
    await expect(createProduct({}, form(base))).resolves.toEqual({
      error: 'Cette catégorie n’appartient pas.',
    });
  });
});

describe('changeStatus', () => {
  it('appelle la route de statut du produit', async () => {
    await changeStatus({}, form({ id: 'p1', statusId: 's2' }));
    const { route, method, body } = dernierAppel();
    expect([route, method]).toEqual(['/products/p1/status', 'PUT']);
    expect(body).toEqual({ statusId: 's2' });
  });

  it('joint le prix vendu quand il est saisi', async () => {
    await changeStatus({}, form({ id: 'p1', statusId: 's2', soldPrice: '40' }));
    expect(dernierAppel().body).toEqual({ statusId: 's2', soldPrice: 40 });
  });

  it('rafraîchit la liste et la fiche', async () => {
    await changeStatus({}, form({ id: 'p1', statusId: 's2' }));
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/products');
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/products/p1');
  });

  it('rend un marqueur neuf à chaque succès, pour que le formulaire se réarme', async () => {
    const a = await changeStatus({}, form({ id: 'p1', statusId: 's2' }));
    const b = await changeStatus({}, form({ id: 'p1', statusId: 's2' }));
    expect(a.token).toBeTruthy();
    expect(a.token).not.toBe(b.token);
  });

  it('rend le refus de l’API', async () => {
    apiFetch.mockRejectedValue(new ApiError(403, 'Ce produit est « Rendu ».'));
    await expect(changeStatus({}, form({ id: 'p1', statusId: 's2' }))).resolves.toEqual({
      error: 'Ce produit est « Rendu ».',
    });
  });
});

describe('updateProduct', () => {
  it('envoie tous les champs, y compris vides — une modification peut effacer', async () => {
    await attraperRedirection(updateProduct({}, form({ ...base, id: 'p1' })));
    const { route, method, body } = dernierAppel();
    expect([route, method]).toEqual(['/products/p1', 'PUT']);
    expect(body).toMatchObject({ reference: '', description: '', internalNote: '' });
  });

  it("n'envoie pas de prix d'achat pour un dépôt-vente", async () => {
    await attraperRedirection(
      updateProduct({}, form({ ...base, id: 'p1', saleType: 'CONSIGNMENT', purchasePrice: '10' })),
    );
    expect(dernierAppel().body).not.toHaveProperty('purchasePrice');
  });

  it("conserve le prix d'achat en achat-revente", async () => {
    await attraperRedirection(updateProduct({}, form({ ...base, id: 'p1', purchasePrice: '10' })));
    expect(dernierAppel().body?.purchasePrice).toBe(10);
  });

  it('revient sur la fiche du produit', async () => {
    expect(await attraperRedirection(updateProduct({}, form({ ...base, id: 'p1' })))).toBe(
      '/dashboard/products/p1',
    );
  });
});

describe('updateSale', () => {
  it('corrige prix et date sur la route de vente', async () => {
    await updateSale({}, form({ id: 'p1', soldPrice: '35', soldAt: '2026-08-01' }));
    const { route, method, body } = dernierAppel();
    expect([route, method]).toEqual(['/products/p1/sale', 'PUT']);
    expect(body?.soldPrice).toBe(35);
    expect(body?.soldAt).toBe(new Date('2026-08-01').toISOString());
  });

  it('joint la commission seulement si elle est saisie', async () => {
    await updateSale({}, form({ id: 'p1', soldPrice: '35' }));
    expect(dernierAppel().body).not.toHaveProperty('appliedCommission');

    await updateSale({}, form({ id: 'p1', soldPrice: '35', appliedCommission: '40' }));
    expect(dernierAppel().body?.appliedCommission).toBe(40);
  });

  it('accepte une commission à zéro, qui n’est pas une absence', async () => {
    await updateSale({}, form({ id: 'p1', appliedCommission: '0' }));
    expect(dernierAppel().body?.appliedCommission).toBe(0);
  });
});

describe('toggleDepositorPayment', () => {
  it('envoie le champ « paid », celui qu’attend l’API', async () => {
    await toggleDepositorPayment({}, form({ id: 'p1', paid: 'true' }));
    const { route, method, body } = dernierAppel();
    expect([route, method]).toEqual(['/products/p1/depositor-payment', 'PUT']);
    expect(body).toEqual({ paid: true });
  });

  it('sait aussi revenir sur un règlement', async () => {
    await toggleDepositorPayment({}, form({ id: 'p1', paid: 'false' }));
    expect(dernierAppel().body).toEqual({ paid: false });
  });

  it('rafraîchit le relevé du déposant, qui en dépend', async () => {
    await toggleDepositorPayment({}, form({ id: 'p1', paid: 'true' }));
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/depositors', 'layout');
  });
});

describe('setOnline', () => {
  it('publie sur une route à part, celle du droit « en ligne »', async () => {
    await setOnline({}, form({ id: 'p1', isOnline: 'true', onlinePrice: '25' }));
    const { route, method, body } = dernierAppel();
    expect([route, method]).toEqual(['/products/p1/online', 'PUT']);
    expect(body).toEqual({ isOnline: true, onlinePrice: 25 });
  });

  it('accepte la virgule décimale, comme partout ailleurs', async () => {
    await setOnline({}, form({ id: 'p1', isOnline: 'true', onlinePrice: '25,50' }));
    expect(dernierAppel().body).toEqual({ isOnline: true, onlinePrice: 25.5 });
  });

  it('un prix vide efface le prix du site, il ne vaut pas zéro', async () => {
    // Sans ça, laisser le champ vide brancherait le site sur 0 € au lieu de le
    // faire retomber sur le prix boutique.
    await setOnline({}, form({ id: 'p1', isOnline: 'true', onlinePrice: '' }));
    expect(dernierAppel().body).toEqual({ isOnline: true, onlinePrice: null });
  });

  it('sait aussi dépublier', async () => {
    const state = await setOnline({}, form({ id: 'p1', isOnline: 'false' }));
    expect(dernierAppel().body).toMatchObject({ isOnline: false });
    expect(state.success).toContain('retiré');
  });
});

describe('markRemovalDone', () => {
  it('appelle la route de retrait, sans corps', async () => {
    await markRemovalDone({}, form({ id: 'p1' }));
    const { route, method } = dernierAppel();
    expect([route, method]).toEqual(['/products/p1/removal-done', 'PUT']);
  });

  it('rafraîchit la liste : l’article sort des retraits à faire', async () => {
    await markRemovalDone({}, form({ id: 'p1' }));
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/products');
  });
});

describe('markRemovalsDone', () => {
  it('envoie tous les identifiants en une requête', async () => {
    const data = form({});
    data.append('productId', 'p1');
    data.append('productId', 'p2');
    await markRemovalsDone({}, data);
    const { route, method, body } = dernierAppel();
    expect([route, method]).toEqual(['/products/removals-done', 'PUT']);
    expect(body).toEqual({ productIds: ['p1', 'p2'] });
  });

  it('refuse un envoi vide sans appeler l’API', async () => {
    const state = await markRemovalsDone({}, form({}));
    expect(state.error).toBeDefined();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('accorde le message au nombre traité', async () => {
    apiFetch.mockResolvedValue({ count: 1 });
    const data = form({});
    data.append('productId', 'p1');
    const state = await markRemovalsDone({}, data);
    expect(state.success).toBe('1 retrait enregistré.');
  });
});

describe('assignShop', () => {
  it('assigne à une boutique', async () => {
    await assignShop({}, form({ id: 'p1', shopId: 'b1' }));
    const { route, method, body } = dernierAppel();
    expect([route, method]).toEqual(['/products/p1/assign-shop', 'PUT']);
    expect(body).toEqual({ shopId: 'b1' });
  });

  it('renvoie au stock central avec un shopId nul', async () => {
    await assignShop({}, form({ id: 'p1', shopId: '' }));
    expect(dernierAppel().body).toEqual({ shopId: null });
  });
});

describe('deleteProduct', () => {
  it('supprime puis ramène à la liste', async () => {
    expect(await attraperRedirection(deleteProduct({}, form({ id: 'p1' })))).toBe(
      '/dashboard/products',
    );
    expect(dernierAppel()).toMatchObject({ route: '/products/p1', method: 'DELETE' });
  });

  it('reste sur place et explique en cas de refus', async () => {
    apiFetch.mockRejectedValue(new ApiError(403, 'Interdit.'));
    await expect(deleteProduct({}, form({ id: 'p1' }))).resolves.toEqual({ error: 'Interdit.' });
  });
});

describe('createLot', () => {
  /** Le tableau poste un `lineId` par ligne, plus ses cellules. */
  function ligne(id: string, champs: Record<string, string | string[]>) {
    const out: Record<string, string | string[]> = {};
    for (const [k, v] of Object.entries(champs)) out[`line:${id}:${k}`] = v;
    return out;
  }

  const lot = {
    totalPurchasePrice: '7',
    lineId: ['a', 'b'],
    ...ligne('a', { name: 'T-shirt', categoryId: 'c1', salePrice: '10', count: '4' }),
    ...ligne('b', { name: 'Chemise', categoryId: 'c1', salePrice: '20', count: '2' }),
  };

  beforeEach(() => resetMocks({ count: 6 }));

  it("n'envoie que le prix du lot : la répartition appartient à l'API", async () => {
    await attraperRedirection(createLot({}, form(lot)));
    const { route, method, body } = dernierAppel();
    expect([route, method]).toEqual(['/products/lot', 'POST']);
    expect(body?.totalPurchasePrice).toBe(7);
    expect(body?.lines).toEqual([
      expect.objectContaining({ name: 'T-shirt', salePrice: 10, count: 4 }),
      expect.objectContaining({ name: 'Chemise', salePrice: 20, count: 2 }),
    ]);
    // Aucun prix d'achat ne part d'ici.
    expect(JSON.stringify(body)).not.toContain('purchasePrice"');
  });

  it('accepte la virgule décimale sur le prix du lot', async () => {
    await attraperRedirection(createLot({}, form({ ...lot, totalPurchasePrice: '7,50' })));
    expect(dernierAppel().body?.totalPurchasePrice).toBe(7.5);
  });

  it('traite un prix de lot absent comme un lot gratuit', async () => {
    await attraperRedirection(createLot({}, form({ ...lot, totalPurchasePrice: '' })));
    expect(dernierAppel().body?.totalPurchasePrice).toBe(0);
  });

  it('refuse une ligne à moitié remplie plutôt que de la perdre', async () => {
    await expect(
      createLot(
        {},
        form({
          totalPurchasePrice: '7',
          lineId: ['a', 'b'],
          ...ligne('a', { name: 'T-shirt', categoryId: 'c1' }),
          ...ligne('b', { categoryId: 'c1', salePrice: '20' }),
        }),
      ),
    ).resolves.toEqual({ error: 'Ligne 2 : le nom est obligatoire.' });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('ignore la ligne où seule la catégorie est héritée', async () => {
    await attraperRedirection(
      createLot(
        {},
        form({
          totalPurchasePrice: '7',
          lineId: ['a', 'b'],
          ...ligne('a', { name: 'T-shirt', categoryId: 'c1' }),
          ...ligne('b', { categoryId: 'c1' }),
        }),
      ),
    );
    expect((dernierAppel().body?.lines as unknown[]).length).toBe(1);
  });

  it("refuse un lot vide sans appeler l'API", async () => {
    await expect(createLot({}, form({ totalPurchasePrice: '7' }))).resolves.toEqual({
      error: 'Ajoutez au moins un article au lot.',
    });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('applique la boutique à tout le lot', async () => {
    await attraperRedirection(createLot({}, form({ ...lot, shopId: 'b1' })));
    expect(dernierAppel().body?.shopId).toBe('b1');
  });

  it('laisse au stock central quand aucune boutique n’est choisie', async () => {
    await attraperRedirection(createLot({}, form(lot)));
    expect(dernierAppel().body).not.toHaveProperty('shopId');
  });

  it('rassemble les attributs de la ligne', async () => {
    await attraperRedirection(
      createLot(
        {},
        form({
          totalPurchasePrice: '4',
          lineId: ['a'],
          ...ligne('a', {
            name: 'T-shirt',
            categoryId: 'c1',
            'attr:at1': 'o-noir',
            'attr:at2': ['o-s', 'o-m'],
          }),
        }),
      ),
    );
    expect((dernierAppel().body?.lines as { attributes: unknown }[])[0].attributes).toEqual([
      { attributeDefinitionId: 'at1', value: 'o-noir' },
      { attributeDefinitionId: 'at2', value: ['o-s', 'o-m'] },
    ]);
  });

  it('ramène à la liste en annonçant le nombre d’articles créés', async () => {
    expect(await attraperRedirection(createLot({}, form(lot)))).toBe('/dashboard/products?lot=6');
  });

  it('remonte l’erreur de l’API en situant la ligne fautive', async () => {
    apiFetch.mockRejectedValue(
      new ApiError(400, "Ligne 2 (Chemise) : Cette catégorie n'appartient pas à votre entreprise."),
    );
    await expect(createLot({}, form(lot))).resolves.toEqual({
      error: "Ligne 2 (Chemise) : Cette catégorie n'appartient pas à votre entreprise.",
    });
  });
});

describe('sellBasket', () => {
  beforeEach(() => resetMocks({ count: 2, total: 44 }));

  it('poste le panier sur la route de vente', async () => {
    await sellBasket({}, form({ line: ['p1:32', 'p2:12'] }));
    expect(dernierAppel()).toMatchObject({
      route: '/products/sale',
      method: 'POST',
      body: {
        lines: [
          { productId: 'p1', soldPrice: 32 },
          { productId: 'p2', soldPrice: 12 },
        ],
      },
    });
  });

  it('annonce ce qui a été vendu', async () => {
    await expect(sellBasket({}, form({ line: ['p1:32', 'p2:12'] }))).resolves.toMatchObject({
      success: '2 articles vendus · 44,00 €',
      sold: 2,
    });
  });

  it('accorde le message au singulier', async () => {
    resetMocks({ count: 1, total: 32 });
    await expect(sellBasket({}, form({ line: ['p1:32'] }))).resolves.toMatchObject({
      success: '1 article vendu · 32,00 €',
    });
  });

  it("refuse un panier vide sans appeler l'API", async () => {
    await expect(sellBasket({}, form({}))).resolves.toEqual({
      error: 'Ajoutez au moins un article.',
    });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('écarte une ligne illisible plutôt que d’envoyer NaN', async () => {
    await sellBasket({}, form({ line: ['p1:32', 'cassée'] }));
    expect((dernierAppel().body?.lines as unknown[]).length).toBe(1);
  });

  it('rafraîchit le tableau de bord, le stock et les relevés', async () => {
    await sellBasket({}, form({ line: ['p1:32'] }));
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard', 'layout');
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/products', 'layout');
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/depositors', 'layout');
  });

  it('rend un marqueur neuf, pour que le comptoir se vide', async () => {
    const a = await sellBasket({}, form({ line: ['p1:32'] }));
    const b = await sellBasket({}, form({ line: ['p1:32'] }));
    expect(a.token).not.toBe(b.token);
  });

  it('remonte le refus de l’API en nommant l’article', async () => {
    apiFetch.mockRejectedValue(
      new ApiError(400, 'Veste : Ce produit est « Rendu au client » : il ne peut plus être vendu.'),
    );
    await expect(sellBasket({}, form({ line: ['p1:32'] }))).resolves.toEqual({
      error: 'Veste : Ce produit est « Rendu au client » : il ne peut plus être vendu.',
    });
  });
});
