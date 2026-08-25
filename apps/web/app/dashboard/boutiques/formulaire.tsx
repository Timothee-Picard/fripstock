'use client';

import { useActionState } from 'react';
import { creerBoutique, supprimerBoutique, type EtatBoutique } from './actions';
import { Alerte, Bouton, Champ } from '@/components/champ';

const ETAT_INITIAL: EtatBoutique = {};

export function FormulaireBoutique() {
  const [etat, action, enCours] = useActionState(creerBoutique, ETAT_INITIAL);

  return (
    <form action={action} className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-medium text-slate-900">Nouvelle boutique</h2>
      {etat.erreur ? <Alerte>{etat.erreur}</Alerte> : null}
      {etat.succes ? <Alerte ton="info">{etat.succes}</Alerte> : null}
      <Champ label="Nom" name="nom" required />
      <Champ label="Adresse" name="adresse" aide="Facultative" />
      <Bouton type="submit" disabled={enCours}>
        {enCours ? 'Création…' : 'Créer la boutique'}
      </Bouton>
    </form>
  );
}

export function BoutonSupprimer({ id, nom }: { id: string; nom: string }) {
  const [etat, action, enCours] = useActionState(supprimerBoutique, ETAT_INITIAL);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Supprimer la boutique « ${nom} » ?`)) e.preventDefault();
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="id" value={id} />
      <Bouton type="submit" variante="danger" disabled={enCours}>
        {enCours ? '…' : 'Supprimer'}
      </Bouton>
      {etat.erreur ? <span className="text-xs text-red-700">{etat.erreur}</span> : null}
    </form>
  );
}
