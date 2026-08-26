'use client';

import { useActionState, useState } from 'react';
import { modifierVente, type EtatProduit } from '../actions';
import { Alerte, Bouton, Champ } from '@/components/champ';
import { euros, type Produit } from '@/lib/types';

const ETAT_INITIAL: EtatProduit = {};

/**
 * Correction d'une vente déjà enregistrée.
 *
 * Séparée du changement de statut : on rectifie une saisie, on ne fait pas
 * franchir une étape au produit. Le statut et l'historique ne bougent pas.
 */
export function CorrectionVente({ produit }: { produit: Produit }) {
  const [etat, action, enCours] = useActionState(modifierVente, ETAT_INITIAL);
  const [ouvert, setOuvert] = useState(false);

  // Un produit rendu ou retiré n'est plus dans un statut de vente : l'API
  // refuse alors la correction, on ne propose donc rien.
  if (!produit.statut.estVente) return null;

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="text-sm text-slate-700 underline underline-offset-2 hover:text-slate-900"
      >
        Corriger la vente
      </button>
    );
  }

  return (
    <form action={action} className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4">
      <input type="hidden" name="id" value={produit.id} />
      <h3 className="text-sm font-medium text-slate-900">Corriger la vente</h3>

      <div className="grid gap-3 sm:grid-cols-3">
        <Champ
          label="Prix encaissé (€)"
          name="prixVendu"
          inputMode="decimal"
          defaultValue={produit.prixVendu ?? ''}
          aide={`Étiquette : ${euros(produit.prixVente)}`}
        />
        <Champ
          label="Date de vente"
          name="dateVente"
          type="date"
          defaultValue={produit.dateVente ? produit.dateVente.slice(0, 10) : ''}
        />
        {/* La commission n'existe qu'en dépôt-vente : en achat-revente
            l'article appartient déjà à la boutique. */}
        {produit.typeVente === 'DEPOT_VENTE' ? (
          <Champ
            label="Commission (%)"
            name="commissionAppliquee"
            inputMode="decimal"
            defaultValue={produit.commissionAppliquee ?? ''}
            aide="Part gardée par la boutique"
          />
        ) : null}
      </div>

      {etat.erreur ? <Alerte>{etat.erreur}</Alerte> : null}
      {etat.succes ? <Alerte ton="info">{etat.succes}</Alerte> : null}

      <div className="flex items-center gap-2">
        <Bouton type="submit" disabled={enCours}>
          {enCours ? 'Enregistrement…' : 'Enregistrer'}
        </Bouton>
        <Bouton type="button" variante="secondaire" onClick={() => setOuvert(false)}>
          Fermer
        </Bouton>
      </div>

      <p className="text-xs text-slate-600">
        La commission enregistrée ici est celle qui sert au relevé du déposant et à l&apos;export —
        elle a été figée au moment de la vente et ne suit plus le contrat.
      </p>
    </form>
  );
}
