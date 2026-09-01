import Link from 'next/link';
import { DetachButton, DeleteContractButton, ContractForm, AttachForm } from './management';
import { StatusBadge } from '@/components/status-badge';
import { AccessDenied } from '@/components/access-denied';
import { tolerantApiFetch } from '@/lib/api';
import { formatDate } from '@/lib/dates';
import { requireSession } from '@/lib/session';
import {
  euros,
  daysUntil,
  CONTRACT_STATUS_LABELS,
  type DepositContract,
  type ProductPage,
} from '@/lib/types';

export default async function DepositContractPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;

  const [fiche, inventaire] = await Promise.all([
    tolerantApiFetch<Required<DepositContract>>(`/deposit-contracts/${id}`),
    tolerantApiFetch<ProductPage>('/products?perPage=200'),
  ]);
  if (fiche.denied || !fiche.data) {
    return <AccessDenied what="Contrat de dépôt" permission="deposits.manage" />;
  }
  const contract = fiche.data;
  const stock = inventaire.data ?? { products: [], total: 0, page: 1, perPage: 0, pages: 1 };

  // Rattachables : ni vendus, ni déjà sur un contrat — un produit n'appartient
  // qu'à un contrat à la fois, et l'API refuse de le déplacer en silence.
  const candidates = stock.products.filter((p) => !p.depositContractId && !p.status.isSale);

  const days = daysUntil(contract.endDate);
  const depositorName = contract.depositor.firstName
    ? `${contract.depositor.firstName} ${contract.depositor.lastName}`
    : contract.depositor.lastName;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/dashboard/deposit-contracts" className="text-sm text-slate-600 underline">
            ← Contrats de dépôt
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">
            Contrat de{' '}
            <Link
              href={`/dashboard/depositors/${contract.depositor.id}`}
              className="underline-offset-2 hover:underline"
            >
              {depositorName}
            </Link>
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {formatDate(contract.startDate)} → {formatDate(contract.endDate)} ·{' '}
            {contract.commission} % pour la boutique · {CONTRACT_STATUS_LABELS[contract.status]}
          </p>
        </div>
        <ContractForm contract={contract}>
          <DeleteContractButton contract={contract} />
        </ContractForm>
      </div>

      {contract.status === 'ACTIVE' && days >= 0 && days <= contract.notifyBeforeDays ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Ce contrat arrive à échéance dans {days} jour{days > 1 ? 's' : ''}. Prolongez-le, ou
          rendez ses articles au déposant.
        </p>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-medium text-slate-900">
          Produits déposés ({contract.products.length})
        </h2>
        {contract.products.length === 0 ? (
          <p className="text-sm text-slate-600">Aucun produit rattaché.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Produit</th>
                  <th className="px-3 py-2 font-medium">Prix</th>
                  <th className="px-3 py-2 font-medium">Statut</th>
                  <th className="px-3 py-2 font-medium">Boutique</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contract.products.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2">
                      <Link
                        href={`/dashboard/products/${p.id}`}
                        className="text-slate-900 underline-offset-2 hover:underline"
                      >
                        {p.name}
                      </Link>
                      {p.reference ? (
                        <span className="ml-2 font-mono text-xs text-slate-600">{p.reference}</span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                      {p.soldPrice ? (
                        <>
                          {euros(p.soldPrice)}
                          <span className="ml-1 text-xs text-slate-600">encaissé</span>
                        </>
                      ) : (
                        euros(p.salePrice)
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {p.shop?.name ?? <span className="text-slate-500">stock central</span>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {p.status.isSale ? (
                        <span className="text-xs text-slate-500">vendu</span>
                      ) : (
                        <DetachButton contractId={contract.id} product={p} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AttachForm
        contractId={contract.id}
        code={contract.depositor.code ?? 'XXX'}
        candidates={candidates}
      />
    </div>
  );
}
