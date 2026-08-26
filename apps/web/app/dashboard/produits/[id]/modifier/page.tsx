import { FicheProduit } from '../fiche-produit';
import { appelApi } from '@/lib/api';
import { exigerSession } from '@/lib/session';
import type { Boutique, CategorieArbre, Produit, Statut } from '@/lib/types';

/**
 * Même écran que la consultation, avec des champs de saisie : la mise en page
 * vient d'un composant unique, elle ne peut donc pas diverger.
 */
export default async function PageModifierProduit({ params }: { params: Promise<{ id: string }> }) {
  await exigerSession();
  const { id } = await params;

  const [produit, statuts, boutiques, arbre] = await Promise.all([
    appelApi<Produit>(`/produits/${id}`),
    appelApi<Statut[]>('/statuts'),
    appelApi<Boutique[]>('/boutiques'),
    appelApi<CategorieArbre[]>('/categories/arbre'),
  ]);

  return (
    <FicheProduit
      produit={produit}
      mode="modifier"
      arbre={arbre}
      boutiques={boutiques}
      statuts={statuts}
    />
  );
}
