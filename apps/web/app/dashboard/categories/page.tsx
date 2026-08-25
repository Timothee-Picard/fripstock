import { ArbreCategories, FormulaireCreation } from './arbre';
import { appelApi } from '@/lib/api';
import { exigerSession } from '@/lib/session';
import type { AttributDefinition, CategorieArbre } from '@/lib/types';

export default async function PageCategories() {
  await exigerSession();
  const [arbre, attributs] = await Promise.all([
    appelApi<CategorieArbre[]>('/categories/arbre'),
    appelApi<AttributDefinition[]>('/attributs'),
  ]);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Catégories</h1>
        <p className="mt-1 text-sm text-slate-600">
          Définies au niveau de l&apos;entreprise et partagées par toutes ses boutiques. Une
          catégorie ne peut être supprimée que si elle n&apos;a ni sous-catégorie ni produit. Chaque
          catégorie déclare les attributs qui seront demandés à la création d&apos;un produit — les
          valeurs, elles, appartiennent au produit.
        </p>
      </div>

      <FormulaireCreation arbre={arbre} />
      <ArbreCategories arbre={arbre} attributs={attributs} />
    </div>
  );
}
