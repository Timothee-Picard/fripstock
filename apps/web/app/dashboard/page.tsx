import { Fragment } from 'react';
import Link from 'next/link';
import { saveDashboardLayout } from './actions';
import { Counter } from './counter';
import { Removals } from './removals-card';
import {
  AttributeBars,
  CategoryBars,
  RotationBars,
  StockPie,
  SalesCurve,
} from '@/components/dashboard-charts';
import { DashboardModules, type DashboardModule } from '@/components/dashboard-modules';
import { PeriodSelector } from '@/components/period-selector';
import { ShopSelector } from '@/components/shop-selector';
import { apiFetch } from '@/lib/api';
import { formatCalendarDay, formatDate } from '@/lib/dates';
import { arrangeModules, ATTRIBUTE_MODULE_PREFIX } from '@/lib/dashboard-modules';
import { hasPermission, hasPermissionOnShop } from '@/lib/permissions';
import { requireSession } from '@/lib/session';
import {
  eurosNumber,
  ONLINE_CHANNEL,
  type Dashboard,
  type DashboardLayout,
  type Status,
} from '@/lib/types';

function Chiffre({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <span className="block text-xs uppercase tracking-wide text-slate-600">{label}</span>
      <span className="mt-1 block text-2xl font-semibold text-slate-900">{value}</span>
      {detail ? <span className="mt-0.5 block text-xs text-slate-600">{detail}</span> : null}
    </div>
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
  // Boutique choisie juste sous le titre, et nulle part ailleurs : elle ne
  // gouverne que cet écran. Absente : toutes celles que la session autorise —
  // l'API applique la même règle, elle ne croit pas l'écran.
  const enLigne = params.channel === ONLINE_CHANNEL;
  const shopId = !enLigne && typeof params.shopId === 'string' ? params.shopId : undefined;
  const shopName = session.shops.find((b) => b.shopId === shopId)?.name;
  const lieu = enLigne ? 'la boutique en ligne' : (shopName ?? 'toutes les boutiques');

  const requete = new URLSearchParams();
  if (from) requete.set('from', `${from}T00:00:00.000Z`);
  if (shopId) requete.set('shopId', shopId);
  if (enLigne) requete.set('channel', ONLINE_CHANNEL);

  // Aucun 403 à rattraper ici : l'API ne refuse plus la page, elle n'y met que
  // les blocs autorisés. Un bloc absent est un droit qui manque, pas une panne.
  // La vente rapide en ligne a besoin du statut visé. C'est le flag qui le
  // désigne, jamais le libellé — le gérant peut renommer ses statuts.
  // Le rangement des modules est une préférence de compte : il ne dépend ni de
  // la période ni de la boutique regardée, et se lit donc à part.
  const [stats, statuses, layout] = await Promise.all([
    apiFetch<Dashboard>(`/stats/dashboard?${requete.toString()}`),
    apiFetch<Status[]>('/statuses'),
    apiFetch<DashboardLayout>('/stats/layout'),
  ]);
  const statutEnLigne = statuses.find((s) => s.isOnlineSale)?.id;
  const {
    sales,
    stock,
    returns,
    today,
    byDay,
    topCategories,
    topProducts,
    rotation,
    topAttributes,
    removals,
  } = stats;

  // Vendre est un droit **par boutique** : le détenir à la Gare n'autorise pas
  // à encaisser au Centre-ville. Le comptoir ne s'affiche donc que là où la
  // vente passera — sinon l'écran promet une action que l'API refuse.
  const canSell = hasPermissionOnShop(session, 'products.changeStatus', shopId);
  // Pour parler du compte plutôt que de la boutique regardée : « vous ne
  // pouvez pas vendre ici » et « votre compte ne vend nulle part » ne se
  // corrigent pas de la même façon.
  const canSellSomewhere = hasPermission(session, 'products.changeStatus');
  const canSellOnline = hasPermission(session, 'online.manage');
  // La boutique en ligne n'apparaît au sélecteur que si on y a affaire :
  // la gérer, ou avoir le droit d'en lire les chiffres.
  const canSeeOnline =
    canSellOnline || hasPermission(session, 'stats.view') || hasPermission(session, 'stock.view');

  // Les modules du tableau de bord, dans leur ordre par défaut. Chacun n'existe
  // que si son bloc est là : un bloc absent est un droit qui manque, et une
  // carte vide se lirait comme « rien à signaler » plutôt que « pas pour vous ».
  //
  // Les classements par attribut arrivent en dernier et masqués par défaut :
  // une entreprise en a quatre ou cinq, et les afficher tous d'office noierait
  // le reste. On les ajoute depuis « Personnaliser ».
  type Candidate = Omit<DashboardModule, 'visible'> & { defaultVisible: boolean };
  const modules: Candidate[] = [];
  const add = (m: Omit<Candidate, 'defaultVisible'> & { defaultVisible?: boolean }) => {
    modules.push({
      defaultVisible: true,
      ...m,
      // Ces contenus voyagent dans un **tableau** de propriétés jusqu'au
      // composant client : React y réclame une clé, comme pour n'importe quelle
      // liste d'éléments. Elle est posée ici, sur la clé du module, plutôt que
      // recopiée à la main sur chaque graphique.
      content: <Fragment key={m.key}>{m.content}</Fragment>,
    });
  };

  if (byDay) {
    add({
      key: 'sales-curve',
      title: 'Ventes sur la période',
      hint: 'Montant réellement encaissé, jour par jour.',
      content: <SalesCurve data={byDay} />,
    });
  }
  if (stock) {
    add({
      key: 'stock-pie',
      title: enLigne ? 'Articles en ligne, par statut' : 'Stock par statut',
      hint: 'Tous statuts confondus, quantités comprises.',
      content: <StockPie data={stock.byStatus} />,
    });
  }
  if (topCategories) {
    add({
      key: 'top-categories',
      title: "Catégories par chiffre d'affaires",
      content: <CategoryBars data={topCategories} />,
    });
  }
  if (topProducts) {
    add({
      key: 'top-products',
      title: 'Meilleures ventes',
      content:
        topProducts.length === 0 ? (
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
        ),
    });
  }
  if (rotation) {
    add({
      key: 'rotation',
      title: 'Temps de rotation',
      hint: "De l'entrée en stock à la vente, sur les articles vendus de la période.",
      content: <RotationBars data={rotation} />,
    });
  }
  // Un candidat par attribut, mais **un seul module** aux yeux de l'écran :
  // la réserve n'en propose qu'une entrée générique, et l'attribut se choisit
  // sur la carte. Les attributs vont et viennent — en énumérer un par entrée
  // ferait une réserve qui se périme, et une carte orpheline à la première
  // suppression. Ici, l'attribut supprimé disparaît du catalogue, sa carte avec
  // lui, et le rangement se recolle tout seul.
  for (const attribute of topAttributes ?? []) {
    add({
      key: `${ATTRIBUTE_MODULE_PREFIX}${attribute.id}`,
      title: `Meilleures ventes par ${attribute.name.toLowerCase()}`,
      hint:
        attribute.type === 'MULTISELECT'
          ? 'Un article portant plusieurs valeurs compte dans chacune.'
          : undefined,
      defaultVisible: false,
      attribute: { id: attribute.id, name: attribute.name },
      content: <AttributeBars data={attribute} />,
    });
  }

  // Le rangement enregistré l'emporte ; ce qu'il ne mentionne pas se pose à la
  // fin, avec sa visibilité par défaut.
  const arranged = arrangeModules(modules, layout.modules);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Bonjour {session.firstName}</h1>
        {/* L'entreprise seule : la boutique se lit juste en dessous, sur le
            sélecteur, et la redire ici la ferait apparaître deux fois. */}
        <p className="mt-1 text-sm text-slate-600">{session.company.name}</p>
      </div>

      {/* Le choix de boutique commande tout ce qui suit — recette, comptoir
          et chiffres — il se pose donc en premier. Il était dans l'en-tête, où
          il donnait à croire qu'il filtrait aussi le catalogue, lequel a son
          propre filtre boutique. */}
      <ShopSelector shops={session.shops} canSeeOnline={canSeeOnline} />

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
              {formatCalendarDay(today.date, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
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

      {/* Les retraits à faire suivent la boutique choisie et le droit détenu :
          l'API n'envoie que la liste dont l'utilisateur a la charge. Ils
          passent avant les chiffres — c'est une action, pas une lecture. */}
      <Removals toDelist={removals?.toDelist} toPull={removals?.toPull} />

      {/* Le comptoir dépend de la boutique choisie plus haut, pas de la
          période : il était jusqu'ici collé aux raccourcis 7 jours / 3 mois,
          qui ne le concernent en rien. */}
      {enLigne ? (
        canSellOnline || canSell ? (
          <Counter online onlineStatusId={statutEnLigne} />
        ) : null
      ) : canSell ? (
        <Counter shopId={shopId} shopName={shopName} />
      ) : null}

      {sales || stock ? (
        <>
          {/* La période ne gouverne que les chiffres de vente : le stock est
              une photo de l'instant, sa requête ne porte aucune borne de date.
              Proposer « 7 jours / 3 mois » au-dessus du seul stock promettrait
              un filtre qui ne filtre rien. */}
          <div className="flex flex-wrap items-end justify-between gap-3 border-t border-slate-200 pt-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {sales ? 'Statistiques' : 'Stock'} — {lieu}
              </h2>
              <p className="mt-0.5 text-sm text-slate-600">
                {sales ? (
                  <>
                    du {formatDate(stats.period.from)} au {formatDate(stats.period.to)}
                  </>
                ) : enLigne ? (
                  "Articles actuellement annoncés sur le site, à l'instant."
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
                label={enLigne ? 'En ligne' : 'Stock actif'}
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

          {/* Chacun range son tableau de bord : l'ordre et les modules affichés
              sont une préférence de compte, enregistrée côté API. */}
          <DashboardModules modules={arranged} save={saveDashboardLayout} />

          <p className="text-xs text-slate-600">
            {sales
              ? 'Vendu, stock actif et retour se déterminent par le comportement des statuts — vente, sort du stock, invendable ensuite — jamais par leur libellé : les chiffres restent justes après un renaming.'
              : 'Le stock actif se détermine par le comportement des statuts — sort du stock ou non — jamais par leur libellé : les chiffres restent justes après un renaming.'}
          </p>
        </>
      ) : (
        <p className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
          {canSellSomewhere
            ? 'Les chiffres de la boutique sont réservés aux droits « Voir les chiffres de vente » et « Voir l’état du stock ».'
            : 'Votre compte n’ouvre aucun tableau de bord. Vos autres écrans restent accessibles depuis le menu.'}
        </p>
      )}
    </div>
  );
}
