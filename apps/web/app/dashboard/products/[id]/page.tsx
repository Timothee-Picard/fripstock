import { ProductSheet } from './product-sheet';
import { apiFetch } from '@/lib/api';
import { hasPermission } from '@/lib/permissions';
import { requireSession } from '@/lib/session';
import type { Shop, CategoryTree, Product, Status } from '@/lib/types';

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;

  const [product, statuses, shops, tree] = await Promise.all([
    apiFetch<Product>(`/products/${id}`),
    apiFetch<Status[]>('/statuses'),
    apiFetch<Shop[]>('/shops'),
    apiFetch<CategoryTree[]>('/categories/tree'),
  ]);

  return (
    <ProductSheet
      product={product}
      mode="voir"
      tree={tree}
      shops={shops}
      statuses={statuses}
      canManageOnline={hasPermission(session, 'online.manage')}
    />
  );
}
