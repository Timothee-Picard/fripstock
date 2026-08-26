'use client';

import { useActionState } from 'react';
import { toggleDepositorPayment, type ProductState } from '../actions';
import { Alert, Button } from '@/components/field';
import { euros, type Product } from '@/lib/types';

const INITIAL_STATE: ProductState = {};

/**
 * Règlement de la part du déposant.
 *
 * Paiement en espèces : l'application ne gère aucun encaissement, seulement un
 * drapeau coché à la main (voir CLAUDE.md). Le montant affiché est calculé avec
 * la commission figée à la vente, celle qui sert au relevé.
 */
export function DepositorPayment({ product }: { product: Product }) {
  const [state, action, pending] = useActionState(toggleDepositorPayment, INITIAL_STATE);

  if (product.saleType !== 'CONSIGNMENT' || !product.status.isSale) return null;

  const encaisse = Number(product.soldPrice ?? 0);
  const commission = Number(product.appliedCommission ?? 0);
  const depositorShare = Math.round(encaisse * (1 - commission / 100) * 100) / 100;
  const paid = product.depositorPaid === true;

  return (
    <form action={action} className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <input type="hidden" name="id" value={product.id} />
      <input type="hidden" name="paid" value={paid ? 'false' : 'true'} />

      <h3 className="text-sm font-medium text-slate-900">Part du déposant</h3>
      <p className="mt-1 text-sm text-slate-700">
        {euros(String(depositorShare))} sur {euros(product.soldPrice)} encaissés — la boutique garde{' '}
        {commission} %.
      </p>

      {state.error ? (
        <div className="mt-2">
          <Alert>{state.error}</Alert>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button type="submit" variant={paid ? 'secondary' : 'primary'} disabled={pending}>
          {pending ? '…' : paid ? 'Annuler le règlement' : 'Marquer comme réglé'}
        </Button>
        <span
          className={`rounded px-2 py-0.5 text-xs ${
            paid ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'
          }`}
        >
          {paid ? 'réglé' : 'à régler'}
        </span>
      </div>
    </form>
  );
}
