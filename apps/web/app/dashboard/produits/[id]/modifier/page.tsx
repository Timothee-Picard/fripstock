import Link from 'next/link';
import { FormulaireModification } from './formulaire';
import { appelApi } from '@/lib/api';
import { exigerSession } from '@/lib/session';
import type { Boutique, CategorieArbre, Produit } from '@/lib/types';

export default async function PageModifierProduit({ params }: { params: Promise<{ id: string }> }) {
  await exigerSession();
  const { id } = await params;

  const [produit, arbre, boutiques] = await Promise.all([
    appelApi<Produit>(`/produits/${id}`),
    appelApi<CategorieArbre[]>('/categories/arbre'),
    appelApi<Boutique[]>('/boutiques'),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        {/* Retour à la liste et non à la fiche : c'est de là qu'on vient, et
            l'aller-retour fiche → modification → fiche piégeait la navigation. */}
        <Link href="/dashboard/produits" className="text-sm text-slate-600 underline">
          ← Produits
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">Modifier « {produit.nom} »</h1>
      </div>
      <FormulaireModification produit={produit} arbre={arbre} boutiques={boutiques} />
    </div>
  );
}
