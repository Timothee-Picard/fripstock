'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { eurosNumber, type Dashboard } from '@/lib/types';
import { formatCalendarDay } from '@/lib/dates';

const AXE = { fontSize: 12, fill: '#475569' };

/**
 * Formateur d'infobulle.
 *
 * recharts type la valeur comme potentiellement absente : on la ramène à un
 * nombre plutôt que de forcer le type, une infobulle vide valant mieux qu'une
 * erreur au survol.
 */
function enEuros(label: string) {
  return (value: unknown): [string, string] => [
    eurosNumber(typeof value === 'number' ? value : Number(value ?? 0)),
    label,
  ];
}
const GRILLE = '#e2e8f0';

/**
 * Clés lues par recharts dans les données du tableau de bord.
 *
 * `dataKey` est une chaîne : rien ne relie le graphique à la forme réelle des
 * données. Un champ renommé côté API laisse alors un graphique vide, sans que
 * ni le typage ni les tests ne bronchent — c'est exactement ce qui est arrivé
 * au passage du code en anglais. Les déclarer ici, contraintes par le type du
 * tableau de bord, fait échouer la compilation au prochain renommage.
 */
/**
 * Les blocs du tableau de bord sont optionnels — l'API n'envoie que ceux
 * auxquels l'utilisateur a droit. Un graphique, lui, n'est monté que si son
 * bloc existe : `NonNullable` évite d'avoir à le redire à chaque accès.
 */
type ByDay = NonNullable<Dashboard['byDay']>;
type TopCategories = NonNullable<Dashboard['topCategories']>;
type Stock = NonNullable<Dashboard['stock']>;
type Rotation = NonNullable<Dashboard['rotation']>;
type TopAttribute = NonNullable<Dashboard['topAttributes']>[number];

const PAR_JOUR = {
  x: 'day',
  y: 'revenue',
} as const satisfies Record<string, keyof ByDay[number]>;

const CATEGORIES = {
  label: 'name',
  value: 'revenue',
} as const satisfies Record<string, keyof TopCategories[number]>;

const PAR_TRANCHE = {
  label: 'label',
  value: 'count',
} as const;

const PAR_VALEUR = {
  label: 'value',
  value: 'count',
} as const satisfies Record<string, keyof TopAttribute['values'][number]>;

const PAR_STATUT = {
  label: 'name',
  value: 'count',
} as const satisfies Record<string, keyof Stock['byStatus'][number]>;

// `day` est un jour calendaire (AAAA-MM-JJ) renvoyé par l'API, pas un instant :
// il se formate donc avec `formatCalendarDay`, qui ne peut pas le faire glisser.
function jourCourt(day: string): string {
  return formatCalendarDay(day, { day: '2-digit', month: '2-digit' });
}

/**
 * Chiffre d'affaires jour par jour.
 *
 * Une ligne et non des barres : sur une période d'un mois, l'œil suit une
 * tendance, il ne compare pas trente valeurs deux à deux.
 */
