'use client';

import { useActionState } from 'react';
import { assignShop, deleteProduct, type ProductState } from '../actions';
import { Alert, Button } from '@/components/field';
import { DeleteIcon } from '@/components/icons';
import type { Shop } from '@/lib/types';

const INITIAL_STATE: ProductState = {};

export function ShopAssignment({
  productId,
  shopId,
  shops,
}: {
  productId: string;
  shopId: string | null;
  shops: Shop[];
}) {
  const [state, action, pending] = useActionState(assignShop, INITIAL_STATE);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={productId} />
      <select
        name="shopId"
        defaultValue={shopId ?? ''}
        className="rounded-md border border-slate-400 bg-white px-2 py-1 text-sm text-slate-900"
      >
        <option value="">Stock central (non assigné)</option>
        {shops.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? '…' : 'Assigner'}
      </Button>
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.success ? <span className="text-xs text-slate-600">{state.success}</span> : null}
    </form>
  );
}

export function DeleteProductButton({
  productId,
  name,
  discret = false,
}: {
  productId: string;
  name: string;
  /** Rendu en lien plutôt qu'en bouton, pour tenir dans une ligne de tableau. */
  discret?: boolean;
}) {
  const [state, action, pending] = useActionState(deleteProduct, INITIAL_STATE);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Supprimer « ${name} » ? Cette action est définitive.`)) e.preventDefault();
      }}
      className={discret ? 'inline' : undefined}
    >
      <input type="hidden" name="id" value={productId} />
      {discret ? (
        <button
          type="submit"
          disabled={pending}
          title="Supprimer"
          aria-label={`Supprimer ${name}`}
          className="rounded p-1.5 text-slate-600 transition hover:bg-red-50 hover:text-red-700 disabled:text-slate-400"
        >
          {pending ? '…' : <DeleteIcon />}
        </button>
      ) : (
        <Button type="submit" variant="danger" disabled={pending}>
          {pending ? '…' : 'Supprimer'}
        </Button>
      )}
      {state.error ? <p className="mt-1 text-xs text-red-700">{state.error}</p> : null}
    </form>
  );
}
