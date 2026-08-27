import Link from 'next/link';
import { ContractCreateForm } from './form';
import { AccessDenied } from '@/components/access-denied';
import { apiFetch, tolerantApiFetch } from '@/lib/api';
import { hasPermission } from '@/lib/permissions';
import { requireSession } from '@/lib/session';
import type { AttributeDefinition, CategoryTree, Depositor, Shop } from '@/lib/types';

export default async function NewDepositContractPage() {
  const session = await requireSession();
  // La création d'un contrat crée aussi ses articles : sans le droit d'en
  // créer, on n'obtiendrait qu'un contrat vide, ce qui n'a pas de sens.
  if (!hasPermission(session, 'products.manage')) {
    return (
      <AccessDenied
        what="Nouveau contrat de dépôt"
        permission="products.manage"
        why="Ouvrir un contrat enregistre du même coup les articles déposés : cela revient à créer des produits, et demande donc ce droit en plus de « Gérer les contrats de dépôt »."
      />
    );
  }

  const [depositorList, tree, shops, attributes] = await Promise.all([
    tolerantApiFetch<Depositor[]>('/depositors'),
    apiFetch<CategoryTree[]>('/categories/tree'),
    apiFetch<Shop[]>('/shops'),
    apiFetch<AttributeDefinition[]>('/attributes'),
  ]);

  if (depositorList.denied || !depositorList.data) {
    return <AccessDenied what="Nouveau contrat de dépôt" permission="depositors.manage" />;
  }
  const depositors = depositorList.data;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/deposit-contracts"
          className="text-sm text-slate-600 underline underline-offset-2 hover:text-slate-900"
        >
          ← Contrats de dépôt
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">Nouveau contrat de dépôt</h1>
        <p className="mt-1 text-sm text-slate-600">
          Les articles saisis ici sont créés en dépôt-vente et rattachés au contrat, avec le statut
          par défaut de l&apos;entreprise.
        </p>
      </div>

      {depositors.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600">
          Créez d&apos;abord un{' '}
          <Link href="/dashboard/depositors" className="underline underline-offset-2">
            déposant
          </Link>{' '}
          pour pouvoir établir un contrat.
        </p>
      ) : (
        <ContractCreateForm
          depositors={depositors}
          tree={tree}
          shops={shops}
          attributes={attributes}
        />
      )}
    </div>
  );
}
