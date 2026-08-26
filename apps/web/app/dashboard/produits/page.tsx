import Link from 'next/link';
import { BoutonSupprimerProduit } from './[id]/actions-fiche';
import { BoutonExport } from './bouton-export';
import { IconeModifier, IconeVoir } from '@/components/icones';
import { Filtres } from './filtres';
import { BadgeStatut } from '@/components/badge-statut';
import { appelApi } from '@/lib/api';
import { exigerSession } from '@/lib/session';
import {
  euros,
  LIBELLES_TYPE_VENTE,
  type Boutique,
  type Categorie,
  type PageProduits,
  type Statut,
} from '@/lib/types';

const FILTRES_CONNUS = [
  'recherche',
  'boutiqueId',
  'nonAssigne',
  'categorieId',
  'statutId',
  'typeVente',
  'page',
  'parPage',
] as const;

export default async function PageProduitsListe({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigerSession();
  const params = await searchParams;

  const requete = new URLSearchParams();
  for (const cle of FILTRES_CONNUS) {
    const valeur = params[cle];
    if (typeof valeur === 'string' && valeur !== '') requete.set(cle, valeur);
  }

  const [page, boutiques, categories, statuts] = await Promise.all([
    appelApi<PageProduits>(`/produits?${requete.toString()}`),
    appelApi<Boutique[]>('/boutiques'),
    appelApi<Categorie[]>('/categories'),
    appelApi<Statut[]>('/statuts'),
  ]);

  function lienPage(numero: number) {
    const suivants = new URLSearchParams(requete.toString());
    suivants.set('page', String(numero));
    return `/dashboard/produits?${suivants.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Produits</h1>
          <p className="mt-1 text-sm text-slate-600">
            {page.total} produit{page.total > 1 ? 's' : ''} — page {page.page} sur {page.pages}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BoutonExport />
          <Link
            href="/dashboard/produits/nouveau"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            Nouveau produit
          </Link>
        </div>
      </div>

      <Filtres boutiques={boutiques} categories={categories} statuts={statuts} />

      {page.produits.length === 0 ? (
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
              {page.produits.map((p) => (
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
                      href={`/dashboard/produits/${p.id}`}
                      className="font-medium text-slate-900 underline-offset-2 hover:underline"
                    >
                      {p.nom}
                    </Link>
                    <span className="block text-xs text-slate-600">
                      {p.categorie.nom} · {LIBELLES_TYPE_VENTE[p.typeVente]}
                      {p.quantite > 1 ? ` · ×${p.quantite}` : ''}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {p.boutique?.nom ?? <span className="text-slate-500">stock central</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                    {p.prixVendu ? (
                      <>
                        <span className="font-medium text-slate-900">{euros(p.prixVendu)}</span>
                        <span className="block text-xs text-slate-500 line-through">
                          {euros(p.prixVente)}
                        </span>
                      </>
                    ) : (
                      euros(p.prixVente)
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <BadgeStatut statut={p.statut} />
                  </td>
                  <td className="px-3 py-2">
                    {/* Icônes seules, mais chacune porte son libellé pour les
                        lecteurs d'écran et en infobulle. */}
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/dashboard/produits/${p.id}`}
                        title="Voir la fiche"
                        aria-label={`Voir ${p.nom}`}
                        className="rounded p-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                      >
                        <IconeVoir />
                      </Link>
                      <Link
                        href={`/dashboard/produits/${p.id}/modifier`}
                        title="Modifier"
                        aria-label={`Modifier ${p.nom}`}
                        className="rounded p-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                      >
                        <IconeModifier />
                      </Link>
                      <BoutonSupprimerProduit produitId={p.id} nom={p.nom} discret />
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
