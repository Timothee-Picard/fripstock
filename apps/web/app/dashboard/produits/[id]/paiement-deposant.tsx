'use client';

import { useActionState } from 'react';
import { basculerPaiementDeposant, type EtatProduit } from '../actions';
import { Alerte, Bouton } from '@/components/champ';
import { euros, type Produit } from '@/lib/types';

const ETAT_INITIAL: EtatProduit = {};

/**
 * Règlement de la part du déposant.
 *
 * Paiement en espèces : l'application ne gère aucun encaissement, seulement un
 * drapeau coché à la main (voir CLAUDE.md). Le montant affiché est calculé avec
 * la commission figée à la vente, celle qui sert au relevé.
 */
export function PaiementDeposant({ produit }: { produit: Produit }) {
  const [etat, action, enCours] = useActionState(basculerPaiementDeposant, ETAT_INITIAL);

  if (produit.typeVente !== 'DEPOT_VENTE' || !produit.statut.estVente) return null;

  const encaisse = Number(produit.prixVendu ?? 0);
  const commission = Number(produit.commissionAppliquee ?? 0);
  const partDeposant = Math.round(encaisse * (1 - commission / 100) * 100) / 100;
  const paye = produit.deposantPaye === true;

  return (
    <form action={action} className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <input type="hidden" name="id" value={produit.id} />
      <input type="hidden" name="paye" value={paye ? 'false' : 'true'} />

      <h3 className="text-sm font-medium text-slate-900">Part du déposant</h3>
      <p className="mt-1 text-sm text-slate-700">
        {euros(String(partDeposant))} sur {euros(produit.prixVendu)} encaissés — la boutique garde{' '}
        {commission} %.
      </p>

      {etat.erreur ? (
        <div className="mt-2">
          <Alerte>{etat.erreur}</Alerte>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Bouton type="submit" variante={paye ? 'secondaire' : 'principal'} disabled={enCours}>
          {enCours ? '…' : paye ? 'Annuler le règlement' : 'Marquer comme réglé'}
        </Bouton>
        <span
          className={`rounded px-2 py-0.5 text-xs ${
            paye ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'
          }`}
        >
          {paye ? 'réglé' : 'à régler'}
        </span>
      </div>
    </form>
  );
}
