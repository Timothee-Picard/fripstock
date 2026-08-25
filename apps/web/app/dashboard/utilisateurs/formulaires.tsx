'use client';

import { useActionState } from 'react';
import {
  enregistrerAcces,
  inviterEmploye,
  supprimerEmploye,
  type EtatUtilisateur,
} from './actions';
import { Alerte, Bouton, Champ } from '@/components/champ';
import { LIBELLES_PERMISSIONS, PERMISSIONS, type Boutique, type Employe } from '@/lib/types';

const ETAT_INITIAL: EtatUtilisateur = {};

export function FormulaireInvitation() {
  const [etat, action, enCours] = useActionState(inviterEmploye, ETAT_INITIAL);

  return (
    <form action={action} className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-medium text-slate-900">Inviter un employé</h2>
      {etat.erreur ? <Alerte>{etat.erreur}</Alerte> : null}
      {etat.succes ? (
        <Alerte ton="info">
          {etat.succes}
          {etat.motDePasseTemporaire ? (
            <>
              {' '}
              Mot de passe temporaire :{' '}
              <code className="rounded bg-white px-1 py-0.5 font-mono">
                {etat.motDePasseTemporaire}
              </code>{' '}
              — il ne sera plus affiché, transmettez-le maintenant.
            </>
          ) : null}
        </Alerte>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <Champ label="Prénom" name="prenom" required />
        <Champ label="Nom" name="nom" required />
        <Champ label="Email" name="email" type="email" required />
      </div>
      <Bouton type="submit" disabled={enCours}>
        {enCours ? 'Invitation…' : 'Inviter'}
      </Bouton>
    </form>
  );
}

export function FormulaireAcces({
  employe,
  boutiques,
}: {
  employe: Employe;
  boutiques: Boutique[];
}) {
  const [etat, action, enCours] = useActionState(enregistrerAcces, ETAT_INITIAL);

  const actuelles = new Map(
    employe.acces.map((a) => [
      a.boutiqueId,
      new Set(
        Object.entries(a.permissions)
          .filter(([, v]) => v)
          .map(([k]) => k),
      ),
    ]),
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="userId" value={employe.id} />

      {boutiques.length === 0 ? (
        <p className="text-sm text-slate-600">
          Créez d&apos;abord une boutique pour pouvoir attribuer des permissions.
        </p>
      ) : (
        boutiques.map((boutique) => {
          const cochees = actuelles.get(boutique.id) ?? new Set<string>();
          return (
            <fieldset key={boutique.id} className="rounded-md border border-slate-200 p-3">
              <legend className="px-1 text-sm font-medium text-slate-800">{boutique.nom}</legend>
              <input type="hidden" name="boutiqueId" value={boutique.id} />
              <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {PERMISSIONS.map((permission) => (
                  <label
                    key={permission}
                    className="flex items-center gap-2 text-sm text-slate-700"
                  >
                    <input
                      type="checkbox"
                      name={`perm:${boutique.id}:${permission}`}
                      defaultChecked={cochees.has(permission)}
                      className="size-4 rounded border-slate-400 text-slate-900 accent-slate-900"
                    />
                    {LIBELLES_PERMISSIONS[permission]}
                  </label>
                ))}
              </div>
            </fieldset>
          );
        })
      )}

      {etat.erreur ? <Alerte>{etat.erreur}</Alerte> : null}
      {etat.succes ? <Alerte ton="info">{etat.succes}</Alerte> : null}

      {boutiques.length > 0 ? (
        <Bouton type="submit" disabled={enCours}>
          {enCours ? 'Enregistrement…' : 'Enregistrer les permissions'}
        </Bouton>
      ) : null}
    </form>
  );
}

export function BoutonSupprimerEmploye({ employe }: { employe: Employe }) {
  const [etat, action, enCours] = useActionState(supprimerEmploye, ETAT_INITIAL);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Supprimer ${employe.prenom} ${employe.nom} ?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="userId" value={employe.id} />
      <Bouton type="submit" variante="danger" disabled={enCours}>
        {enCours ? '…' : 'Supprimer'}
      </Bouton>
      {etat.erreur ? <p className="mt-1 text-xs text-red-700">{etat.erreur}</p> : null}
    </form>
  );
}
