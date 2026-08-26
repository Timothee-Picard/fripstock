import Link from 'next/link';
import { FormulaireCreation } from './formulaires';
import { IconeVoir } from '@/components/icones';
import { AccesRefuse } from '@/components/acces-refuse';
import { appelApiTolerant } from '@/lib/api';
import { exigerSession } from '@/lib/session';
import type { ClientDeposant } from '@/lib/types';

export default async function PageClientsDeposants() {
  await exigerSession();
  const { donnees: clients, refus } =
    await appelApiTolerant<ClientDeposant[]>('/clients-deposants');
  if (refus) return <AccesRefuse quoi="Clients déposants" permission="clients.gerer" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Clients déposants</h1>
        <p className="mt-1 text-sm text-slate-600">
          Les personnes qui vous confient des articles en dépôt-vente. Rattachés à
          l&apos;entreprise, pas à une boutique : un déposant peut avoir des articles dans plusieurs
          d&apos;entre elles.
        </p>
      </div>

      <FormulaireCreation />

      {clients.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">
          Aucun déposant pour l&apos;instant.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-2 font-medium">Déposant</th>
                <th className="px-4 py-2 font-medium">Contact</th>
                <th className="px-4 py-2 font-medium">Commission</th>
                <th className="px-4 py-2 font-medium">Contrats</th>
                <th className="px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clients.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2">
                    <Link
                      href={`/dashboard/clients-deposants/${c.id}`}
                      className="font-medium text-slate-900 underline-offset-2 hover:underline"
                    >
                      {c.prenom ? `${c.prenom} ${c.nom}` : c.nom}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-700">
                    {c.email ?? c.telephone ?? <span className="text-slate-500">—</span>}
                  </td>
                  <td className="px-4 py-2 text-slate-700">
                    {c.commissionDefaut} %
                    <span className="ml-1 text-xs text-slate-600">
                      (déposant : {100 - Number(c.commissionDefaut)} %)
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-700">{c._count?.contrats ?? 0}</td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/dashboard/clients-deposants/${c.id}`}
                      title="Voir la fiche et le relevé"
                      aria-label={`Ouvrir ${c.nom}`}
                      className="inline-flex rounded p-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                    >
                      <IconeVoir />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
