'use client';

import { useActionState, useState } from 'react';
import { deleteAccount, type ProfileState } from './actions';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Alert, Button, Field } from '@/components/field';
import type { AccountSummary } from '@/lib/types';

const INITIAL_STATE: ProfileState = {};

type Counted = Exclude<keyof AccountSummary, 'companyName'>;

const COUNTED: [Counted, string, string][] = [
  ['shops', 'boutique', 'boutiques'],
  ['employees', 'compte employé', 'comptes employés'],
  ['products', 'produit', 'produits'],
  ['depositors', 'déposant', 'déposants'],
  ['contracts', 'contrat de dépôt', 'contrats de dépôt'],
];

/**
 * « 3 boutiques », « 1 déposant ».
 *
 * Ce qui est à zéro ne se dit pas : « 0 déposant » n'apprend rien et allonge la
 * liste qu'on veut justement pouvoir lire d'un coup d'œil avant de trancher.
 */
export function accountLines(summary: AccountSummary): string[] {
  return COUNTED.filter(([key]) => summary[key] > 0).map(
    ([key, one, many]) => `${summary[key]} ${summary[key] > 1 ? many : one}`,
  );
}

/**
 * Suppression du compte, réservée au gérant.
 *
 * Le compte, c'est l'entreprise : la supprimer emporte boutiques, stock,
 * déposants et comptes des employés. D'où la confirmation en deux temps —
 * le bouton ouvre, la modale chiffre ce qui part et redemande le mot de passe.
 */
export function DangerZone({ summary }: { summary: AccountSummary }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(deleteAccount, INITIAL_STATE);

  const lines = accountLines(summary);

  return (
    <section className="space-y-4 rounded-lg border border-red-200 bg-white p-5">
      <div>
        <h2 className="text-sm font-medium text-red-800">Supprimer le compte</h2>
        <p className="mt-1 text-sm text-slate-600">
          Efface définitivement {summary.companyName} et tout ce qu’elle contient. Les comptes de
          vos employés disparaissent avec elle, et rien n’est récupérable ensuite.
        </p>
      </div>

      <Button variant="danger" onClick={() => setOpen(true)}>
        Supprimer le compte…
      </Button>

      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Supprimer ${summary.companyName} ?`}
      >
        {lines.length > 0 ? (
          <>
            <p className="text-sm text-slate-700">
              Cette action est définitive. Seront effacés avec l’entreprise :
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
              {lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-slate-700">
            Cette action est définitive. L’entreprise ne contient encore aucune donnée.
          </p>
        )}

        <form action={action} className="space-y-4">
          {state.error ? <Alert>{state.error}</Alert> : null}

          <Field
            label="Votre mot de passe"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            hint="Redemandé parce que l’action est irréversible."
          />

          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? 'Suppression…' : 'Supprimer définitivement'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Annuler
            </Button>
          </div>
        </form>
      </ConfirmDialog>
    </section>
  );
}
