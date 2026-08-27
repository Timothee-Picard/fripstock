import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError, apiFetch, dernierAppel, form, resetMocks, revalidatePath } from '@/test/actions';

const categories = await import('./categories/actions');
const attributs = await import('./attributes/actions');
const boutiques = await import('./shops/actions');

beforeEach(() => resetMocks());

describe('catégories', () => {
  it('crée une racine avec un parent nul', async () => {
    await categories.createCategory({}, form({ name: 'Sac' }));
    expect(dernierAppel()).toMatchObject({
      route: '/categories',
      method: 'POST',
      body: { name: 'Sac', parentId: null },
    });
  });

  it('refuse un nom vide sans appeler l’API', async () => {
    await expect(categories.createCategory({}, form({ name: '  ' }))).resolves.toEqual({
      error: 'Le nom est obligatoire.',
    });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('rattache à un parent quand il est choisi', async () => {
    await categories.createCategory({}, form({ name: 'Robe', parentId: 'v' }));
    expect(dernierAppel().body).toEqual({ name: 'Robe', parentId: 'v' });
  });

  it('met à jour sur la route de la catégorie', async () => {
    await categories.updateCategory({}, form({ id: 'c1', name: 'Sacs', parentId: '' }));
    expect(dernierAppel()).toMatchObject({
      route: '/categories/c1',
      method: 'PUT',
      body: { name: 'Sacs', parentId: null },
    });
  });

  it('supprime et rafraîchit l’écran', async () => {
    await categories.deleteCategory({}, form({ id: 'c1' }));
    expect(dernierAppel()).toMatchObject({ route: '/categories/c1', method: 'DELETE' });
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/categories');
  });

  it('enregistre les attributs cochés sous la clé attendue par l’API', async () => {
    await categories.setAttributes({}, form({ id: 'c1', attributeId: ['a1', 'a2'] }));
    expect(dernierAppel()).toMatchObject({
      route: '/categories/c1/attributes',
      method: 'PUT',
      body: { attributeDefinitionIds: ['a1', 'a2'] },
    });
  });

  it('accepte de tout décocher', async () => {
    await categories.setAttributes({}, form({ id: 'c1' }));
    expect(dernierAppel().body).toEqual({ attributeDefinitionIds: [] });
  });

  it('remonte le refus de l’API', async () => {
    apiFetch.mockRejectedValue(new ApiError(409, 'Cette catégorie contient 3 produit(s).'));
    await expect(categories.deleteCategory({}, form({ id: 'c1' }))).resolves.toEqual({
      error: 'Cette catégorie contient 3 produit(s).',
    });
  });
});

describe('attributs', () => {
  it('clone un modèle de la bibliothèque', async () => {
    await attributs.cloneTemplate({}, form({ templateId: 't1', name: 'Taille' }));
    expect(dernierAppel()).toMatchObject({
      route: '/attributes/from-template/t1',
      method: 'POST',
    });
  });

  it('crée un attribut texte sans option', async () => {
    await attributs.createAttribute({}, form({ name: 'Matière', type: 'TEXT' }));
    expect(dernierAppel().body).toMatchObject({ name: 'Matière', type: 'TEXT', options: [] });
  });

  it('exige une option pour un type à choix, sans appeler l’API', async () => {
    await expect(
      attributs.createAttribute({}, form({ name: 'Couleur', type: 'SELECT' })),
    ).resolves.toEqual({ error: 'Ce type a besoin d’au moins une option.' });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('renomme sur la route de l’attribut', async () => {
    await attributs.renameAttribute({}, form({ id: 'a1', name: 'Teinte' }));
    expect(dernierAppel()).toMatchObject({
      route: '/attributes/a1',
      method: 'PUT',
      body: { name: 'Teinte' },
    });
  });

  it('refuse de vider la liste d’options', async () => {
    await expect(attributs.setOptions({}, form({ id: 'a1' }))).resolves.toEqual({
      error: 'Il faut conserver au moins une option.',
    });
  });

  it('supprime un attribut', async () => {
    await attributs.deleteAttribute({}, form({ id: 'a1' }));
    expect(dernierAppel()).toMatchObject({ route: '/attributes/a1', method: 'DELETE' });
  });
});

describe('boutiques', () => {
  it('crée une boutique', async () => {
    await boutiques.createShop({}, form({ name: 'Gare', address: '1 rue X' }));
    expect(dernierAppel()).toMatchObject({
      route: '/shops',
      method: 'POST',
      body: { name: 'Gare', address: '1 rue X' },
    });
  });

  it('omet une adresse vide à la création', async () => {
    await boutiques.createShop({}, form({ name: 'Gare' }));
    expect(dernierAppel().body).not.toHaveProperty('address');
  });

  it('envoie une adresse vide à la modification, ce qui l’efface', async () => {
    await boutiques.updateShop({}, form({ id: 'b1', name: 'Gare', address: '' }));
    expect(dernierAppel()).toMatchObject({
      route: '/shops/b1',
      method: 'PUT',
      body: { name: 'Gare', address: '' },
    });
  });

  it('refuse un nom vide', async () => {
    await expect(boutiques.updateShop({}, form({ id: 'b1', name: '' }))).resolves.toEqual({
      error: 'Le nom est obligatoire.',
    });
  });

  it('supprime une boutique', async () => {
    await boutiques.deleteShop({}, form({ id: 'b1' }));
    expect(dernierAppel()).toMatchObject({ route: '/shops/b1', method: 'DELETE' });
  });

  it('remonte le refus quand la boutique contient du stock', async () => {
    apiFetch.mockRejectedValue(new ApiError(409, 'Cette boutique contient 3 produit(s).'));
    await expect(boutiques.deleteShop({}, form({ id: 'b1' }))).resolves.toEqual({
      error: 'Cette boutique contient 3 produit(s).',
    });
  });
});
