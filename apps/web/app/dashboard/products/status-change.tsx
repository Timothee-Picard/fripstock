'use client';

import { useActionState, useState } from 'react';
import { changeStatus, type ProductState } from './actions';
import { Alert } from '@/components/field';
import type { Status } from '@/lib/types';

const INITIAL_STATE: ProductState = {};

/**
 * Changement rapide depuis la liste ou la fiche.
 *
 * Un statut de vente exige un prix vendu : le champ n'apparaît que si le
 * statut choisi porte `estVente`. C'est le flag qui décide, jamais le libellé —
 * le gérant peut renommer ses statuts.
 */
export function StatusChange({
  productId,
  statutActuel,
  statuses,
  salePrice,
  soldPrice,
  compact = false,
}: {
  productId: string;
  statutActuel: Status;
  statuses: Status[];
  /** Prix affiché sur l'étiquette. */
  salePrice: string | null;
  /** Prix déjà encaissé, si le produit a déjà été vendu. */
  soldPrice: string | null;
  compact?: boolean;
}) {
  const [state, action, pending] = useActionState(changeStatus, INITIAL_STATE);
  // Le choix est mémorisé avec le marqueur de succès en cours au moment où il a
  // été fait. Dès qu'un nouveau succès arrive, les deux divergent et le
  // sélecteur repart vide — sinon le statut choisi resterait affiché après la
  // vente, avec son champ de prix, comme s'il restait quelque chose à valider.
  const [choix, setChoix] = useState({ id: '', after: '' });
  const token = state.token ?? '';
  const cibleId = choix.after === token ? choix.id : '';
  const setTargetId = (id: string) => setChoix({ id, after: token });

  const target = statuses.find((s) => s.id === cibleId);
  const bloque = statutActuel.blocksSale;

  // Le statut embarqué dans un produit vient de la relation Prisma : il ne
  // porte ni `fluxDefini` ni `ciblesAutorisees`, que seul GET /statuses calcule.
  // On reprend donc la version complète depuis la liste.
  const actuelComplet = statuses.find((s) => s.id === statutActuel.id) ?? statutActuel;

  // Deux filtres, dans l'ordre où l'API les applique :
  //   1. le flux de l'entreprise, s'il est défini, limite les cibles ;
  //   2. un produit rendu ou retiré ne redevient jamais vendable.
  // L'API refait les deux contrôles : ceci n'est qu'un confort d'affichage.
  const atteignables = new Set(actuelComplet.allowedTargets ?? []);
  const selectable = statuses.filter(
    (s) => s.id !== statutActuel.id && atteignables.has(s.id) && !(bloque && s.isSale),
  );

  return (
    <form action={action} className={compact ? 'flex flex-wrap items-center gap-2' : 'space-y-2'}>
      <input type="hidden" name="id" value={productId} />
      {selectable.length === 0 ? (
        <span className="text-xs text-slate-600">
          Aucun passage possible depuis « {statutActuel.name} ».
        </span>
      ) : null}
      <select
        name="statusId"
        value={cibleId}
        onChange={(e) => setTargetId(e.target.value)}
        required
        disabled={selectable.length === 0}
        className="rounded-md border border-slate-400 bg-white px-2 py-1 text-sm text-slate-900 disabled:bg-slate-100"
        hidden={selectable.length === 0}
      >
        <option value="">Changer de statut…</option>
        {selectable.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      {target?.isSale ? (
        <label className="flex items-center gap-1.5 text-sm text-slate-700">
          <span className="whitespace-nowrap">Encaissé</span>
          <input
            name="soldPrice"
            type="text"
            inputMode="decimal"
            required
            // Pré-rempli avec le prix déjà encaissé, sinon celui de l'étiquette :
            // dans la plupart des ventes il n'y a rien à corriger, seulement à
            // confirmer. On ne le retape que si le prix a été négocié.
            defaultValue={soldPrice ?? salePrice ?? ''}
            className="w-24 rounded-md border border-slate-400 bg-white px-2 py-1 text-sm text-slate-900"
          />
          <span>€</span>
        </label>
      ) : null}

      {cibleId ? (
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 px-3 py-1 text-sm font-medium text-white transition hover:bg-slate-700 disabled:bg-slate-400"
        >
          {pending ? '…' : 'Appliquer'}
        </button>
      ) : null}

      {state.error ? (
        <div className={compact ? 'w-full' : ''}>
          <Alert>{state.error}</Alert>
        </div>
      ) : null}
    </form>
  );
}
