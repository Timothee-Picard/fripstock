'use client';

import { useActionState, useState } from 'react';
import { markRemovalDone, setOnline, type ProductState } from '../actions';
import { Alert, Button } from '@/components/field';
import { euros, type Product } from '@/lib/types';

const INITIAL_STATE: ProductState = {};

/**
 * Mise en vente sur le site.
 *
 * L'annonce est un drapeau sur le produit, pas un statut : un vêtement sur un
 * portant peut être proposé en ligne en même temps, alors qu'un produit ne
 * porte qu'un statut à la fois. Voir CLAUDE.md.
 *
 * Le prix laissé vide n'est pas une erreur : le site reprend alors le prix
 * boutique, plutôt que d'obliger à saisir deux fois le même montant.
 */
export function OnlineSale({ product, editable }: { product: Product; editable: boolean }) {
  const [state, action, pending] = useActionState(setOnline, INITIAL_STATE);
  const [prix, setPrix] = useState(product.onlinePrice ?? '');

  const parti = product.status.leavesStock;
  const affiche = product.onlinePrice ?? product.salePrice;

  // Sans le droit, la fiche dit quand même ce qu'il en est : masquer
  // l'information ferait croire que l'article n'est pas en ligne.
  if (!editable) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-medium text-slate-900">Vente en ligne</h3>
        <p className="mt-1 text-sm text-slate-700">
          {product.isOnline
            ? `En ligne à ${euros(affiche)}${product.onlinePrice ? '' : ' (prix boutique)'}.`
            : "Cet article n'est pas proposé sur le site."}
        </p>
        <p className="mt-1 text-xs text-slate-600">
          Le droit « Gérer la vente en ligne » est nécessaire pour le modifier.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <input type="hidden" name="id" value={product.id} />
      <input type="hidden" name="isOnline" value={product.isOnline ? 'false' : 'true'} />

      <h3 className="text-sm font-medium text-slate-900">Vente en ligne</h3>
      <p className="mt-1 text-sm text-slate-700">
        {product.isOnline
          ? `Proposé sur le site à ${euros(affiche)}${product.onlinePrice ? '' : ' (prix boutique)'}.`
          : "Cet article n'est pas proposé sur le site."}
      </p>

      {parti && !product.isOnline ? (
        <p className="mt-2 text-xs text-slate-600">
          « {product.status.name} » : l&apos;article ne fait plus partie du stock et ne peut plus
          être mis en ligne.
        </p>
      ) : (
        <label className="mt-3 flex max-w-xs flex-col gap-1">
          <span className="text-xs font-medium text-slate-700">
            Prix en ligne <span className="font-normal text-slate-600">(vide : prix boutique)</span>
          </span>
          <input
            name="onlinePrice"
            value={prix}
            onChange={(e) => setPrix(e.target.value)}
            inputMode="decimal"
            placeholder={product.salePrice ?? ''}
            className="rounded-md border border-slate-400 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
          />
        </label>
      )}

      {state.error ? (
        <div className="mt-2">
          <Alert>{state.error}</Alert>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          variant={product.isOnline ? 'secondary' : 'primary'}
          disabled={pending || (parti && !product.isOnline)}
        >
          {pending ? '…' : product.isOnline ? 'Retirer du site' : 'Mettre en ligne'}
        </Button>
        <span
          className={`rounded px-2 py-0.5 text-xs ${
            product.isOnline ? 'bg-sky-50 text-sky-900' : 'bg-slate-100 text-slate-700'
          }`}
        >
          {product.isOnline ? 'en ligne' : 'hors ligne'}
        </span>
      </div>
    </form>
  );
}

/**
 * Bandeau « retrait à faire », après une vente.
 *
 * L'article est parti d'un côté et reste présent de l'autre. Le sens se lit sur
 * le statut de vente (`isOnlineSale`) et n'est donc pas stocké deux fois : une
 * vente en ligne laisse un vêtement sur le portant, une vente au comptoir
 * laisse une annonce sur le site.
 */
export function PendingRemoval({ product }: { product: Product }) {
  const [state, action, pending] = useActionState(markRemovalDone, INITIAL_STATE);

  if (!product.pendingRemoval) return null;

  const vendueEnLigne = product.status.isOnlineSale;

  return (
    <form action={action} className="rounded-lg border border-amber-300 bg-amber-50 p-4">
      <input type="hidden" name="id" value={product.id} />

      <h3 className="text-sm font-medium text-amber-900">Retrait à faire</h3>
      <p className="mt-1 text-sm text-amber-900">
        {vendueEnLigne
          ? 'Vendu sur le site : le vêtement est encore en boutique, il faut aller le décrocher.'
          : "Vendu en boutique : l'annonce est encore en ligne, il faut la dépublier."}
      </p>

      {state.error ? (
        <div className="mt-2">
          <Alert>{state.error}</Alert>
        </div>
      ) : null}

      <div className="mt-3">
        <Button type="submit" disabled={pending}>
          {pending ? '…' : 'Retrait effectué'}
        </Button>
      </div>
    </form>
  );
}
