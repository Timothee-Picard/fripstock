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
const PAR_JOUR = {
  x: 'day',
  y: 'revenue',
} as const satisfies Record<string, keyof Dashboard['byDay'][number]>;

const CATEGORIES = {
  label: 'name',
  value: 'revenue',
} as const satisfies Record<string, keyof Dashboard['topCategories'][number]>;

const PAR_STATUT = {
  label: 'name',
  value: 'count',
} as const satisfies Record<string, keyof Dashboard['stock']['byStatus'][number]>;

function jourCourt(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

/**
 * Chiffre d'affaires jour par jour.
 *
 * Une ligne et non des barres : sur une période d'un mois, l'œil suit une
 * tendance, il ne compare pas trente valeurs deux à deux.
 */
export function SalesCurve({ data }: { data: Dashboard['byDay'] }) {
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
          labelFormatter={(l: unknown) => new Date(String(l)).toLocaleDateString('fr-FR')}
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
 * pour ses statuts, donc celles qu'il reconnaît sur les fiches produit.
 */
export function StockPie({ data }: { data: Dashboard['stock']['byStatus'] }) {
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
export function CategoryBars({ data }: { data: Dashboard['topCategories'] }) {
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
