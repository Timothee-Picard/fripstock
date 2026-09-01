'use client';

import { useActionState } from 'react';
import { markRemovalDone, markRemovalsDone, type ProductState } from '../products/actions';
import { Alert } from '@/components/field';

const INITIAL_STATE: ProductState = {};

/** Confirme un retrait, sur sa ligne. */
export function RemovalRow({ id }: { id: string }) {
  const [state, action, pending] = useActionState(markRemovalDone, INITIAL_STATE);

  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900 transition hover:bg-amber-100 disabled:opacity-50"
      >
        {pending ? '…' : 'Retrait effectué'}
      </button>
      {state.error ? <Alert>{state.error}</Alert> : null}
    </form>
  );
}

/**
 * Solde d'un coup tout ce que la page affiche.
 *
 * La page en cours, et pas l'ensemble des retraits en attente : on ne confirme
 * que ce qu'on avait sous les yeux.
 */
export function RemovalsBulk({ ids }: { ids: string[] }) {
  const [state, action, pending] = useActionState(markRemovalsDone, INITIAL_STATE);

  if (ids.length < 2) return null;

  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      {ids.map((id) => (
        <input key={id} type="hidden" name="productId" value={id} />
      ))}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-amber-700 disabled:opacity-50"
      >
        {pending ? '…' : `Tout marquer comme retiré — les ${ids.length} de cette page`}
      </button>
      {state.error ? <Alert>{state.error}</Alert> : null}
    </form>
  );
}
