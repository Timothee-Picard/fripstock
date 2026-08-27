import Link from 'next/link';
import { CategoryBars, StockPie, SalesCurve } from '@/components/dashboard-charts';
import { PeriodSelector } from '@/components/period-selector';
import { apiFetch, ApiError } from '@/lib/api';
import { requireSession } from '@/lib/session';
import { eurosNumber, type Dashboard } from '@/lib/types';

function Chiffre({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <span className="block text-xs uppercase tracking-wide text-slate-600">{label}</span>
      <span className="mt-1 block text-2xl font-semibold text-slate-900">{value}</span>
      {detail ? <span className="mt-0.5 block text-xs text-slate-600">{detail}</span> : null}
    </div>
  );
}

function Card({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-medium text-slate-900">{title}</h2>
      {hint ? <p className="mt-0.5 mb-2 text-xs text-slate-600">{hint}</p> : null}
      {children}
    </section>
  );
}

export default async function PageTableauDeBord({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const from = typeof params.from === 'string' ? params.from : undefined;

  let stats: Dashboard | null = null;
  let denied = false;
  try {
    stats = await apiFetch<Dashboard>(
      `/stats/dashboard${from ? `?from=${from}T00:00:00.000Z` : ''}`,
    );
  } catch (error) {
    // Un employé sans `stats.view` n'a pas à tomber sur une page en erreur.
    if (error instanceof ApiError && error.status === 403) denied = true;
    else throw error;
  }

  if (denied || !stats) {
    return (
      <div className="max-w-2xl space-y-4">
        <h1 className="text-xl font-semibold text-slate-900">Bonjour {session.firstName}</h1>
        <p className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Les statistiques sont réservées aux utilisateurs disposant de la permission « Voir les
          statistiques ». Vos autres écrans restent accessibles depuis le menu.
        </p>
      </div>
    );
  }

  const { sales, stock, returns, today } = stats;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Bonjour {session.firstName}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {session.company.name} — du {new Date(stats.period.from).toLocaleDateString('fr-FR')} au{' '}
            {new Date(stats.period.to).toLocaleDateString('fr-FR')}
          </p>
        </div>
        <PeriodSelector />
      </div>

      {/* La journée en cours passe avant la période : c'est la question qu'on
          se pose en fermant la boutique. */}
      <section className="flex flex-wrap items-baseline gap-x-6 gap-y-1 rounded-lg border border-slate-900 bg-slate-900 px-5 py-4 text-white">
        <h2 className="text-sm font-medium">
          Aujourd&apos;hui
          <span className="ml-2 text-xs font-normal text-slate-300">
            {new Date(today.date).toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </span>
        </h2>
        {today.count === 0 ? (
          <p className="text-sm text-slate-300">Aucune vente pour l&apos;instant.</p>
        ) : (
          <>
            <p className="text-sm">
              <strong className="text-lg font-semibold">{eurosNumber(today.revenue)}</strong>
              <span className="ml-1.5 text-slate-300">encaissés</span>
            </p>
            <p className="text-sm">
              <strong className="text-lg font-semibold">{eurosNumber(today.margin)}</strong>
              <span className="ml-1.5 text-slate-300">de marge</span>
            </p>
            <p className="text-sm text-slate-300">
              {today.count} vente{today.count > 1 ? 's' : ''}
            </p>
          </>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Chiffre
          label="Chiffre d'affaires"
          value={eurosNumber(sales.revenue)}
          detail={`${sales.count} vente${sales.count > 1 ? 's' : ''}`}
        />
        <Chiffre
          label="Marge boutique"
          value={eurosNumber(sales.margin)}
          detail="Après prix d'achat et part des déposants"
        />
        <Chiffre label="Panier moyen" value={eurosNumber(sales.averageBasket)} />
        <Chiffre
          label="Stock actif"
          value={`${stock.active}`}
          detail={`${eurosNumber(stock.activeValue)} au prix affiché`}
        />
        <Chiffre
          label="Taux de retour"
          value={`${returns.rate} %`}
          detail={`${returns.returned} rendu(s) sur ${returns.consignmentOverPeriod} en dépôt`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Ventes sur la période" hint="Montant réellement encaissé, jour par jour.">
          <SalesCurve data={stats.byDay} />
        </Card>
        <Card title="Stock par statut" hint="Tous statuts confondus, quantités comprises.">
          <StockPie data={stock.byStatus} />
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Catégories par chiffre d'affaires">
          <CategoryBars data={stats.topCategories} />
        </Card>
        <Card title="Meilleures ventes">
          {stats.topProducts.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-600">Aucune vente sur la période.</p>
          ) : (
            <ol className="divide-y divide-slate-100">
              {stats.topProducts.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <Link
                    href={`/dashboard/products/${p.id}`}
                    className="text-slate-900 underline-offset-2 hover:underline"
                  >
                    {p.name}
                    {p.reference ? (
                      <span className="ml-2 font-mono text-xs text-slate-600">{p.reference}</span>
                    ) : null}
                  </Link>
                  <span className="font-medium text-slate-900">{eurosNumber(p.revenue)}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <p className="text-xs text-slate-600">
        Vendu, stock actif et retour se déterminent par le comportement des statuts — vente, sort du
        stock, invendable ensuite — jamais par leur libellé : les chiffres restent justes après un
        renaming.
      </p>
    </div>
  );
}
