import { CategoryTreeView, CreateForm } from './tree';
import { apiFetch } from '@/lib/api';
import { requireSession } from '@/lib/session';
import type { AttributeDefinition, CategoryTree } from '@/lib/types';

export default async function CategoriesPage() {
  await requireSession();
  const [tree, attributes] = await Promise.all([
    apiFetch<CategoryTree[]>('/categories/tree'),
    apiFetch<AttributeDefinition[]>('/attributes'),
  ]);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <p className="mt-1 text-sm text-slate-600">
          Définies au niveau de l&apos;entreprise et partagées par toutes ses boutiques. Une
          catégorie ne peut être supprimée que si elle n&apos;a ni sous-catégorie ni produit. Chaque
          catégorie déclare les attributs qui seront demandés à la création d&apos;un produit — les
          valeurs, elles, appartiennent au produit.
        </p>
      </div>

      <CreateForm tree={tree} />
      <CategoryTreeView tree={tree} attributes={attributes} />
    </div>
  );
}
