import Link from 'next/link';
import { RemovalRow, RemovalsBulk } from './list';
import { AccessDenied } from '@/components/access-denied';
import { StatusBadge } from '@/components/status-badge';
import { tolerantApiFetch } from '@/lib/api';
import { formatDate } from '@/lib/dates';
import { hasPermission } from '@/lib/permissions';
import { requireSession } from '@/lib/session';
import type { ProductPage } from '@/lib/types';

const PAR_PAGE = 50;

/** Lien de pagination, en conservant la recherche en cours. */
function lien(search: string, page: number): string {
  const params = new URLSearchParams({ page: String(page) });
  if (search) params.set('search', search);
  return `/dashboard/removals?${params.toString()}`;
}

/**
 * Liste complète des retraits à faire.
 *
 * Le tableau de bord n'en montre que les derniers, pour ne pas noyer les
 * chiffres sous cinquante lignes. Il fallait pourtant pouvoir atteindre **un
 * article précis** qui n'y figure plus — d'où cet écran, cherchable et paginé.
 *
 * Il ne vit pas dans la liste des produits : on n'y vient pas consulter un
 * stock, on y vient solder une corvée.
 */
export default async function RemovalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const params = await searchParams;

  // Les deux métiers ouvrent l'écran : celui qui dépublie les annonces et celui
  // qui décroche les vêtements.
  if (!hasPermission(session, 'online.manage') && !hasPermission(session, 'products.manage')) {
    return (
      <AccessDenied
        what="Retraits à faire"
        permission="online.manage"
        why="« Créer et modifier des produits » ouvre aussi cet écran : c'est ce droit qui permet d'aller décrocher un vêtement vendu en ligne."
      />
    );
  }

  const search = typeof params.search === 'string' ? params.search : '';
  const page = Number(params.page ?? 1) || 1;

  const requete = new URLSearchParams({
    pendingRemoval: 'true',
    sort: 'soldAt',
    direction: 'desc',
    page: String(page),
    perPage: String(PAR_PAGE),
  });
  if (search) requete.set('search', search);

  // Toléré plutôt que fatal : les deux droits de retrait ouvrent l'écran, mais
  // c'est `products.view` qui ouvre la liste. Le refus se nomme, il ne casse
  // pas la page.
  const inventaire = await tolerantApiFetch<ProductPage>(`/products?${requete.toString()}`);
  if (inventaire.denied) {
    return <AccessDenied what="Retraits à faire" permission="products.view" />;
  }

  const { products, total, pages } = inventaire.data;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Articles vendus d&apos;un côté et encore présents de l&apos;autre. Le tableau de bord
        n&apos;en montre que les derniers ; cette liste est complète.
      </p>

      <form className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-700">Recherche</span>
          <input
            name="search"
            defaultValue={search}
            placeholder="Nom, référence…"
            className="rounded-md border border-slate-400 bg-white px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-500"
          />
        </label>
        {search ? (
          <Link
            href="/dashboard/removals"
            className="pb-1.5 text-sm text-slate-600 underline underline-offset-2 hover:text-slate-900"
          >
            Réinitialiser
          </Link>
        ) : null}
        <span className="ml-auto pb-1.5 text-sm text-slate-600">
          {total} retrait{total > 1 ? 's' : ''} en attente
        </span>
      </form>

      {products.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
          {search
            ? 'Aucun retrait ne correspond à cette recherche.'
            : 'Rien à retirer. Tout est à jour.'}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-3xl text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Article</th>
                  <th className="px-3 py-2 font-medium">Boutique</th>
                  <th className="px-3 py-2 font-medium">Vendu le</th>
                  <th className="px-3 py-2 font-medium">Geste à faire</th>
                  <th className="px-3 py-2 font-medium">
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2">
                      <Link
                        href={`/dashboard/products/${p.id}`}
                        className="font-medium text-slate-900 underline-offset-2 hover:underline"
                      >
                        {p.name}
                      </Link>
                      {p.reference ? (
                        <span className="ml-2 font-mono text-xs text-slate-600">{p.reference}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{p.shop?.name ?? 'Stock central'}</td>
                    <td className="px-3 py-2 text-slate-700">
                      {p.soldAt ? formatDate(p.soldAt) : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={p.status} />
                        {/* Le geste se déduit du flag du statut de vente, jamais
                            de son libellé — un statut peut être renommé. */}
                        <span className="text-slate-700">
                          {p.status.isOnlineSale ? 'décrocher le vêtement' : "dépublier l'annonce"}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <RemovalRow id={p.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <RemovalsBulk ids={products.map((p) => p.id)} />
            {pages > 1 ? (
              <nav className="ml-auto flex items-center gap-2 text-sm">
                {page > 1 ? (
                  <Link
                    href={lien(search, page - 1)}
                    scroll={false}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
                  >
                    Précédent
                  </Link>
                ) : null}
                <span className="text-slate-600">
                  Page {page} sur {pages}
                </span>
                {page < pages ? (
                  <Link
                    href={lien(search, page + 1)}
                    scroll={false}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
                  >
                    Suivant
                  </Link>
                ) : null}
              </nav>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
