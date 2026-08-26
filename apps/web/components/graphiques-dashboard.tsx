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
import { eurosNombre, type TableauDeBord } from '@/lib/types';

const AXE = { fontSize: 12, fill: '#475569' };

/**
 * Formateur d'infobulle.
 *
 * recharts type la valeur comme potentiellement absente : on la ramène à un
 * nombre plutôt que de forcer le type, une infobulle vide valant mieux qu'une
 * erreur au survol.
 */
function enEuros(libelle: string) {
  return (valeur: unknown): [string, string] => [
    eurosNombre(typeof valeur === 'number' ? valeur : Number(valeur ?? 0)),
    libelle,
  ];
}
const GRILLE = '#e2e8f0';

function jourCourt(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

/**
 * Chiffre d'affaires jour par jour.
 *
 * Une ligne et non des barres : sur une période d'un mois, l'œil suit une
 * tendance, il ne compare pas trente valeurs deux à deux.
 */
export function CourbeVentes({ donnees }: { donnees: TableauDeBord['parJour'] }) {
  if (donnees.length === 0) {
    return <p className="py-12 text-center text-sm text-slate-600">Aucune vente sur la période.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={donnees} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid stroke={GRILLE} vertical={false} />
        <XAxis dataKey="jour" tickFormatter={jourCourt} tick={AXE} tickLine={false} />
        <YAxis tick={AXE} tickLine={false} axisLine={false} />
        <Tooltip
          formatter={enEuros("Chiffre d'affaires")}
          labelFormatter={(l: unknown) => new Date(String(l)).toLocaleDateString('fr-FR')}
        />
        <Line type="monotone" dataKey="ca" stroke="#0f172a" strokeWidth={2} dot={{ r: 3 }} />
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
export function CamembertStock({ donnees }: { donnees: TableauDeBord['stock']['parStatut'] }) {
  const avecStock = donnees.filter((s) => s.nombre > 0);
  if (avecStock.length === 0) {
    return <p className="py-12 text-center text-sm text-slate-600">Aucun produit en stock.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={avecStock} dataKey="nombre" nameKey="nom" innerRadius={50} outerRadius={85}>
          {avecStock.map((s) => (
            <Cell key={s.id} fill={s.couleur} />
          ))}
        </Pie>
        <Tooltip
          formatter={(valeur: unknown, nom: unknown): [string, string] => [
            `${Number(valeur ?? 0)} article(s)`,
            String(nom),
          ]}
        />
        <Legend
          verticalAlign="bottom"
          iconType="circle"
          formatter={(valeur: unknown) => (
            <span className="text-xs text-slate-700">{String(valeur)}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

/** Catégories par chiffre d'affaires — barres horizontales, libellés lisibles. */
export function BarresCategories({ donnees }: { donnees: TableauDeBord['topCategories'] }) {
  if (donnees.length === 0) {
    return <p className="py-12 text-center text-sm text-slate-600">Aucune vente sur la période.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(160, donnees.length * 44)}>
      <BarChart data={donnees} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
        <CartesianGrid stroke={GRILLE} horizontal={false} />
        <XAxis type="number" tick={AXE} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="nom" tick={AXE} tickLine={false} width={96} />
        <Tooltip formatter={enEuros("Chiffre d'affaires")} />
        <Bar dataKey="ca" fill="#0f172a" radius={[0, 4, 4, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}
