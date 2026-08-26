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
  changeStatus,
  createProduct,
  deleteProduct,
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
