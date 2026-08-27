import Link from 'next/link';
import { Counter } from './counter';
import { CategoryBars, StockPie, SalesCurve } from '@/components/dashboard-charts';
import { PeriodSelector } from '@/components/period-selector';
import { apiFetch } from '@/lib/api';
import { hasPermission } from '@/lib/permissions';
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
  // Boutique choisie dans l'en-tête. Absente : toutes celles que la session
  // autorise — l'API applique la même règle, elle ne croit pas l'écran.
  const shopId = typeof params.shopId === 'string' ? params.shopId : undefined;
  const shopName = session.shops.find((b) => b.shopId === shopId)?.name;

  const requete = new URLSearchParams();
  if (from) requete.set('from', `${from}T00:00:00.000Z`);
  if (shopId) requete.set('shopId', shopId);

  // Aucun 403 à rattraper ici : l'API ne refuse plus la page, elle n'y met que
  // les blocs autorisés. Un bloc absent est un droit qui manque, pas une panne.
  const stats = await apiFetch<Dashboard>(`/stats/dashboard?${requete.toString()}`);
  const { sales, stock, returns, today, byDay, topCategories, topProducts } = stats;

  const canSell = hasPermission(session, 'products.changeStatus');

  // Les cartes de graphiques se composent, plutôt que d'occuper des colonnes
  // fixes : à un seul bloc autorisé, la grille ne doit pas laisser un trou.
  const cartes: React.ReactNode[] = [];
  if (byDay) {
    cartes.push(
      <Card
        key="ventes"
        title="Ventes sur la période"
        hint="Montant réellement encaissé, jour par jour."
      >
        <SalesCurve data={byDay} />
      </Card>,
    );
  }
  if (stock) {
    cartes.push(
      <Card
        key="stock"
        title="Stock par statut"
        hint="Tous statuts confondus, quantités comprises."
      >
        <StockPie data={stock.byStatus} />
      </Card>,
    );
  }
  if (topCategories) {
    cartes.push(
      <Card key="categories" title="Catégories par chiffre d'affaires">
        <CategoryBars data={topCategories} />
      </Card>,
    );
  }
  if (topProducts) {
    cartes.push(
      <Card key="meilleures" title="Meilleures ventes">
        {topProducts.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-600">Aucune vente sur la période.</p>
        ) : (
          <ol className="divide-y divide-slate-100">
            {topProducts.map((p) => (
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
      </Card>,
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Bonjour {session.firstName}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {session.company.name} — {shopName ?? 'toutes les boutiques'}
        </p>
      </div>

      {/* La journée en cours et le comptoir disent le présent : ils ne
          dépendent pas de la période, et passent donc avant le trait. */}
      {today ? (
        <section className="flex flex-wrap items-baseline gap-x-6 gap-y-1 rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-900">
          <h2 className="text-sm font-medium">
            Aujourd&apos;hui
            <span className="ml-2 text-xs font-normal text-emerald-700">
              {/* `today.date` est un jour calendaire (AAAA-MM-JJ), pas un
                  instant : on le lit à midi UTC et on le formate en UTC, pour
                  qu'aucun fuseau ne le fasse glisser d'un jour. */}
              {new Date(`${today.date}T12:00:00Z`).toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                timeZone: 'UTC',
              })}
            </span>
          </h2>
          {today.count === 0 ? (
            <p className="text-sm text-emerald-700">Aucune vente pour l&apos;instant.</p>
          ) : (
            <>
              <p className="text-sm">
                <strong className="text-lg font-semibold">{eurosNumber(today.revenue)}</strong>
                <span className="ml-1.5 text-emerald-700">encaissés</span>
              </p>
              {/* La marge dit les prix d'achat : elle suit `stats.view`, pas le
                  comptoir. */}
              {today.margin !== undefined ? (
                <p className="text-sm">
                  <strong className="text-lg font-semibold">{eurosNumber(today.margin)}</strong>
                  <span className="ml-1.5 text-emerald-700">de marge</span>
                </p>
              ) : null}
              <p className="text-sm text-emerald-700">
                {today.count} vente{today.count > 1 ? 's' : ''}
              </p>
            </>
          )}
        </section>
      ) : null}

      {/* Le comptoir dépend de la boutique choisie en haut, pas de la période :
          il était jusqu'ici collé aux raccourcis 7 jours / 3 mois, qui ne le
          concernent en rien. */}
      {canSell ? <Counter shopId={shopId} shopName={shopName} /> : null}

      {sales || stock ? (
        <>
          {/* La période ne gouverne que les chiffres de vente : le stock est
              une photo de l'instant, sa requête ne porte aucune borne de date.
              Proposer « 7 jours / 3 mois » au-dessus du seul stock promettrait
              un filtre qui ne filtre rien. */}
          <div className="flex flex-wrap items-end justify-between gap-3 border-t border-slate-200 pt-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {sales ? 'Statistiques' : 'Stock'}
              </h2>
              <p className="mt-0.5 text-sm text-slate-600">
                {sales ? (
                  <>
                    du {new Date(stats.period.from).toLocaleDateString('fr-FR')} au{' '}
                    {new Date(stats.period.to).toLocaleDateString('fr-FR')}
                  </>
                ) : (
                  "État actuel de la boutique, à l'instant."
                )}
              </p>
            </div>
            {sales ? <PeriodSelector /> : null}
          </div>

          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(12rem,1fr))]">
            {sales ? (
              <>
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
              </>
            ) : null}
            {stock ? (
              <Chiffre
                label="Stock actif"
                value={`${stock.active}`}
                detail={`${eurosNumber(stock.activeValue)} au prix affiché`}
              />
            ) : null}
            {returns ? (
              <Chiffre
                label="Taux de retour"
                value={`${returns.rate} %`}
                detail={`${returns.returned} rendu(s) sur ${returns.consignmentOverPeriod} en dépôt`}
              />
            ) : null}
          </div>

          <div className={cartes.length > 1 ? 'grid gap-4 xl:grid-cols-2' : 'grid gap-4'}>
            {cartes}
          </div>

          <p className="text-xs text-slate-600">
            {sales
              ? 'Vendu, stock actif et retour se déterminent par le comportement des statuts — vente, sort du stock, invendable ensuite — jamais par leur libellé : les chiffres restent justes après un renaming.'
              : 'Le stock actif se détermine par le comportement des statuts — sort du stock ou non — jamais par leur libellé : les chiffres restent justes après un renaming.'}
          </p>
        </>
      ) : (
        <p className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
          {canSell
            ? 'Les chiffres de la boutique sont réservés aux droits « Voir les chiffres de vente » et « Voir l’état du stock ».'
            : 'Votre compte n’ouvre aucun tableau de bord. Vos autres écrans restent accessibles depuis le menu.'}
        </p>
      )}
    </div>
  );
}
