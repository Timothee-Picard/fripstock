import Link from 'next/link';
import { BoutonEcheances, FormulaireCreation } from './formulaires';
import { appelApi } from '@/lib/api';
import { exigerSession } from '@/lib/session';
import {
  joursAvant,
  LIBELLES_STATUT_CONTRAT,
  type ClientDeposant,
  type ContratDepot,
} from '@/lib/types';

/**
 * Un contrat actif dont l'échéance approche mérite d'être distingué : c'est
 * exactement le moment où le gérant doit décider de prolonger ou de rendre.
 */
function etat(contrat: ContratDepot): { libelle: string; classe: string } {
  if (contrat.statut !== 'ACTIF') {
    return {
      libelle: LIBELLES_STATUT_CONTRAT[contrat.statut],
      classe: 'bg-slate-100 text-slate-700',
    };
  }
  const jours = joursAvant(contrat.dateFin);
  if (jours < 0) return { libelle: 'Échu', classe: 'bg-red-50 text-red-800' };
  if (jours <= contrat.notifyBeforeDays) {
    return { libelle: `Expire dans ${jours} j`, classe: 'bg-amber-50 text-amber-900' };
  }
  return { libelle: 'Actif', classe: 'bg-emerald-50 text-emerald-800' };
}

export default async function PageContratsDepot() {
  await exigerSession();
  const [contrats, clients] = await Promise.all([
    appelApi<ContratDepot[]>('/contrats-depot'),
    appelApi<ClientDeposant[]>('/clients-deposants'),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Contrats de dépôt</h1>
          <p className="mt-1 text-sm text-slate-600">
            Chaque contrat lie un déposant à une période et à une commission. Les articles qui y
            sont rattachés passent en dépôt-vente.
          </p>
        </div>
        <BoutonEcheances />
      </div>

      <FormulaireCreation clients={clients} />

      {contrats.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">
          Aucun contrat pour l&apos;instant.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-2 font-medium">Déposant</th>
                <th className="px-4 py-2 font-medium">Période</th>
                <th className="px-4 py-2 font-medium">Commission</th>
                <th className="px-4 py-2 font-medium">Produits</th>
                <th className="px-4 py-2 font-medium">État</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contrats.map((c) => {
                const e = etat(c);
                return (
                  <tr key={c.id}>
                    <td className="px-4 py-2">
                      <Link
                        href={`/dashboard/contrats-depot/${c.id}`}
                        className="font-medium text-slate-900 underline-offset-2 hover:underline"
                      >
                        {c.client.prenom ? `${c.client.prenom} ${c.client.nom}` : c.client.nom}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-slate-700">
                      {new Date(c.dateDebut).toLocaleDateString('fr-FR')} →{' '}
                      {new Date(c.dateFin).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-2 text-slate-700">{c.commission} %</td>
                    <td className="px-4 py-2 text-slate-700">{c._count.produits}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded px-2 py-0.5 text-xs ${e.classe}`}>{e.libelle}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
