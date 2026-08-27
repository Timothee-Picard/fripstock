import { describe, expect, it } from 'vitest';
import { sectionTitle } from './navigation';

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
