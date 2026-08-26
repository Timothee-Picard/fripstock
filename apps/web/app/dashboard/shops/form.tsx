'use client';

import { useActionState, useState } from 'react';
import { createShop, updateShop, deleteShop, type ShopState } from './actions';
import { Alert, Button, Field } from '@/components/field';
import { EditIcon, DeleteIcon } from '@/components/icons';
import type { Shop } from '@/lib/types';

const INITIAL_STATE: ShopState = {};

export function ShopForm() {
  const [state, action, pending] = useActionState(createShop, INITIAL_STATE);

  return (
    <form action={action} className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-medium text-slate-900">Nouvelle boutique</h2>
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.success ? <Alert tone="info">{state.success}</Alert> : null}
      <Field label="Nom" name="name" required />
      <Field label="Adresse" name="adresse" hint="Facultative" />
      <Button type="submit" disabled={pending}>
        {pending ? 'Création…' : 'Créer la boutique'}
      </Button>
    </form>
  );
}

/**
 * Ligne de boutique, modifiable sur place.
 *
 * L'édition se fait dans la ligne plutôt que sur une page à part : une boutique
 * n'a qu'un nom et une adresse, ouvrir un écran pour deux champs serait
 * disproportionné.
 */
export function ShopRow({ shop }: { shop: Shop }) {
  const [editing, setEdition] = useState(false);
  const [state, action, pending] = useActionState(updateShop, INITIAL_STATE);

  if (editing) {
    return (
      <tr>
        <td colSpan={3} className="px-4 py-3">
          <form action={action} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={shop.id} />
            <div className="min-w-40 flex-1">
              <Field label="Nom" name="name" defaultValue={shop.name} required />
            </div>
            <div className="min-w-48 flex-1">
              <Field label="Adresse" name="adresse" defaultValue={shop.address ?? ''} />
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? '…' : 'Enregistrer'}
            </Button>
            <Button type="button" variante="secondaire" onClick={() => setEdition(false)}>
              Annuler
            </Button>
            {state.error ? (
              <div className="w-full">
                <Alert>{state.error}</Alert>
              </div>
            ) : null}
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="px-4 py-2 font-medium text-slate-800">{shop.name}</td>
      <td className="px-4 py-2 text-slate-600">{shop.address ?? '—'}</td>
      <td className="px-4 py-2">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => setEdition(true)}
            title="Modifier"
            aria-label={`Modifier ${shop.name}`}
            className="rounded p-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <EditIcon />
          </button>
          <DeleteButton id={shop.id} name={shop.name} />
        </div>
      </td>
    </tr>
  );
}

export function DeleteButton({ id, name }: { id: string; name: string }) {
  const [state, action, pending] = useActionState(deleteShop, INITIAL_STATE);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Supprimer la boutique « ${name} » ?`)) e.preventDefault();
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        title="Supprimer"
        aria-label={`Supprimer ${name}`}
        className="rounded p-1.5 text-slate-600 transition hover:bg-red-50 hover:text-red-700 disabled:text-slate-400"
      >
        {pending ? '…' : <DeleteIcon />}
      </button>
      {state.error ? <span className="text-xs text-red-700">{state.error}</span> : null}
    </form>
  );
}
