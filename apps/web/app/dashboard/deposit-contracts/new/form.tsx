'use client';

import { useActionState, useState } from 'react';
import { createContract, type ContractState } from '../actions';
import { ContractLines } from '../contract-lines';
import { Alert, Button, Field } from '@/components/field';
import type { AttributeDefinition, CategoryTree, Depositor, Shop } from '@/lib/types';

const INITIAL_STATE: ContractState = {};
const FIELD = 'w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-sm text-slate-900';

function inNDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Contrat et articles déposés, en une seule passe.
 *
 * Le déposant arrive avec un sac : on pose les conditions du contrat en haut,
 * puis on égrène les articles dans le tableau. Tout part ensemble, et l'API
 * écrit le tout dans une transaction — une ligne refusée n'enregistre rien.
 */
export function ContractCreateForm({
  depositors,
  tree,
  shops,
  attributes,
}: {
  depositors: Depositor[];
  tree: CategoryTree[];
  shops: Shop[];
  attributes: AttributeDefinition[];
}) {
  const [state, action, pending] = useActionState(createContract, INITIAL_STATE);
  const [depositorId, setDepositorId] = useState('');
  const [commission, setCommission] = useState('');

  const share = Number(commission.replace(',', '.'));
  const depositorShare = Number.isFinite(share) && commission !== '' ? 100 - share : null;

  return (
    <form action={action} className="space-y-6">
      {state.error ? <Alert>{state.error}</Alert> : null}

      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-medium text-slate-900">Conditions du contrat</h2>
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
        <label className="block max-w-xs">
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
            S&apos;applique à tous les articles saisis ci-dessous ; chacun reste réassignable
            ensuite.
          </span>
        </label>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <ContractLines tree={tree} attributes={attributes} />
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Création…' : 'Créer le contrat et ses articles'}
        </Button>
        <span className="text-xs text-slate-600">
          Le contrat peut aussi être créé vide, quitte à lui rattacher des produits existants
          ensuite.
        </span>
      </div>
    </form>
  );
}
