'use client';

import { useActionState } from 'react';
import { runDeadlines, type ContractState } from './actions';
import { Button } from '@/components/field';

const INITIAL_STATE: ContractState = {};

/**
 * Déclenche la passe d'échéances à la main.
 *
 * Le job tourne une fois par jour ; attendre le lendemain pour vérifier qu'une
 * alerte part serait absurde, en développement comme après avoir ajusté une
 * date d'échéance.
 */
export function DeadlinesButton() {
  const [state, action, pending] = useActionState(async () => runDeadlines(), INITIAL_STATE);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? 'Vérification…' : 'Vérifier les échéances'}
      </Button>
      {state.success ? <span className="text-xs text-slate-600">{state.success}</span> : null}
      {state.error ? <span className="text-xs text-red-700">{state.error}</span> : null}
    </form>
  );
}
