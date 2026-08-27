'use client';

import { useActionState, useState } from 'react';
import { createLot, type ProductState } from '../actions';
import { LotLines } from './lot-lines';
import { Alert, Button, Field } from '@/components/field';
import type { AttributeDefinition, CategoryTree, Shop } from '@/lib/types';

const INITIAL_STATE: ProductState = {};
const FIELD = 'w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-sm text-slate-900';

/**
 * Achat en lot : un prix payé, plusieurs articles.
 *
 * Le prix du lot est remonté ici plutôt que laissé au tableau, parce qu'il
 * commande la répartition affichée en dessous.
 */
export function LotForm({
  tree,
  shops,
  attributes,
}: {
  tree: CategoryTree[];
  shops: Shop[];
  attributes: AttributeDefinition[];
}) {
  const [state, action, pending] = useActionState(createLot, INITIAL_STATE);
  const [total, setTotal] = useState('');

  const paye = Number(total.replace(',', '.'));

  return (
    <form action={action} className="space-y-6">
      {state.error ? <Alert>{state.error}</Alert> : null}

      <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5 sm:grid-cols-2">
        <Field
          label="Prix payé pour le lot (€)"
          name="totalPurchasePrice"
          inputMode="decimal"
          required
          value={total}
          onChange={(e) => setTotal(e.target.value)}
          hint="Réparti entre les articles au prorata de leur prix de vente."
        />
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-800">Boutique</span>
          <select name="shopId" defaultValue="" className={FIELD}>
            <option value="">Stock central (à trier)</option>
            {shops.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-slate-600">
            S&apos;applique à tout le lot ; chaque article reste réassignable ensuite.
          </span>
        </label>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <LotLines
          tree={tree}
          attributes={attributes}
          totalPurchasePrice={Number.isFinite(paye) && paye > 0 ? paye : 0}
        />
      </section>

      <Button type="submit" disabled={pending}>
        {pending ? 'Création…' : 'Créer les articles du lot'}
      </Button>
    </form>
  );
}
