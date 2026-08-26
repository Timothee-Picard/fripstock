import { ProductSheet } from '../product-sheet';
import { apiFetch } from '@/lib/api';
import { requireSession } from '@/lib/session';
import type { Shop, CategoryTree, Product, Status } from '@/lib/types';

/**
 * Même écran que la consultation, avec des champs de saisie : la mise en page
 * vient d'un composant unique, elle ne peut donc pas diverger.
 */
export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;

  const [product, statuses, shops, tree] = await Promise.all([
    apiFetch<Product>(`/products/${id}`),
    apiFetch<Status[]>('/statuses'),
    apiFetch<Shop[]>('/shops'),
    apiFetch<CategoryTree[]>('/categories/tree'),
  ]);

  return (
    <ProductSheet product={product} mode="modifier" tree={tree} shops={shops} statuses={statuses} />
  );
}
