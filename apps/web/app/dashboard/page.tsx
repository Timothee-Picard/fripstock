import Link from 'next/link';
import { BarresCategories, CamembertStock, CourbeVentes } from '@/components/graphiques-dashboard';
import { SelecteurPeriode } from '@/components/selecteur-periode';
import { appelApi, ErreurApi } from '@/lib/api';
import { exigerSession } from '@/lib/session';
import { eurosNombre, type TableauDeBord } from '@/lib/types';

function Chiffre({
  libelle,
  valeur,
  detail,
}: {
  libelle: string;
  valeur: string;
  detail?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <span className="block text-xs uppercase tracking-wide text-slate-600">{libelle}</span>
      <span className="mt-1 block text-2xl font-semibold text-slate-900">{valeur}</span>
      {detail ? <span className="mt-0.5 block text-xs text-slate-600">{detail}</span> : null}
    </div>
  );
}

function Carte({
  titre,
  aide,
  children,
}: {
  titre: string;
  aide?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-medium text-slate-900">{titre}</h2>
      {aide ? <p className="mt-0.5 mb-2 text-xs text-slate-600">{aide}</p> : null}
      {children}
    </section>
  );
}

export default async function PageTableauDeBord({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await exigerSession();
  const params = await searchParams;
  const du = typeof params.du === 'string' ? params.du : undefined;

  let stats: TableauDeBord | null = null;
  let refus = false;
  try {
    stats = await appelApi<TableauDeBord>(`/stats/dashboard${du ? `?du=${du}T00:00:00.000Z` : ''}`);
  } catch (erreur) {
    // Un employé sans `stats.voir` n'a pas à tomber sur une page en erreur.
    if (erreur instanceof ErreurApi && erreur.statut === 403) refus = true;
    else throw erreur;
  }

  if (refus || !stats) {
    return (
      <div className="max-w-2xl space-y-4">
        <h1 className="text-xl font-semibold text-slate-900">Bonjour {session.prenom}</h1>
        <p className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Les statistiques sont réservées aux utilisateurs disposant de la permission « Voir les
          statistiques ». Vos autres écrans restent accessibles depuis le menu.
        </p>
      </div>
    );
  }

  const { ventes, stock, retours } = stats;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Bonjour {session.prenom}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {session.entreprise.nom} — du {new Date(stats.periode.du).toLocaleDateString('fr-FR')}{' '}
            au {new Date(stats.periode.au).toLocaleDateString('fr-FR')}
          </p>
        </div>
        <SelecteurPeriode />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Chiffre
          libelle="Chiffre d'affaires"
          valeur={eurosNombre(ventes.chiffreAffaires)}
          detail={`${ventes.nombre} vente${ventes.nombre > 1 ? 's' : ''}`}
        />
        <Chiffre
          libelle="Marge boutique"
          valeur={eurosNombre(ventes.marge)}
          detail="Après prix d'achat et part des déposants"
        />
        <Chiffre libelle="Panier moyen" valeur={eurosNombre(ventes.panierMoyen)} />
        <Chiffre
          libelle="Stock actif"
          valeur={`${stock.actifs}`}
          detail={`${eurosNombre(stock.valeurActive)} au prix affiché`}
        />
        <Chiffre
          libelle="Taux de retour"
          valeur={`${retours.taux} %`}
          detail={`${retours.rendus} rendu(s) sur ${retours.depotSurPeriode} en dépôt`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Carte titre="Ventes sur la période" aide="Montant réellement encaissé, jour par jour.">
          <CourbeVentes donnees={stats.parJour} />
        </Carte>
        <Carte titre="Stock par statut" aide="Tous statuts confondus, quantités comprises.">
          <CamembertStock donnees={stock.parStatut} />
        </Carte>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Carte titre="Catégories par chiffre d'affaires">
          <BarresCategories donnees={stats.topCategories} />
        </Carte>
        <Carte titre="Meilleures ventes">
          {stats.topProduits.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-600">Aucune vente sur la période.</p>
          ) : (
            <ol className="divide-y divide-slate-100">
              {stats.topProduits.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <Link
                    href={`/dashboard/produits/${p.id}`}
                    className="text-slate-900 underline-offset-2 hover:underline"
                  >
                    {p.nom}
                    {p.reference ? (
                      <span className="ml-2 font-mono text-xs text-slate-600">{p.reference}</span>
                    ) : null}
                  </Link>
                  <span className="font-medium text-slate-900">{eurosNombre(p.ca)}</span>
                </li>
              ))}
            </ol>
          )}
        </Carte>
      </div>

      <p className="text-xs text-slate-600">
        Vendu, stock actif et retour se déterminent par le comportement des statuts — vente, sort du
        stock, invendable ensuite — jamais par leur libellé : les chiffres restent justes après un
        renommage.
      </p>
    </div>
  );
}
