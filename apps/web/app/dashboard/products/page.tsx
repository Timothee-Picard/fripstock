import Link from 'next/link';
import { DeleteProductButton } from './[id]/detail-actions';
import { ExportButton } from './export-button';
import { EditIcon, ViewIcon } from '@/components/icons';
import { Filters } from './filters';
import { StatusBadge } from '@/components/status-badge';
import { AccessDenied } from '@/components/access-denied';
import { apiFetch, tolerantApiFetch } from '@/lib/api';
import { requireSession } from '@/lib/session';
import {
  euros,
  SALE_TYPE_LABELS,
  type Shop,
  type Category,
  type ProductPage,
  type Status,
} from '@/lib/types';

const KNOWN_FILTERS = [
  'search',
  'shopId',
  'unassigned',
  'categoryId',
  'statusId',
  'saleType',
  'page',
  'perPage',
] as const;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSession();
  const params = await searchParams;

  const request = new URLSearchParams();
  for (const key of KNOWN_FILTERS) {
    const value = params[key];
    if (typeof value === 'string' && value !== '') request.set(key, value);
  }

  const [inventaire, shops, categories, statuses] = await Promise.all([
    tolerantApiFetch<ProductPage>(`/products?${request.toString()}`),
    apiFetch<Shop[]>('/shops'),
    apiFetch<Category[]>('/categories'),
    apiFetch<Status[]>('/statuses'),
  ]);

  if (inventaire.denied || !inventaire.data) {
    return <AccessDenied what="Produits" permission="products.view" />;
  }
  const page = inventaire.data;

  function lienPage(numero: number) {
    const next = new URLSearchParams(request.toString());
    next.set('page', String(numero));
    return `/dashboard/products?${next.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Produits</h1>
          <p className="mt-1 text-sm text-slate-600">
            {page.total} product{page.total > 1 ? 's' : ''} — page {page.page} sur {page.pages}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton />
          <Link
            href="/dashboard/products/new"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            Nouveau produit
          </Link>
        </div>
      </div>

      <Filters shops={shops} categories={categories} statuses={statuses} />

      {page.products.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">
          Aucun produit ne correspond.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Photo</th>
                <th className="px-3 py-2 font-medium">Référence</th>
                <th className="px-3 py-2 font-medium">Produit</th>
                <th className="px-3 py-2 font-medium">Boutique</th>
                <th className="px-3 py-2 font-medium">Prix</th>
                <th className="px-3 py-2 font-medium">Statut</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {page.products.map((p) => (
                <tr key={p.id} className="align-middle">
                  <td className="px-3 py-2">
                    {p.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/photos/${p.photoUrl}`}
                        alt=""
                        className="size-10 rounded object-cover"
                      />
                    ) : (
                      <span className="flex size-10 items-center justify-center rounded bg-slate-100 text-xs text-slate-500">
                        —
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-700">
                    {p.reference ?? '—'}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/dashboard/products/${p.id}`}
                      className="font-medium text-slate-900 underline-offset-2 hover:underline"
                    >
                      {p.name}
                    </Link>
                    <span className="block text-xs text-slate-600">
                      {p.category.name} · {SALE_TYPE_LABELS[p.saleType]}
                      {p.quantity > 1 ? ` · ×${p.quantity}` : ''}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {p.shop?.name ?? <span className="text-slate-500">stock central</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                    {p.soldPrice ? (
                      <>
                        <span className="font-medium text-slate-900">{euros(p.soldPrice)}</span>
                        <span className="block text-xs text-slate-500 line-through">
                          {euros(p.salePrice)}
                        </span>
                      </>
                    ) : (
                      euros(p.salePrice)
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-3 py-2">
                    {/* Icônes seules, mais chacune porte son libellé pour les
                        lecteurs d'écran et en infobulle. */}
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/dashboard/products/${p.id}`}
                        title="Voir la fiche"
                        aria-label={`Voir ${p.name}`}
                        className="rounded p-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                      >
                        <ViewIcon />
                      </Link>
                      <Link
                        href={`/dashboard/products/${p.id}/edit`}
                        title="Modifier"
                        aria-label={`Modifier ${p.name}`}
                        className="rounded p-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                      >
                        <EditIcon />
                      </Link>
                      <DeleteProductButton productId={p.id} name={p.name} discret />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {page.pages > 1 ? (
        <nav className="flex items-center justify-center gap-2 text-sm">
          {Array.from({ length: page.pages }, (_, i) => i + 1).map((n) => (
            <Link
              key={n}
              href={lienPage(n)}
              aria-current={n === page.page ? 'page' : undefined}
              className={
                n === page.page
                  ? 'rounded bg-slate-900 px-3 py-1 font-medium text-white'
                  : 'rounded border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50'
              }
            >
              {n}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
