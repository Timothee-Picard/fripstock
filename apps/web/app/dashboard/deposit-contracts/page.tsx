import Link from 'next/link';
import { DeadlinesButton } from './forms';
import { PdfIcon, ViewIcon } from '@/components/icons';
import { AccessDenied } from '@/components/access-denied';
import { tolerantApiFetch } from '@/lib/api';
import { formatDate } from '@/lib/dates';
import { hasPermission } from '@/lib/permissions';
import { requireSession } from '@/lib/session';
import {
  daysUntil,
  CONTRACT_STATUS_LABELS,
  type Depositor,
  type DepositContract,
} from '@/lib/types';

/**
 * Un contrat actif dont l'échéance approche mérite d'être distingué : c'est
 * exactement le moment où le gérant doit décider de prolonger ou de rendre.
 */
function state(contract: DepositContract): { label: string; css: string } {
  if (contract.status !== 'ACTIVE') {
    return {
      label: CONTRACT_STATUS_LABELS[contract.status],
      css: 'bg-slate-100 text-slate-700',
    };
  }
  const days = daysUntil(contract.endDate);
  if (days < 0) return { label: 'Échu', css: 'bg-red-50 text-red-800' };
  if (days <= contract.notifyBeforeDays) {
    return { label: `Expire dans ${days} j`, css: 'bg-amber-50 text-amber-900' };
  }
  return { label: 'Actif', css: 'bg-emerald-50 text-emerald-800' };
}

export default async function DepositContractsPage() {
  const session = await requireSession();
  // Un contrat se saisit avec ses articles : sans le droit de créer des
  // produits, le bouton ne mènerait qu'à un contrat vide.
  const peutCreer = hasPermission(session, 'products.manage');
  const [list, deposants] = await Promise.all([
    tolerantApiFetch<DepositContract[]>('/deposit-contracts'),
    tolerantApiFetch<Depositor[]>('/depositors'),
  ]);
  if (list.denied || !list.data) {
    return <AccessDenied what="Contrats de dépôt" permission="deposits.manage" />;
  }
  const contracts = list.data;
  // Créer un contrat suppose de choisir un déposant : sans `depositors.manage`, on
  // masque simplement le formulaire.
  const depositors = deposants.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mt-1 text-sm text-slate-600">
            Chaque contrat lie un déposant à une période et à une commission. Les articles qui y
            sont rattachés passent en dépôt-vente.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* La passe d'échéances est réservée au gérant : la proposer à un
              employé ne mène qu'à un refus. */}
          {session.isManager ? <DeadlinesButton /> : null}
          {depositors.length === 0 ? null : peutCreer ? (
            <Link
              href="/dashboard/deposit-contracts/new"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              Nouveau contrat
            </Link>
          ) : (
            /* Un bouton qui disparaît sans un mot ressemble à une panne. */
            <p className="max-w-xs text-xs text-slate-600">
              Ouvrir un contrat enregistre aussi les articles déposés : il faut pour cela le droit
              «&nbsp;Créer et modifier des produits&nbsp;».
            </p>
          )}
        </div>
      </div>

      {contracts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">
          Aucun contrat pour l&apos;instant.{' '}
          {depositors.length === 0 ? (
            <>
              Créez d&apos;abord un{' '}
              <Link href="/dashboard/depositors" className="underline underline-offset-2">
                déposant
              </Link>
              .
            </>
          ) : null}
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
                <th className="px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contracts.map((c) => {
                const e = state(c);
                return (
                  <tr key={c.id}>
                    <td className="px-4 py-2">
                      <Link
                        href={`/dashboard/deposit-contracts/${c.id}`}
                        className="font-medium text-slate-900 underline-offset-2 hover:underline"
                      >
                        {c.depositor.firstName
                          ? `${c.depositor.firstName} ${c.depositor.lastName}`
                          : c.depositor.lastName}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-slate-700">
                      {formatDate(c.startDate)} → {formatDate(c.endDate)}
                    </td>
                    <td className="px-4 py-2 text-slate-700">{c.commission} %</td>
                    <td className="px-4 py-2 text-slate-700">{c._count.products}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded px-2 py-0.5 text-xs ${e.css}`}>{e.label}</span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/dashboard/deposit-contracts/${c.id}`}
                          title="Voir le contrat"
                          aria-label={`Ouvrir le contrat de ${c.depositor.lastName}`}
                          className="inline-flex rounded p-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                        >
                          <ViewIcon />
                        </Link>
                        {/* Un lien nu, et non un bouton : le PDF est servi par une
                            route qui rattache le jeton du cookie httpOnly, et le
                            navigateur le télécharge sans passer par du JavaScript. */}
                        <a
                          href={`/api/deposit-contracts/${c.id}/pdf`}
                          title="Télécharger le contrat en PDF"
                          aria-label={`Télécharger le contrat de ${c.depositor.lastName} en PDF`}
                          className="inline-flex rounded p-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                        >
                          <PdfIcon />
                        </a>
                      </div>
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
