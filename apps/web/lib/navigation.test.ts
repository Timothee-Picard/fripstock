import { describe, expect, it } from 'vitest';
import { NAVIGATION, sectionTitle } from './navigation';

describe('sectionTitle', () => {
  it('nomme le tableau de bord sur sa racine exacte', () => {
    expect(sectionTitle('/dashboard')).toBe('Tableau de bord');
  });

  it('préfère le préfixe le plus long', () => {
    // `/dashboard` préfixe toutes les routes : sans cette règle, chaque écran
    // s'appellerait « Tableau de bord ».
    expect(sectionTitle('/dashboard/products')).toBe('Produits');
  });

  it('garde le nom de la section sur une sous-page', () => {
    // L'en-tête dit d'où l'on vient ; la page garde son titre propre.
    expect(sectionTitle('/dashboard/products/new')).toBe('Produits');
    expect(sectionTitle('/dashboard/products/abc/edit')).toBe('Produits');
  });

  it('nomme aussi un écran hors menu', () => {
    expect(sectionTitle('/dashboard/profile')).toBe('Mon profil');
  });

  it('ne confond pas deux sections dont l’une préfixe le texte de l’autre', () => {
    // `/dashboard/productsXXL` n'est pas une sous-page de `/dashboard/products`.
    expect(sectionTitle('/dashboard/productsXXL')).toBe('Tableau de bord');
  });

  it('ne rend rien hors du tableau de bord', () => {
    expect(sectionTitle('/login')).toBeNull();
  });
});

describe('NAVIGATION', () => {
  const retraits = NAVIGATION.find((e) => e.href === '/dashboard/removals')!;

  it('ouvre les retraits à l’un OU l’autre métier', () => {
    // Exiger les deux droits masquerait l'entrée à chacun d'eux : celui qui
    // dépublie les annonces et celui qui décroche les vêtements.
    expect(retraits.permission).toBeUndefined();
    expect(retraits.anyPermission).toEqual(['online.manage', 'products.manage']);
  });

  it('nomme la section des retraits', () => {
    expect(sectionTitle('/dashboard/removals')).toBe('Retraits à faire');
  });
});
