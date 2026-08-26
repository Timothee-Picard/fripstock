'use client';

import { useActionState, useState } from 'react';
import { createContract, runDeadlines, type ContractState } from './actions';
import { Alert, Button, Field } from '@/components/field';
import type { Depositor } from '@/lib/types';

const INITIAL_STATE: ContractState = {};

const FIELD = 'w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-sm text-slate-900';

function inNDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function CreateForm({ depositors }: { depositors: Depositor[] }) {
  const [state, action, pending] = useActionState(createContract, INITIAL_STATE);
  const [depositorId, setDepositorId] = useState('');
  const [commission, setCommission] = useState('');

  const share = Number(commission.replace(',', '.'));
  const depositorShare = Number.isFinite(share) && commission !== '' ? 100 - share : null;

  if (depositors.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600">
        Créez d&apos;abord un déposant pour pouvoir établir un contrat.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-medium text-slate-900">Nouveau contrat</h2>
      {state.error ? <Alert>{state.error}</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-800">Déposant</span>
          <select
            name="depositorId"
            value={depositorId}
            onChange={(e) => {
              setDepositorId(e.target.value);
              // La valeur du déposant n'est qu'un point de départ : on la
              // recopie ici, puis c'est le contrat qui fait foi.
              setCommission(
                depositors.find((c) => c.id === e.target.value)?.defaultCommission ?? '',
              );
            }}
            required
            className={FIELD}
          >
            <option value="">— Choisir —</option>
            {depositors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName ? `${c.firstName} ${c.lastName}` : c.lastName}
              </option>
            ))}
          </select>
        </label>
        {/* Le déposant ne porte qu'une valeur par défaut, qui évite de la
            retaper à chaque contrat : c'est bien ce contrat qui fait foi, et
            c'est sa commission que le relevé fige à la vente (CLAUDE.md). */}
        <Field
          label="Commission de ce contrat (%)"
          name="commission"
          inputMode="decimal"
          value={commission}
          onChange={(e) => setCommission(e.target.value)}
          hint={
            depositorShare === null
              ? 'Part gardée par la boutique.'
              : `Part gardée par la boutique — le déposant touchera ${depositorShare} %.`
          }
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Début" name="startDate" type="date" defaultValue={inNDays(0)} required />
        <Field label="Fin" name="endDate" type="date" defaultValue={inNDays(30)} required />
        <Field
          label="Alerte (jours avant)"
          name="notifyBeforeDays"
          type="number"
          min={0}
          defaultValue={7}
          hint="Délai avant l'échéance pour être prévenu."
        />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Création…' : 'Créer le contrat'}
      </Button>
    </form>
  );
}

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
