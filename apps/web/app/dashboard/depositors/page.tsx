import Link from 'next/link';
import { CreateForm } from './forms';
import { ViewIcon } from '@/components/icons';
import { AccessDenied } from '@/components/access-denied';
import { tolerantApiFetch } from '@/lib/api';
import { requireSession } from '@/lib/session';
import type { Depositor } from '@/lib/types';

export default async function DepositorsPage() {
  await requireSession();
  const { data: depositors, denied } = await tolerantApiFetch<Depositor[]>('/depositors');
  if (denied) return <AccessDenied what="Clients déposants" permission="depositors.manage" />;

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

      <CreateForm />

      {depositors.length === 0 ? (
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
              {depositors.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2">
                    <Link
                      href={`/dashboard/depositors/${c.id}`}
                      className="font-medium text-slate-900 underline-offset-2 hover:underline"
                    >
                      {c.firstName ? `${c.firstName} ${c.lastName}` : c.lastName}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-700">
                    {c.email ?? c.phone ?? <span className="text-slate-500">—</span>}
                  </td>
                  <td className="px-4 py-2 text-slate-700">
                    {c.defaultCommission} %
                    <span className="ml-1 text-xs text-slate-600">
                      (déposant : {100 - Number(c.defaultCommission)} %)
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-700">{c._count?.contracts ?? 0}</td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/dashboard/depositors/${c.id}`}
                      title="Voir la fiche et le relevé"
                      aria-label={`Ouvrir ${c.lastName}`}
                      className="inline-flex rounded p-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                    >
                      <ViewIcon />
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
