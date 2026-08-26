'use client';

import { useActionState, useState } from 'react';
import { createDepositor, updateDepositor, deleteDepositor, type DepositorState } from './actions';
import { Alert, Button, Field } from '@/components/field';
import type { Depositor } from '@/lib/types';

const INITIAL_STATE: DepositorState = {};

/**
 * Formulaire d'un déposant, partagé entre création et modification.
 *
 * La commission est celle que **garde la boutique** : le libellé le dit, parce
 * que l'inverse se lit tout aussi bien et fausserait tous les relevés.
 */
function Fields({ depositor }: { depositor?: Depositor }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nom" name="lastName" defaultValue={depositor?.lastName ?? ''} required />
        <Field label="Prénom" name="firstName" defaultValue={depositor?.firstName ?? ''} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Email" name="email" type="email" defaultValue={depositor?.email ?? ''} />
        <Field label="Téléphone" name="phone" defaultValue={depositor?.phone ?? ''} />
      </div>
      <Field label="Adresse" name="address" defaultValue={depositor?.address ?? ''} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="IBAN"
          name="iban"
          defaultValue={depositor?.iban ?? ''}
          hint="Pour le règlement. Les espaces sont retirés automatiquement."
        />
        <Field
          label="Commission par défaut (%)"
          name="defaultCommission"
          inputMode="decimal"
          defaultValue={depositor?.defaultCommission ?? ''}
          hint="Part gardée par la boutique — 40 % ici laisse 60 % au déposant. Simple valeur de départ : chaque contrat porte la sienne."
        />
      </div>
    </>
  );
}

export function CreateForm() {
  const [state, action, pending] = useActionState(createDepositor, INITIAL_STATE);

  return (
    <form action={action} className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-medium text-slate-900">Nouveau déposant</h2>
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.success ? <Alert tone="info">{state.success}</Alert> : null}
      <Fields />
      <Button type="submit" disabled={pending}>
        {pending ? 'Création…' : 'Créer le déposant'}
      </Button>
    </form>
  );
}

/**
 * Coordonnées du déposant, repliées par défaut.
 *
 * Le bouton vit dans l'en-tête, à côté de « Supprimer », et le formulaire
 * s'ouvre sur sa propre ligne en dessous : il était auparavant en bas de page,
 * sous le relevé et les contrats, donc introuvable.
 *
 * Le composant rend un fragment de deux éléments — la barre de boutons et le
 * formulaire — pour que le second, en pleine largeur, passe à la ligne dans
 * l'en-tête plutôt que de se tasser à côté du premier.
 */
export function EditDepositor({
  depositor,
  children,
}: {
  depositor: Depositor;
  /** Actions à poser à côté du bouton, typiquement la suppression. */
  children?: React.ReactNode;
}) {
  const [state, action, pending] = useActionState(updateDepositor, INITIAL_STATE);
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2">
        <Button type="button" variant="secondary" onClick={() => setOpen(!open)}>
          {open ? 'Fermer' : 'Modifier'}
        </Button>
        {children}
      </div>

      {open ? (
        <form
          action={action}
          className="w-full space-y-3 rounded-lg border border-slate-200 bg-white p-5"
        >
          <input type="hidden" name="id" value={depositor.id} />
          <h2 className="text-sm font-medium text-slate-900">Coordonnées du déposant</h2>
          {state.error ? <Alert>{state.error}</Alert> : null}
          {state.success ? <Alert tone="info">{state.success}</Alert> : null}
          <Fields depositor={depositor} />
          <Button type="submit" disabled={pending}>
            {pending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </form>
      ) : null}
    </>
  );
}

export function DeleteDepositorButton({ depositor }: { depositor: Depositor }) {
  const [state, action, pending] = useActionState(deleteDepositor, INITIAL_STATE);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Supprimer le déposant « ${depositor.lastName} » ?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={depositor.id} />
      <Button type="submit" variant="danger" disabled={pending}>
        {pending ? '…' : 'Supprimer'}
      </Button>
      {state.error ? <p className="mt-1 text-xs text-red-700">{state.error}</p> : null}
    </form>
  );
}
