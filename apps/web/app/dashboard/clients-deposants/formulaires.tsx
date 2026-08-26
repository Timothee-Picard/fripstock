'use client';

import { useActionState } from 'react';
import { creerClient, modifierClient, supprimerClient, type EtatClient } from './actions';
import { Alerte, Bouton, Champ } from '@/components/champ';
import type { ClientDeposant } from '@/lib/types';

const ETAT_INITIAL: EtatClient = {};

/**
 * Formulaire d'un déposant, partagé entre création et modification.
 *
 * La commission est celle que **garde la boutique** : le libellé le dit, parce
 * que l'inverse se lit tout aussi bien et fausserait tous les relevés.
 */
function Champs({ client }: { client?: ClientDeposant }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Champ label="Nom" name="nom" defaultValue={client?.nom ?? ''} required />
        <Champ label="Prénom" name="prenom" defaultValue={client?.prenom ?? ''} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Champ label="Email" name="email" type="email" defaultValue={client?.email ?? ''} />
        <Champ label="Téléphone" name="telephone" defaultValue={client?.telephone ?? ''} />
      </div>
      <Champ label="Adresse" name="adresse" defaultValue={client?.adresse ?? ''} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Champ
          label="IBAN"
          name="iban"
          defaultValue={client?.iban ?? ''}
          aide="Pour le règlement. Les espaces sont retirés automatiquement."
        />
        <Champ
          label="Commission par défaut (%)"
          name="commissionDefaut"
          inputMode="decimal"
          defaultValue={client?.commissionDefaut ?? ''}
          aide="Part gardée par la boutique. 40 % ici = 60 % pour le déposant."
        />
      </div>
    </>
  );
}

export function FormulaireCreation() {
  const [etat, action, enCours] = useActionState(creerClient, ETAT_INITIAL);

  return (
    <form action={action} className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-medium text-slate-900">Nouveau déposant</h2>
      {etat.erreur ? <Alerte>{etat.erreur}</Alerte> : null}
      {etat.succes ? <Alerte ton="info">{etat.succes}</Alerte> : null}
      <Champs />
      <Bouton type="submit" disabled={enCours}>
        {enCours ? 'Création…' : 'Créer le déposant'}
      </Bouton>
    </form>
  );
}

export function FormulaireModification({ client }: { client: ClientDeposant }) {
  const [etat, action, enCours] = useActionState(modifierClient, ETAT_INITIAL);

  return (
    <form action={action} className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
      <input type="hidden" name="id" value={client.id} />
      <h2 className="text-sm font-medium text-slate-900">Coordonnées</h2>
      {etat.erreur ? <Alerte>{etat.erreur}</Alerte> : null}
      {etat.succes ? <Alerte ton="info">{etat.succes}</Alerte> : null}
      <Champs client={client} />
      <Bouton type="submit" disabled={enCours}>
        {enCours ? 'Enregistrement…' : 'Enregistrer'}
      </Bouton>
    </form>
  );
}

export function BoutonSupprimerClient({ client }: { client: ClientDeposant }) {
  const [etat, action, enCours] = useActionState(supprimerClient, ETAT_INITIAL);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Supprimer le déposant « ${client.nom} » ?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={client.id} />
      <Bouton type="submit" variante="danger" disabled={enCours}>
        {enCours ? '…' : 'Supprimer'}
      </Bouton>
      {etat.erreur ? <p className="mt-1 text-xs text-red-700">{etat.erreur}</p> : null}
    </form>
  );
}