export function SalesCurve({ data }: { data: ByDay }) {
  if (data.length === 0) {
    return <p className="py-12 text-center text-sm text-slate-600">Aucune vente sur la période.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid stroke={GRILLE} vertical={false} />
        <XAxis dataKey={PAR_JOUR.x} tickFormatter={jourCourt} tick={AXE} tickLine={false} />
        <YAxis tick={AXE} tickLine={false} axisLine={false} />
        <Tooltip
          formatter={enEuros("Chiffre d'affaires")}
          labelFormatter={(l: unknown) => formatCalendarDay(String(l))}
        />
        <Line
          type="monotone"
          dataKey={PAR_JOUR.y}
          stroke="#0f172a"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/**
 * Répartition du stock par statut.
 *
 * Les couleurs viennent de la base : ce sont celles que le gérant a choisies
 * pour ses statuts, donc les teintes qu'il retrouve sur les pastilles des
 * fiches produit. Pleines ici, alors que la pastille n'en garde qu'une version
 * pâle : une part de camembert est une grande surface sans texte dessus, et
 * des tons pâles s'y distingueraient mal les uns des autres.
 */
export function StockPie({ data }: { data: Stock['byStatus'] }) {
  const withStock = data.filter((s) => s.count > 0);
  if (withStock.length === 0) {
    return <p className="py-12 text-center text-sm text-slate-600">Aucun produit en stock.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        {/* Sans animation : le camembert d'un tableau de bord se relit à chaque
            changement de période, et une part qui se déplie à chaque fois
            fatigue plus qu'elle n'informe. */}
        <Pie
          data={withStock}
          dataKey={PAR_STATUT.value}
          nameKey={PAR_STATUT.label}
          innerRadius={50}
          outerRadius={85}
          isAnimationActive={false}
        >
          {withStock.map((s) => (
            <Cell key={s.id} fill={s.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: unknown, name: unknown): [string, string] => [
            `${Number(value ?? 0)} article(s)`,
            String(name),
          ]}
        />
        <Legend
          verticalAlign="bottom"
          iconType="circle"
          formatter={(value: unknown) => (
            <span className="text-xs text-slate-700">{String(value)}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

/** Catégories par chiffre d'affaires — barres horizontales, libellés lisibles. */
export function CategoryBars({ data }: { data: TopCategories }) {
  if (data.length === 0) {
    return <p className="py-12 text-center text-sm text-slate-600">Aucune vente sur la période.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 44)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
        <CartesianGrid stroke={GRILLE} horizontal={false} />
        <XAxis type="number" tick={AXE} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey={CATEGORIES.label} tick={AXE} tickLine={false} width={96} />
        <Tooltip formatter={enEuros("Chiffre d'affaires")} />
        <Bar dataKey={CATEGORIES.value} fill="#0f172a" radius={[0, 4, 4, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Libellé d'une tranche de rotation.
 *
 * Il se fabrique ici et non côté API : celle-ci renvoie des bornes, qui sont
 * la donnée. « 90 j et + » est une phrase, et les phrases sont à l'écran.
 */
function trancheLabel(bucket: Rotation['buckets'][number]): string {
  if (bucket.to === null) return `${bucket.from} j et +`;
  if (bucket.from === 0) return `≤ ${bucket.to} j`;
  return `${bucket.from} à ${bucket.to} j`;
}

/**
 * Temps de rotation : combien d'articles partent en une semaine, en un mois,
 * ou traînent.
 *
 * Des barres verticales et non une courbe : ce sont des tranches, pas une
 * évolution — l'œil compare des hauteurs, il ne suit pas une tendance. La
 * moyenne et la médiane sont posées au-dessus, en toutes lettres : c'est le
 * chiffre qu'on retient, l'histogramme dit seulement s'il est représentatif.
 */
export function RotationBars({ data }: { data: Rotation }) {
  if (data.count === 0) {
    return <p className="py-12 text-center text-sm text-slate-600">Aucune vente sur la période.</p>;
  }

  const tranches = data.buckets.map((b) => ({ ...b, label: trancheLabel(b) }));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <p className="text-sm text-slate-600">
          <strong className="text-xl font-semibold text-slate-900">
            {data.averageDays.toLocaleString('fr-FR')} j
          </strong>{' '}
          en moyenne
        </p>
        <p className="text-sm text-slate-600">
          <strong className="text-base font-semibold text-slate-900">
            {data.medianDays.toLocaleString('fr-FR')} j
          </strong>{' '}
          pour la moitié des ventes
        </p>
        <p className="text-xs text-slate-600">sur {data.count} article(s) vendu(s)</p>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={tranches} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid stroke={GRILLE} vertical={false} />
          <XAxis dataKey={PAR_TRANCHE.label} tick={AXE} tickLine={false} />
          <YAxis tick={AXE} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            formatter={(value: unknown): [string, string] => [
              `${Number(value ?? 0)} article(s)`,
              'Vendus',
            ]}
          />
          <Bar dataKey={PAR_TRANCHE.value} fill="#0f172a" radius={[4, 4, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Meilleures ventes pour un attribut : la couleur, la marque ou la taille qui
 * part le mieux.
 *
 * En **nombre d'articles** et non en euros : la question est ce qui se vend, et
 * un manteau à 120 € mettrait sa couleur devant dix t-shirts. Le chiffre
 * d'affaires suit dans l'infobulle, pour qui veut les deux.
 *
 * Même forme que les catégories — barres horizontales, libellés lisibles sans
 * pencher la tête — parce que c'est la même question posée sur un autre axe.
 */
export function AttributeBars({ data }: { data: TopAttribute }) {
  if (data.values.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-slate-600">
        Aucune vente renseignant cet attribut sur la période.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.values.length * 40)}>
      <BarChart
        data={data.values}
        layout="vertical"
        margin={{ top: 4, right: 16, bottom: 0, left: 8 }}
      >
        <CartesianGrid stroke={GRILLE} horizontal={false} />
        <XAxis type="number" tick={AXE} tickLine={false} axisLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey={PAR_VALEUR.label} tick={AXE} tickLine={false} width={96} />
        <Tooltip
          formatter={(value: unknown, _nom: unknown, item: unknown): [string, string] => {
            // Le chiffre d'affaires n'est pas sur l'axe, mais il vient avec :
            // « douze noirs » et « douze noirs à 40 € » ne se lisent pas pareil.
            const ligne = (item as { payload?: { revenue?: number } } | undefined)?.payload;
            return [
              `${Number(value ?? 0)} article(s) — ${eurosNumber(ligne?.revenue ?? 0)}`,
              'Vendus',
            ];
          }}
        />
        <Bar dataKey={PAR_VALEUR.value} fill="#0f172a" radius={[0, 4, 4, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}
