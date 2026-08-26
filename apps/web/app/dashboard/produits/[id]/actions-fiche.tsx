'use client';

import { useActionState } from 'react';
import { assignerBoutique, supprimerProduit, type EtatProduit } from '../actions';
import { Alerte, Bouton } from '@/components/champ';
import { IconeSupprimer } from '@/components/icones';
import type { Boutique } from '@/lib/types';

const ETAT_INITIAL: EtatProduit = {};

export function AssignationBoutique({
  produitId,
  boutiqueId,
  boutiques,
}: {
  produitId: string;
  boutiqueId: string | null;
  boutiques: Boutique[];
}) {
  const [etat, action, enCours] = useActionState(assignerBoutique, ETAT_INITIAL);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={produitId} />
      <select
        name="boutiqueId"
        defaultValue={boutiqueId ?? ''}
        className="rounded-md border border-slate-400 bg-white px-2 py-1 text-sm text-slate-900"
      >
        <option value="">Stock central (non assigné)</option>
        {boutiques.map((b) => (
          <option key={b.id} value={b.id}>
            {b.nom}
          </option>
        ))}
      </select>
      <Bouton type="submit" variante="secondaire" disabled={enCours}>
        {enCours ? '…' : 'Assigner'}
      </Bouton>
      {etat.erreur ? <Alerte>{etat.erreur}</Alerte> : null}
      {etat.succes ? <span className="text-xs text-slate-600">{etat.succes}</span> : null}
    </form>
  );
}

export function BoutonSupprimerProduit({
  produitId,
  nom,
  discret = false,
}: {
  produitId: string;
  nom: string;
  /** Rendu en lien plutôt qu'en bouton, pour tenir dans une ligne de tableau. */
  discret?: boolean;
}) {
  const [etat, action, enCours] = useActionState(supprimerProduit, ETAT_INITIAL);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Supprimer « ${nom} » ? Cette action est définitive.`)) e.preventDefault();
      }}
      className={discret ? 'inline' : undefined}
    >
      <input type="hidden" name="id" value={produitId} />
      {discret ? (
        <button
          type="submit"
          disabled={enCours}
          title="Supprimer"
          aria-label={`Supprimer ${nom}`}
          className="rounded p-1.5 text-slate-600 transition hover:bg-red-50 hover:text-red-700 disabled:text-slate-400"
        >
          {enCours ? '…' : <IconeSupprimer />}
        </button>
      ) : (
        <Bouton type="submit" variante="danger" disabled={enCours}>
          {enCours ? '…' : 'Supprimer'}
        </Bouton>
      )}
      {etat.erreur ? <p className="mt-1 text-xs text-red-700">{etat.erreur}</p> : null}
    </form>
  );
}
