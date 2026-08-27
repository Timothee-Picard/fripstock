'use client';

import { useActionState, useState } from 'react';
import {
  detachProduct,
  updateContract,
  attachProducts,
  deleteContract,
  type ContractState,
} from '../actions';
import { Alert, Button, Field } from '@/components/field';
import { CONTRACT_STATUS_LABELS, type DepositContract, type ProductSummary } from '@/lib/types';

const INITIAL_STATE: ContractState = {};
const FIELD = 'w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-sm text-slate-900';

/**
 * Conditions du contrat, repliées par défaut.
 *
 * Le bouton vit dans l'en-tête à côté de « Supprimer », et le formulaire
 * s'ouvre sur sa propre ligne en dessous : il était auparavant en bas de page,
 * sous le tableau des produits et le bloc de rattachement, donc introuvable.
 *
 * Le composant rend un fragment de deux éléments pour que le formulaire, en
 * pleine largeur, passe à la ligne dans l'en-tête au lieu de se tasser.
 */
export function ContractForm({
  contract,
  children,
}: {
  contract: DepositContract;
  /** Actions à poser à côté du bouton, typiquement la suppression. */
  children?: React.ReactNode;
}) {
  const [state, action, pending] = useActionState(updateContract, INITIAL_STATE);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="flex items-center gap-2">
        <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
          Modifier
        </Button>
        {children}
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          Fermer
        </Button>
        {children}
      </div>
      <form
        action={action}
        className="w-full space-y-3 rounded-lg border border-slate-200 bg-white p-5"
      >
        <input type="hidden" name="id" value={contract.id} />
        <h2 className="text-sm font-medium text-slate-900">Conditions</h2>
        {state.error ? <Alert>{state.error}</Alert> : null}
        {state.success ? <Alert tone="info">{state.success}</Alert> : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field
            label="Début"
            name="startDate"
            type="date"
            defaultValue={contract.startDate.slice(0, 10)}
          />
          <Field
            label="Fin"
            name="endDate"
            type="date"
            defaultValue={contract.endDate.slice(0, 10)}
            hint="Repousser l'échéance réarme l'alerte."
          />
          <Field
            label="Commission (%)"
            name="commission"
            inputMode="decimal"
            defaultValue={contract.commission}
            hint="Ne touche pas aux ventes déjà faites."
          />
          <Field
            label="Alerte (jours avant)"
            name="notifyBeforeDays"
            type="number"
            min={0}
            defaultValue={contract.notifyBeforeDays}
          />
        </div>

        <label className="block max-w-xs">
          <span className="mb-1 block text-sm font-medium text-slate-800">État</span>
          <select name="status" defaultValue={contract.status} className={FIELD}>
            {Object.entries(CONTRACT_STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-slate-600">
            « Expiré » est posé automatiquement à l&apos;échéance ; « Clos » reste votre décision.
          </span>
        </label>

        <Button type="submit" disabled={pending}>
          {pending ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </form>
    </>
  );
}

export function AttachForm({
  contractId,
  candidates,
}: {
  contractId: string;
  /** Produits non vendus, encore rattachables. */
  candidates: ProductSummary[];
}) {
  const [state, action, pending] = useActionState(attachProducts, INITIAL_STATE);

  return (
    <form action={action} className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
      <input type="hidden" name="id" value={contractId} />
      <h2 className="text-sm font-medium text-slate-900">Rattacher des produits</h2>
      <p className="text-sm text-slate-600">
        Les produits cochés passent en dépôt-vente : leur prix d&apos;achat est effacé,
        l&apos;article appartenant au déposant. Un produit déjà vendu n&apos;est plus rattachable.
      </p>

      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.success ? <Alert tone="info">{state.success}</Alert> : null}

      {candidates.length === 0 ? (
        <p className="text-sm text-slate-600">Aucun produit disponible.</p>
      ) : (
        <>
          <div className="grid max-h-64 gap-1.5 overflow-y-auto rounded-md border border-slate-200 p-3 sm:grid-cols-2">
            {candidates.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="productId"
                  value={p.id}
                  className="size-4 rounded border-slate-400 accent-slate-900"
                />
                <span>
                  {p.name}
                  {p.reference ? (
                    <span className="ml-1 font-mono text-xs text-slate-600">{p.reference}</span>
                  ) : null}
                </span>
              </label>
            ))}
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? 'Rattachement…' : 'Rattacher'}
          </Button>
        </>
      )}
    </form>
  );
}

export function DetachButton({
  contractId,
  product,
}: {
  contractId: string;
  product: ProductSummary;
}) {
  const [state, action, pending] = useActionState(detachProduct, INITIAL_STATE);

  return (
    <form action={action} className="inline">
      <input type="hidden" name="id" value={contractId} />
      <input type="hidden" name="productId" value={product.id} />
      <button
        type="submit"
        disabled={pending}
        className="text-xs text-slate-600 underline underline-offset-2 hover:text-slate-900 disabled:text-slate-400"
      >
        {pending ? '…' : 'Détacher'}
      </button>
      {state.error ? <span className="ml-2 text-xs text-red-700">{state.error}</span> : null}
    </form>
  );
}

export function DeleteContractButton({ contract }: { contract: DepositContract }) {
  const [state, action, pending] = useActionState(deleteContract, INITIAL_STATE);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm('Supprimer ce contrat de dépôt ?')) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={contract.id} />
      <Button type="submit" variant="danger" disabled={pending}>
        {pending ? '…' : 'Supprimer'}
      </Button>
      {state.error ? <p className="mt-1 text-xs text-red-700">{state.error}</p> : null}
    </form>
  );
}
