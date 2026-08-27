import Link from 'next/link';
import { LotForm } from './form';
import { AccessDenied } from '@/components/access-denied';
import { apiFetch } from '@/lib/api';
import { hasPermission } from '@/lib/permissions';
import { requireSession } from '@/lib/session';
import type { AttributeDefinition, CategoryTree, Shop } from '@/lib/types';

export default async function LotPage() {
  const session = await requireSession();
  if (!hasPermission(session, 'products.manage')) {
    return <AccessDenied what="Achat en lot" permission="products.manage" />;
  }

  const [tree, shops, attributes] = await Promise.all([
    apiFetch<CategoryTree[]>('/categories/tree'),
    apiFetch<Shop[]>('/shops'),
    apiFetch<AttributeDefinition[]>('/attributes'),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/products"
          className="text-sm text-slate-600 underline underline-offset-2 hover:text-slate-900"
        >
          ← Produits
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">Achat en lot</h1>
        <p className="mt-1 text-sm text-slate-600">
          Un prix payé pour plusieurs articles — « 4 t-shirts et 2 chemises pour 7 € ». Chaque
          article devient un produit en achat-revente, avec sa part du prix du lot.
        </p>
      </div>
      <LotForm tree={tree} shops={shops} attributes={attributes} />
    </div>
  );
}
