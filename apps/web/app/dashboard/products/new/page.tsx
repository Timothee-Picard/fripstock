import { ProductForm } from './form';
import { AccessDenied } from '@/components/access-denied';
import { apiFetch } from '@/lib/api';
import { hasPermission } from '@/lib/permissions';
import { requireSession } from '@/lib/session';
import type { Shop, CategoryTree } from '@/lib/types';

export default async function NewProductPage() {
  const session = await requireSession();
  if (!hasPermission(session, 'products.manage')) {
    return <AccessDenied what="Nouveau produit" permission="products.manage" />;
  }

  const [tree, shops] = await Promise.all([
    apiFetch<CategoryTree[]>('/categories/tree'),
    apiFetch<Shop[]>('/shops'),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Nouveau produit</h1>
        <p className="mt-1 text-sm text-slate-600">
          Les attributs demandés dépendent de la catégorie choisie. Le statut initial est celui par
          défaut de l&apos;entreprise.
        </p>
      </div>
      <ProductForm tree={tree} shops={shops} />
    </div>
  );
}
