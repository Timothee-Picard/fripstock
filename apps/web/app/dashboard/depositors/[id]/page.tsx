import Link from 'next/link';
import { DeleteDepositorButton, EditDepositor } from '../forms';
import { StatusBadge } from '@/components/status-badge';
import { AccessDenied } from '@/components/access-denied';
import { tolerantApiFetch } from '@/lib/api';
import { requireSession } from '@/lib/session';
import {
  eurosNumber,
  CONTRACT_STATUS_LABELS,
  type Depositor,
  type DepositContract,
  type Statement,
} from '@/lib/types';

function Total({ label, value, fort }: { label: string; value: string; fort?: boolean }) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <span className="block text-xs uppercase tracking-wide text-slate-600">{label}</span>
      <span
        className={`mt-0.5 block ${fort ? 'text-lg font-semibold text-slate-900' : 'text-sm text-slate-800'}`}
      >
        {value}
      </span>
    </div>
  );
}

export default async function DepositorPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;

  const [fiche, bilan, allContracts] = await Promise.all([
    tolerantApiFetch<Depositor & { contracts: DepositContract[] }>(`/depositors/${id}`),
    tolerantApiFetch<Statement>(`/depositors/${id}/statement`),
    tolerantApiFetch<DepositContract[]>('/deposit-contracts'),
  ]);
  if (fiche.denied || !fiche.data || !bilan.data) {
    return <AccessDenied what="Client déposant" permission="depositors.manage" />;
  }

  const depositor = fiche.data;
  const releve = bilan.data;
  // Les contrats exigent `deposits.manage` : sans, on affiche le relevé sans eux
  // plutôt que de refuser toute la page.
  const siens = (allContracts.data ?? []).filter((c) => c.depositorId === id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/dashboard/depositors" className="text-sm text-slate-600 underline">
            ← Clients déposants
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">
            {depositor.firstName
              ? `${depositor.firstName} ${depositor.lastName}`
              : depositor.lastName}
          </h1>
          {depositor.iban ? (
            <p className="mt-1 font-mono text-xs text-slate-600">{depositor.iban}</p>
          ) : null}
        </div>
        <EditDepositor depositor={depositor}>
          <DeleteDepositorButton depositor={depositor} />
        </EditDepositor>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-medium text-slate-900">Relevé</h2>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Total label="Produits vendus" value={String(releve.totals.soldCount)} />
          <Total label="Total encaissé" value={eurosNumber(releve.totals.soldTotal)} />
          <Total label="Part boutique" value={eurosNumber(releve.totals.shopShare)} />
          <Total label="Déjà réglé" value={eurosNumber(releve.totals.alreadyPaid)} />
          <Total label="Restant dû" value={eurosNumber(releve.totals.outstanding)} fort />
        </div>

        {releve.lines.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">
            Aucun produit vendu pour ce déposant pour l&apos;instant.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Produit</th>
                  <th className="px-3 py-2 font-medium">Vendu le</th>
                  <th className="px-3 py-2 font-medium">Encaissé</th>
                  <th className="px-3 py-2 font-medium">Commission</th>
                  <th className="px-3 py-2 font-medium">Part boutique</th>
                  <th className="px-3 py-2 font-medium">Part déposant</th>
                  <th className="px-3 py-2 font-medium">Réglé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {releve.lines.map((l) => (
                  <tr key={l.productId}>
                    <td className="px-3 py-2">
                      <Link
                        href={`/dashboard/products/${l.productId}`}
                        className="text-slate-900 underline-offset-2 hover:underline"
                      >
                        {l.name}
                      </Link>
                      {l.reference ? (
                        <span className="ml-2 font-mono text-xs text-slate-600">{l.reference}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {l.soldAt ? new Date(l.soldAt).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{eurosNumber(l.soldPrice)}</td>
                    <td className="px-3 py-2 text-slate-700">{l.commission} %</td>
                    <td className="px-3 py-2 text-slate-700">{eurosNumber(l.shopShare)}</td>
                    <td className="px-3 py-2 font-medium text-slate-900">
                      {eurosNumber(l.depositorShare)}
                    </td>
                    <td className="px-3 py-2">
                      {l.depositorPaid ? (
                        <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">
                          réglé
                        </span>
                      ) : (
                        <span className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-900">
                          à régler
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-3 text-xs text-slate-600">
          La commission retenue est celle figée au moment de la vente, pas celle du contrat :
          modifier un contrat ne réécrit donc pas un relevé déjà réglé. Le règlement se coche depuis
          la fiche du produit.
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-medium text-slate-900">Contrats</h2>
        {siens.length === 0 ? (
          <p className="text-sm text-slate-600">
            Aucun contrat.{' '}
            <Link href="/dashboard/deposit-contracts" className="underline">
              En créer un
            </Link>
            .
          </p>
        ) : (
          <ul className="space-y-2">
            {siens.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 text-sm">
                <Link
                  href={`/dashboard/deposit-contracts/${c.id}`}
                  className="text-slate-900 underline-offset-2 hover:underline"
                >
                  {new Date(c.startDate).toLocaleDateString('fr-FR')} →{' '}
                  {new Date(c.endDate).toLocaleDateString('fr-FR')}
                </Link>
                <StatusBadge
                  status={{
                    name: CONTRACT_STATUS_LABELS[c.status],
                    color: c.status === 'ACTIVE' ? '#10b981' : '#94a3b8',
                  }}
                />
                <span className="text-slate-600">
                  {c.commission} % · {c._count.products} product(s)
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
