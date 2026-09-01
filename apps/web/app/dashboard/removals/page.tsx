import Link from 'next/link';
import { RemovalRow, RemovalsBulk } from './list';
import { grouperRetraits } from './sections';
import { AccessDenied } from '@/components/access-denied';
import { StatusBadge } from '@/components/status-badge';
import { apiFetch } from '@/lib/api';
import { formatDate } from '@/lib/dates';
import { hasPermission } from '@/lib/permissions';
import { requireSession } from '@/lib/session';
import type { RemovalPage } from '@/lib/types';

/**
 * Liste complète des retraits à faire.
 *
 * Le tableau de bord n'en montre que les derniers, pour ne pas noyer les
 * chiffres sous cinquante lignes. Il fallait pourtant pouvoir atteindre **un
 * article précis** qui n'y figure plus — d'où cet écran, cherchable et paginé.
 *
 * Il ne vit pas dans la liste des produits : on n'y vient pas consulter un
 * stock, on y vient solder une corvée. D'où le rangement par **endroit où
 * aller** — le site d'un côté, chaque boutique de l'autre — et non par statut :
 * c'est ainsi qu'on fait la tournée.
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

  // Route dédiée et non un filtre de la liste des produits : les deux corvées
  // n'ont pas le même périmètre — retirer une annonce vaut pour toute
  // l'entreprise, décrocher un vêtement demande de voir les produits de la
  // boutique — et le filtrage générique de la liste ne sait pas les distinguer.
  const requete = search ? `?search=${encodeURIComponent(search)}` : '';
  const { products, total } = await apiFetch<RemovalPage>(`/products/removals${requete}`);
  const sections = grouperRetraits(products);

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
          {total > products.length ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
              {products.length} affichés sur {total}. Traitez ceux-ci, les suivants apparaîtront —
              ou cherchez un article précis.
            </p>
          ) : null}

          {sections.map((section) => (
            <section key={section.key} className="rounded-lg border border-slate-200 bg-white">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-200 px-4 py-3">
                <h2 className="text-sm font-medium text-slate-900">{section.title}</h2>
                <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white">
                  {section.items.length}
                </span>
                <p className="text-xs text-slate-600">{section.hint}</p>
                {/* Une action groupée par endroit, et pas une pour tout : on
                    solde une tournée quand on l'a faite, pas les trois. */}
                <div className="ml-auto">
                  <RemovalsBulk ids={section.items.map((p) => p.id)} />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-2xl text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-4 py-2 font-medium">Article</th>
                      <th className="px-4 py-2 font-medium">Statut</th>
                      <th className="px-4 py-2 font-medium">Vendu le</th>
                      <th className="px-4 py-2 font-medium">
                        <span className="sr-only">Action</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {section.items.map((p) => (
                      <tr key={p.id}>
                        <td className="px-4 py-2">
                          <Link
                            href={`/dashboard/products/${p.id}`}
                            className="font-medium text-slate-900 underline-offset-2 hover:underline"
                          >
                            {p.name}
                          </Link>
                          {p.reference ? (
                            <span className="ml-2 font-mono text-xs text-slate-600">
                              {p.reference}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-2">
                          <StatusBadge status={p.status} />
                        </td>
                        <td className="px-4 py-2 text-slate-700">
                          {p.soldAt ? formatDate(p.soldAt) : '—'}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <RemovalRow id={p.id} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
