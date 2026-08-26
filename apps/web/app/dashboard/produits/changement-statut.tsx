'use client';

import { useActionState, useState } from 'react';
import { changerStatut, type EtatProduit } from './actions';
import { Alerte } from '@/components/champ';
import type { Statut } from '@/lib/types';

const ETAT_INITIAL: EtatProduit = {};

/**
 * Changement rapide depuis la liste ou la fiche.
 *
 * Un statut de vente exige un prix vendu : le champ n'apparaît que si le
 * statut choisi porte `estVente`. C'est le flag qui décide, jamais le libellé —
 * le gérant peut renommer ses statuts.
 */
export function ChangementStatut({
  produitId,
  statutActuel,
  statuts,
  prixVente,
  prixVendu,
  compact = false,
}: {
  produitId: string;
  statutActuel: Statut;
  statuts: Statut[];
  /** Prix affiché sur l'étiquette. */
  prixVente: string | null;
  /** Prix déjà encaissé, si le produit a déjà été vendu. */
  prixVendu: string | null;
  compact?: boolean;
}) {
  const [etat, action, enCours] = useActionState(changerStatut, ETAT_INITIAL);
  const [cibleId, setCibleId] = useState('');

  const cible = statuts.find((s) => s.id === cibleId);
  const bloque = statutActuel.bloqueVente;

  // Le statut embarqué dans un produit vient de la relation Prisma : il ne
  // porte ni `fluxDefini` ni `ciblesAutorisees`, que seul GET /statuts calcule.
  // On reprend donc la version complète depuis la liste.
  const actuelComplet = statuts.find((s) => s.id === statutActuel.id) ?? statutActuel;

  // Deux filtres, dans l'ordre où l'API les applique :
  //   1. le flux de l'entreprise, s'il est défini, limite les cibles ;
  //   2. un produit rendu ou retiré ne redevient jamais vendable.
  // L'API refait les deux contrôles : ceci n'est qu'un confort d'affichage.
  const atteignables = new Set(actuelComplet.ciblesAutorisees ?? []);
  const proposables = statuts.filter(
    (s) => s.id !== statutActuel.id && atteignables.has(s.id) && !(bloque && s.estVente),
  );

  return (
    <form action={action} className={compact ? 'flex flex-wrap items-center gap-2' : 'space-y-2'}>
      <input type="hidden" name="id" value={produitId} />
      {proposables.length === 0 ? (
        <span className="text-xs text-slate-600">
          Aucun passage possible depuis « {statutActuel.nom} ».
        </span>
      ) : null}
      <select
        name="statutId"
        value={cibleId}
        onChange={(e) => setCibleId(e.target.value)}
        required
        disabled={proposables.length === 0}
        className="rounded-md border border-slate-400 bg-white px-2 py-1 text-sm text-slate-900 disabled:bg-slate-100"
        hidden={proposables.length === 0}
      >
        <option value="">Changer de statut…</option>
        {proposables.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nom}
          </option>
        ))}
      </select>

      {cible?.estVente ? (
        <label className="flex items-center gap-1.5 text-sm text-slate-700">
          <span className="whitespace-nowrap">Encaissé</span>
          <input
            name="prixVendu"
            type="text"
            inputMode="decimal"
            required
            // Pré-rempli avec le prix déjà encaissé, sinon celui de l'étiquette :
            // dans la plupart des ventes il n'y a rien à corriger, seulement à
            // confirmer. On ne le retape que si le prix a été négocié.
            defaultValue={prixVendu ?? prixVente ?? ''}
            className="w-24 rounded-md border border-slate-400 bg-white px-2 py-1 text-sm text-slate-900"
          />
          <span>€</span>
        </label>
      ) : null}

      {cibleId ? (
        <button
          type="submit"
          disabled={enCours}
          className="rounded-md bg-slate-900 px-3 py-1 text-sm font-medium text-white transition hover:bg-slate-700 disabled:bg-slate-400"
        >
          {enCours ? '…' : 'Appliquer'}
        </button>
      ) : null}

      {etat.erreur ? (
        <div className={compact ? 'w-full' : ''}>
          <Alerte>{etat.erreur}</Alerte>
        </div>
      ) : null}
    </form>
  );
}
