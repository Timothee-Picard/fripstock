'use client';

import { useActionState, useState } from 'react';
import { updateSale, type ProductState } from '../actions';
import { Alert, Button, Field } from '@/components/field';
import { euros, type Product } from '@/lib/types';

const INITIAL_STATE: ProductState = {};

/**
 * Correction d'une vente déjà enregistrée.
 *
 * Séparée du changement de statut : on rectifie une saisie, on ne fait pas
 * franchir une étape au produit. Le statut et l'historique ne bougent pas.
 */
export function SaleCorrection({ product }: { product: Product }) {
  const [state, action, pending] = useActionState(updateSale, INITIAL_STATE);
  const [open, setOpen] = useState(false);

  // Un produit rendu ou retiré n'est plus dans un statut de vente : l'API
  // refuse alors la correction, on ne propose donc rien.
  if (!product.status.isSale) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-slate-700 underline underline-offset-2 hover:text-slate-900"
      >
        Corriger la vente
      </button>
    );
  }

  return (
    <form action={action} className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4">
      <input type="hidden" name="id" value={product.id} />
      <h3 className="text-sm font-medium text-slate-900">Corriger la vente</h3>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field
          label="Prix encaissé (€)"
          name="soldPrice"
          inputMode="decimal"
          defaultValue={product.soldPrice ?? ''}
          hint={`Étiquette : ${euros(product.salePrice)}`}
        />
        <Field
          label="Date de vente"
          name="soldAt"
          type="date"
          defaultValue={product.soldAt ? product.soldAt.slice(0, 10) : ''}
        />
        {/* La commission n'existe qu'en dépôt-vente : en achat-revente
            l'article appartient déjà à la boutique. */}
        {product.saleType === 'CONSIGNMENT' ? (
          <Field
            label="Commission (%)"
            name="appliedCommission"
            inputMode="decimal"
            defaultValue={product.appliedCommission ?? ''}
            hint="Part gardée par la boutique"
          />
        ) : null}
      </div>

      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.success ? <Alert tone="info">{state.success}</Alert> : null}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          Fermer
        </Button>
      </div>

      <p className="text-xs text-slate-600">
        La commission enregistrée ici est celle qui sert au relevé du déposant et à l&apos;export —
        elle a été figée au moment de la vente et ne suit plus le contrat.
      </p>
    </form>
  );
}
