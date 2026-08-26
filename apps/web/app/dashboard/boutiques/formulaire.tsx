'use client';

import { useActionState, useState } from 'react';
import { creerBoutique, modifierBoutique, supprimerBoutique, type EtatBoutique } from './actions';
import { Alerte, Bouton, Champ } from '@/components/champ';
import { IconeModifier, IconeSupprimer } from '@/components/icones';
import type { Boutique } from '@/lib/types';

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

/**
 * Ligne de boutique, modifiable sur place.
 *
 * L'édition se fait dans la ligne plutôt que sur une page à part : une boutique
 * n'a qu'un nom et une adresse, ouvrir un écran pour deux champs serait
 * disproportionné.
 */
export function LigneBoutique({ boutique }: { boutique: Boutique }) {
  const [edition, setEdition] = useState(false);
  const [etat, action, enCours] = useActionState(modifierBoutique, ETAT_INITIAL);

  if (edition) {
    return (
      <tr>
        <td colSpan={3} className="px-4 py-3">
          <form action={action} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={boutique.id} />
            <div className="min-w-40 flex-1">
              <Champ label="Nom" name="nom" defaultValue={boutique.nom} required />
            </div>
            <div className="min-w-48 flex-1">
              <Champ label="Adresse" name="adresse" defaultValue={boutique.adresse ?? ''} />
            </div>
            <Bouton type="submit" disabled={enCours}>
              {enCours ? '…' : 'Enregistrer'}
            </Bouton>
            <Bouton type="button" variante="secondaire" onClick={() => setEdition(false)}>
              Annuler
            </Bouton>
            {etat.erreur ? (
              <div className="w-full">
                <Alerte>{etat.erreur}</Alerte>
              </div>
            ) : null}
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="px-4 py-2 font-medium text-slate-800">{boutique.nom}</td>
      <td className="px-4 py-2 text-slate-600">{boutique.adresse ?? '—'}</td>
      <td className="px-4 py-2">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => setEdition(true)}
            title="Modifier"
            aria-label={`Modifier ${boutique.nom}`}
            className="rounded p-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <IconeModifier />
          </button>
          <BoutonSupprimer id={boutique.id} nom={boutique.nom} />
        </div>
      </td>
    </tr>
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
      <button
        type="submit"
        disabled={enCours}
        title="Supprimer"
        aria-label={`Supprimer ${nom}`}
        className="rounded p-1.5 text-slate-600 transition hover:bg-red-50 hover:text-red-700 disabled:text-slate-400"
      >
        {enCours ? '…' : <IconeSupprimer />}
      </button>
      {etat.erreur ? <span className="text-xs text-red-700">{etat.erreur}</span> : null}
    </form>
  );
}
