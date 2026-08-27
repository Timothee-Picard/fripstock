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

const deposants = await import('./depositors/actions');
const contrats = await import('./deposit-contracts/actions');
const utilisateurs = await import('./users/actions');
const profil = await import('./profile/actions');
const notifications = await import('./notifications/actions');

beforeEach(() => resetMocks({ id: 'c1' }));

/** Articles du dernier corps envoyé à l'API. */
function body_products(): Record<string, unknown>[] {
  return (dernierAppel().body?.products ?? []) as Record<string, unknown>[];
}

describe('déposants', () => {
  it('envoie lastName, le nom du champ côté API', async () => {
    await deposants.createDepositor({}, form({ lastName: 'Martin', firstName: 'Sophie' }));
    expect(dernierAppel()).toMatchObject({
      route: '/depositors',
      method: 'POST',
      body: { lastName: 'Martin', firstName: 'Sophie' },
    });
  });

  it('refuse un nom vide sans appeler l’API', async () => {
    await expect(deposants.createDepositor({}, form({ lastName: ' ' }))).resolves.toEqual({
      error: 'Le nom est obligatoire.',
    });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('omet les coordonnées laissées vides', async () => {
    await deposants.createDepositor({}, form({ lastName: 'Martin' }));
    const { body } = dernierAppel();
    expect(body).not.toHaveProperty('email');
    expect(body).not.toHaveProperty('phone');
  });

  it('normalise le code déposant en majuscules', async () => {
    await deposants.createDepositor({}, form({ lastName: 'Martin', code: ' mar ' }));
    expect(dernierAppel().body?.code).toBe('MAR');
  });

  it('omet le code laissé vide : l’API le déduira du nom', async () => {
    await deposants.createDepositor({}, form({ lastName: 'Martin' }));
    expect(dernierAppel().body).not.toHaveProperty('code');
  });

  it('normalise l’IBAN : sans espaces, en majuscules', async () => {
    await deposants.createDepositor({}, form({ lastName: 'Martin', iban: ' fr76 3000 1007 ' }));
    expect(dernierAppel().body?.iban).toBe('FR7630001007');
  });

  it('convertit la commission en nombre, virgule comprise', async () => {
    await deposants.createDepositor({}, form({ lastName: 'Martin', defaultCommission: '40' }));
    expect(dernierAppel().body?.defaultCommission).toBe(40);
  });

  it('omet la commission laissée vide', async () => {
    await deposants.createDepositor({}, form({ lastName: 'Martin', defaultCommission: '' }));
    expect(dernierAppel().body).not.toHaveProperty('defaultCommission');
  });

  it('met à jour sur la route du déposant', async () => {
    await deposants.updateDepositor({}, form({ id: 'd1', lastName: 'Durand' }));
    expect(dernierAppel()).toMatchObject({ route: '/depositors/d1', method: 'PUT' });
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/depositors/d1');
  });

  it('supprime puis ramène à la liste', async () => {
    expect(await attraperRedirection(deposants.deleteDepositor({}, form({ id: 'd1' })))).toBe(
      '/dashboard/depositors',
    );
  });
});

describe('contrats de dépôt', () => {
  it('crée un contrat et mène à sa fiche', async () => {
    const url = await attraperRedirection(
      contrats.createContract(
        {},
        form({
          depositorId: 'd1',
          startDate: '2026-01-01',
          endDate: '2026-06-01',
          commission: '40',
          notifyBeforeDays: '7',
        }),
      ),
    );
    expect(url).toBe('/dashboard/deposit-contracts/c1');
    expect(dernierAppel()).toMatchObject({
      route: '/deposit-contracts',
      method: 'POST',
      body: { depositorId: 'd1', commission: 40, notifyBeforeDays: 7 },
    });
  });

  it('envoie les dates en ISO, telles que l’API les valide', async () => {
    await attraperRedirection(
      contrats.createContract(
        {},
        form({ depositorId: 'd1', startDate: '2026-01-01', endDate: '2026-06-01' }),
      ),
    );
    const { body } = dernierAppel();
    expect(String(body?.startDate)).toContain('2026-01-01');
    expect(String(body?.endDate)).toContain('2026-06-01');
  });

  describe('articles saisis avec le contrat', () => {
    /** Le tableau poste un `lineId` par ligne, plus ses cellules. */
    function ligne(id: string, champs: Record<string, string | string[]>) {
      const out: Record<string, string | string[]> = {};
      for (const [k, v] of Object.entries(champs)) out[`line:${id}:${k}`] = v;
      return out;
    }

    const conditions = {
      depositorId: 'd1',
      startDate: '2026-01-01',
      endDate: '2026-06-01',
    };

    it('joint les articles au corps du contrat', async () => {
      await attraperRedirection(
        contrats.createContract(
          {},
          form({
            ...conditions,
            lineId: ['a', 'b'],
            ...ligne('a', { name: 'Robe Zara', categoryId: 'c1', salePrice: '15' }),
            ...ligne('b', { name: 'Sac cuir', categoryId: 'c2', salePrice: '45,50' }),
          }),
        ),
      );
      const { body } = dernierAppel();
      expect(body?.products).toEqual([
        expect.objectContaining({ name: 'Robe Zara', categoryId: 'c1', salePrice: 15 }),
        expect.objectContaining({ name: 'Sac cuir', categoryId: 'c2', salePrice: 45.5 }),
      ]);
    });

    it('ignore la ligne vide gardée en bas du tableau', async () => {
      await attraperRedirection(
        contrats.createContract(
          {},
          form({
            ...conditions,
            lineId: ['a', 'b'],
            ...ligne('a', { name: 'Robe', categoryId: 'c1' }),
            ...ligne('b', { categoryId: 'c1' }),
          }),
        ),
      );
      expect(body_products().length).toBe(1);
    });

    it('refuse une ligne à moitié remplie plutôt que de la perdre', async () => {
      await expect(
        contrats.createContract(
          {},
          form({
            ...conditions,
            lineId: ['a', 'b'],
            ...ligne('a', { name: 'Robe', categoryId: 'c1' }),
            ...ligne('b', { categoryId: 'c1', salePrice: '15' }),
          }),
        ),
      ).resolves.toEqual({ error: 'Ligne 2 : le nom est obligatoire.' });
      expect(apiFetch).not.toHaveBeenCalled();
    });

    it("n'envoie pas de tableau d'articles quand aucun n'est saisi", async () => {
      await attraperRedirection(contrats.createContract({}, form(conditions)));
      expect(dernierAppel().body).not.toHaveProperty('products');
    });

    it('applique la boutique du contrat à chaque article', async () => {
      await attraperRedirection(
        contrats.createContract(
          {},
          form({
            ...conditions,
            shopId: 'b1',
            lineId: ['a'],
            ...ligne('a', { name: 'Robe', categoryId: 'c1' }),
          }),
        ),
      );
      expect(body_products()[0]).toMatchObject({ shopId: 'b1' });
    });

    it('laisse au stock central quand aucune boutique n’est choisie', async () => {
      await attraperRedirection(
        contrats.createContract(
          {},
          form({ ...conditions, lineId: ['a'], ...ligne('a', { name: 'Robe', categoryId: 'c1' }) }),
        ),
      );
      expect(body_products()[0]).toMatchObject({ shopId: null });
    });

    it('omet les cellules laissées vides plutôt que d’envoyer des chaînes vides', async () => {
      await attraperRedirection(
        contrats.createContract(
          {},
          form({
            ...conditions,
            lineId: ['a'],
            ...ligne('a', { name: 'Robe', categoryId: 'c1', reference: '', description: '  ' }),
          }),
        ),
      );
      const article = body_products()[0];
      expect(article).not.toHaveProperty('reference');
      expect(article).not.toHaveProperty('description');
    });

    it('rassemble les attributs de la ligne, valeur seule ou liste', async () => {
      await attraperRedirection(
        contrats.createContract(
          {},
          form({
            ...conditions,
            lineId: ['a'],
            ...ligne('a', {
              name: 'Robe',
              categoryId: 'c1',
              'attr:at1': 'o-beige',
              'attr:at2': ['o-s', 'o-m'],
              'attr:at3': '',
            }),
          }),
        ),
      );
      expect(body_products()[0].attributes).toEqual([
        { attributeDefinitionId: 'at1', value: 'o-beige' },
        { attributeDefinitionId: 'at2', value: ['o-s', 'o-m'] },
      ]);
    });

    it('remonte l’erreur de l’API en situant la ligne fautive', async () => {
      apiFetch.mockRejectedValue(
        new ApiError(400, "Article 2 (Sac) : Cette catégorie n'appartient pas à votre entreprise."),
      );
      await expect(
        contrats.createContract(
          {},
          form({ ...conditions, lineId: ['a'], ...ligne('a', { name: 'Sac', categoryId: 'x' }) }),
        ),
      ).resolves.toEqual({
        error: "Article 2 (Sac) : Cette catégorie n'appartient pas à votre entreprise.",
      });
    });
  });

  it('rattache des produits en une fois', async () => {
    await contrats.attachProducts({}, form({ id: 'c1', productId: ['p1', 'p2'] }));
    expect(dernierAppel()).toMatchObject({
      route: '/deposit-contracts/c1/products',
      method: 'POST',
      body: { productIds: ['p1', 'p2'] },
    });
  });

  it('refuse un rattachement vide sans appeler l’API', async () => {
    await expect(contrats.attachProducts({}, form({ id: 'c1' }))).resolves.toEqual({
      error: 'Choisissez au moins un produit.',
    });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('détache un produit précis', async () => {
    await contrats.detachProduct({}, form({ id: 'c1', productId: 'p1' }));
    expect(dernierAppel()).toMatchObject({
      route: '/deposit-contracts/c1/products/p1',
      method: 'DELETE',
    });
  });

  it('déclenche la passe d’échéances et résume ce qui s’est passé', async () => {
    apiFetch.mockResolvedValue({ notified: 2, expired: 1 });
    await expect(contrats.runDeadlines()).resolves.toEqual({
      success: '2 alerte(s) créée(s), 1 contrat(s) passé(s) en expiré.',
    });
    expect(dernierAppel()).toMatchObject({
      route: '/deposit-contracts/deadlines',
      method: 'POST',
    });
  });

  it('supprime un contrat puis ramène à la liste', async () => {
    expect(await attraperRedirection(contrats.deleteContract({}, form({ id: 'c1' })))).toBe(
      '/dashboard/deposit-contracts',
    );
  });
});

describe('utilisateurs', () => {
  it('invite avec lastName et rend le mot de passe temporaire', async () => {
    apiFetch.mockResolvedValue({
      firstName: 'Léa',
      lastName: 'Bernard',
      temporaryPassword: 'abc123',
    });
    await expect(
      utilisateurs.inviteEmployee(
        {},
        form({ email: 'lea@test.fr', firstName: 'Léa', lastName: 'Bernard' }),
      ),
    ).resolves.toEqual({
      success: 'Léa Bernard a été invité.',
      temporaryPassword: 'abc123',
    });
    expect(dernierAppel().body).toMatchObject({
      email: 'lea@test.fr',
      firstName: 'Léa',
      lastName: 'Bernard',
    });
  });

  it('enregistre les permissions cochées, boutique par boutique', async () => {
    await utilisateurs.saveAccess(
      {},
      form({
        userId: 'u2',
        shopId: ['b1', 'b2'],
        'perm:b1:products.view': 'on',
        'perm:b1:products.create': 'on',
        'perm:b2:stats.view': 'on',
      }),
    );
    expect(dernierAppel()).toMatchObject({ route: '/users/u2/access', method: 'PUT' });
    expect(dernierAppel().body).toEqual({
      accesses: [
        { shopId: 'b1', permissions: ['products.view', 'products.create'] },
        { shopId: 'b2', permissions: ['stats.view'] },
      ],
    });
  });

  it('supprime un employé', async () => {
    await utilisateurs.deleteEmployee({}, form({ userId: 'u2' }));
    expect(dernierAppel()).toMatchObject({ route: '/users/u2', method: 'DELETE' });
  });
});

describe('profil', () => {
  it('envoie lastName, comme l’attend l’API', async () => {
    await profil.updateProfile(
      {},
      form({ firstName: 'Camille', lastName: 'Durand', email: 'a@b.fr' }),
    );
    expect(dernierAppel()).toMatchObject({
      route: '/auth/profile',
      method: 'PUT',
      body: { firstName: 'Camille', lastName: 'Durand', email: 'a@b.fr' },
    });
  });

  it('change le mot de passe et repose un jeton frais', async () => {
    apiFetch.mockResolvedValue({ accessToken: 'jeton-neuf' });
    await expect(
      profil.changePassword(
        {},
        form({
          currentPassword: 'ancien',
          newPassword: 'nouveaumdp',
          confirmation: 'nouveaumdp',
        }),
      ),
    ).resolves.toEqual({ success: 'Mot de passe modifié.' });
    expect(dernierAppel()).toMatchObject({
      route: '/auth/password',
      method: 'PUT',
      body: { currentPassword: 'ancien', newPassword: 'nouveaumdp' },
    });
  });

  it('refuse une confirmation qui ne correspond pas, sans appeler l’API', async () => {
    await expect(
      profil.changePassword(
        {},
        form({ currentPassword: 'x', newPassword: 'aaaaaaaa', confirmation: 'bbbbbbbb' }),
      ),
    ).resolves.toEqual({ error: 'Les deux mots de passe ne correspondent pas.' });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('remonte le refus quand l’ancien mot de passe est faux', async () => {
    apiFetch.mockRejectedValue(new ApiError(401, 'Mot de passe actuel incorrect.'));
    await expect(
      profil.changePassword(
        {},
        form({ currentPassword: 'faux', newPassword: 'aaaaaaaa', confirmation: 'aaaaaaaa' }),
      ),
    ).resolves.toEqual({ error: 'Mot de passe actuel incorrect.' });
  });
});

describe('notifications', () => {
  it('marque une alerte précise comme lue', async () => {
    await notifications.markRead(form({ id: 'n1' }));
    expect(dernierAppel()).toMatchObject({ route: '/notifications/n1/read', method: 'PUT' });
  });

  it('marque tout comme lu quand aucun identifiant n’est donné', async () => {
    await notifications.markRead(form({}));
    expect(dernierAppel()).toMatchObject({ route: '/notifications/read-all', method: 'PUT' });
  });
});
