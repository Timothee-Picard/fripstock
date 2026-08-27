import Link from 'next/link';
import { DeleteProductButton } from './[id]/detail-actions';
import { ExportButton } from './export-button';
import { SortableHeader } from './sortable-header';
import { EditIcon, ViewIcon } from '@/components/icons';
import { Filters } from './filters';
import { StatusBadge } from '@/components/status-badge';
import { AccessDenied } from '@/components/access-denied';
import { apiFetch, tolerantApiFetch } from '@/lib/api';
import { hasPermission } from '@/lib/permissions';
import { requireSession } from '@/lib/session';
import {
  euros,
  SALE_TYPE_LABELS,
  type Shop,
  type Category,
  type Depositor,
  type ProductPage,
  type Status,
} from '@/lib/types';

const KNOWN_FILTERS = [
  'search',
  'shopId',
  'unassigned',
  'categoryId',
  'depositorId',
  'statusId',
  'saleType',
  'sort',
  'direction',
  'page',
  'perPage',
] as const;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const peutCreer = hasPermission(session, 'products.manage');
  const peutExporter = hasPermission(session, 'export.csv');
  const params = await searchParams;
  // Retour de l'achat en lot : le nombre d'articles créés vient de l'URL, le
  // temps d'un rendu, plutôt que d'un état à faire vivre entre deux écrans.
  const lotCree = Number(params.lot ?? 0) || 0;

  const request = new URLSearchParams();
  for (const key of KNOWN_FILTERS) {
    const value = params[key];
    if (typeof value === 'string' && value !== '') request.set(key, value);
  }

  const [inventaire, shops, categories, statuses, depositorList] = await Promise.all([
    tolerantApiFetch<ProductPage>(`/products?${request.toString()}`),
    apiFetch<Shop[]>('/shops'),
    apiFetch<Category[]>('/categories'),
    apiFetch<Status[]>('/statuses'),
    // Tolérant : filtrer par déposant suppose le droit de les consulter, et
    // son absence ne doit pas mettre toute la liste en erreur.
    tolerantApiFetch<Depositor[]>('/depositors'),
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
          <p className="mt-1 text-sm text-slate-600">
            {page.total} produit{page.total > 1 ? 's' : ''} — page {page.page} sur {page.pages}
          </p>
        </div>
        {/* Ne proposer que ce qui aboutira : les deux boutons créent des
            produits pour de bon, et l'API les refuserait sans le droit. */}
        <div className="flex flex-wrap items-center gap-2">
          {peutExporter ? <ExportButton /> : null}
          {peutCreer ? (
            <>
              <Link
                href="/dashboard/products/lot"
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Achat en lot
              </Link>
              <Link
                href="/dashboard/products/new"
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                Nouveau produit
              </Link>
            </>
          ) : null}
        </div>
      </div>

      {lotCree ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {lotCree} article{lotCree > 1 ? 's' : ''} créé{lotCree > 1 ? 's' : ''} depuis le lot.
        </p>
      ) : null}

      <Filters
        shops={shops}
        categories={categories}
        statuses={statuses}
        depositors={depositorList.data ?? []}
      />

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
                <SortableHeader field="reference">Référence</SortableHeader>
                <SortableHeader field="name">Produit</SortableHeader>
                <th className="px-3 py-2 font-medium">Boutique</th>
                <SortableHeader field="salePrice">Prix</SortableHeader>
                <SortableHeader field="status">Statut</SortableHeader>
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
