'use client';

import { useActionState, useState } from 'react';
import {
  detacherProduit,
  modifierContrat,
  rattacherProduits,
  supprimerContrat,
  type EtatContrat,
} from '../actions';
import { Alerte, Bouton, Champ } from '@/components/champ';
import { LIBELLES_STATUT_CONTRAT, type ContratDepot, type ProduitResume } from '@/lib/types';

const ETAT_INITIAL: EtatContrat = {};
const CHAMP = 'w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-sm text-slate-900';

/**
 * Conditions du contrat, repliées par défaut.
 *
 * Le bouton vit dans l'en-tête à côté de « Supprimer », et le formulaire
 * s'ouvre sur sa propre ligne en dessous : il était auparavant en bas de page,
 * sous le tableau des produits et le bloc de rattachement, donc introuvable.
 *
 * Le composant rend un fragment de deux éléments pour que le formulaire, en
 * pleine largeur, passe à la ligne dans l'en-tête au lieu de se tasser.
 */
export function FormulaireContrat({
  contrat,
  children,
}: {
  contrat: ContratDepot;
  /** Actions à poser à côté du bouton, typiquement la suppression. */
  children?: React.ReactNode;
}) {
  const [etat, action, enCours] = useActionState(modifierContrat, ETAT_INITIAL);
  const [ouvert, setOuvert] = useState(false);

  if (!ouvert) {
    return (
      <div className="flex items-center gap-2">
        <Bouton type="button" variante="secondaire" onClick={() => setOuvert(true)}>
          Modifier
        </Bouton>
        {children}
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Bouton type="button" variante="secondaire" onClick={() => setOuvert(false)}>
          Fermer
        </Bouton>
        {children}
      </div>
      <form
        action={action}
        className="w-full space-y-3 rounded-lg border border-slate-200 bg-white p-5"
      >
        <input type="hidden" name="id" value={contrat.id} />
        <h2 className="text-sm font-medium text-slate-900">Conditions</h2>
        {etat.erreur ? <Alerte>{etat.erreur}</Alerte> : null}
        {etat.succes ? <Alerte ton="info">{etat.succes}</Alerte> : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Champ
            label="Début"
            name="dateDebut"
            type="date"
            defaultValue={contrat.dateDebut.slice(0, 10)}
          />
          <Champ
            label="Fin"
            name="dateFin"
            type="date"
            defaultValue={contrat.dateFin.slice(0, 10)}
            aide="Repousser l'échéance réarme l'alerte."
          />
          <Champ
            label="Commission (%)"
            name="commission"
            inputMode="decimal"
            defaultValue={contrat.commission}
            aide="Ne touche pas aux ventes déjà faites."
          />
          <Champ
            label="Alerte (jours avant)"
            name="notifyBeforeDays"
            type="number"
            min={0}
            defaultValue={contrat.notifyBeforeDays}
          />
        </div>

        <label className="block max-w-xs">
          <span className="mb-1 block text-sm font-medium text-slate-800">État</span>
          <select name="statut" defaultValue={contrat.statut} className={CHAMP}>
            {Object.entries(LIBELLES_STATUT_CONTRAT).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-slate-600">
            « Expiré » est posé automatiquement à l&apos;échéance ; « Clos » reste votre décision.
          </span>
        </label>

        <Bouton type="submit" disabled={enCours}>
          {enCours ? 'Enregistrement…' : 'Enregistrer'}
        </Bouton>
      </form>
    </>
  );
}

export function Rattachement({
  contratId,
  candidats,
}: {
  contratId: string;
  /** Produits non vendus, encore rattachables. */
  candidats: ProduitResume[];
}) {
  const [etat, action, enCours] = useActionState(rattacherProduits, ETAT_INITIAL);

  return (
    <form action={action} className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
      <input type="hidden" name="id" value={contratId} />
      <h2 className="text-sm font-medium text-slate-900">Rattacher des produits</h2>
      <p className="text-sm text-slate-600">
        Les produits cochés passent en dépôt-vente : leur prix d&apos;achat est effacé,
        l&apos;article appartenant au déposant. Un produit déjà vendu n&apos;est plus rattachable.
      </p>

      {etat.erreur ? <Alerte>{etat.erreur}</Alerte> : null}
      {etat.succes ? <Alerte ton="info">{etat.succes}</Alerte> : null}

      {candidats.length === 0 ? (
        <p className="text-sm text-slate-600">Aucun produit disponible.</p>
      ) : (
        <>
          <div className="grid max-h-64 gap-1.5 overflow-y-auto rounded-md border border-slate-200 p-3 sm:grid-cols-2">
            {candidats.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="produitId"
                  value={p.id}
                  className="size-4 rounded border-slate-400 accent-slate-900"
                />
                <span>
                  {p.nom}
                  {p.reference ? (
                    <span className="ml-1 font-mono text-xs text-slate-600">{p.reference}</span>
                  ) : null}
                </span>
              </label>
            ))}
          </div>
          <Bouton type="submit" disabled={enCours}>
            {enCours ? 'Rattachement…' : 'Rattacher'}
          </Bouton>
        </>
      )}
    </form>
  );
}

export function BoutonDetacher({
  contratId,
  produit,
}: {
  contratId: string;
  produit: ProduitResume;
}) {
  const [etat, action, enCours] = useActionState(detacherProduit, ETAT_INITIAL);

  return (
    <form action={action} className="inline">
      <input type="hidden" name="id" value={contratId} />
      <input type="hidden" name="produitId" value={produit.id} />
      <button
        type="submit"
        disabled={enCours}
        className="text-xs text-slate-600 underline underline-offset-2 hover:text-slate-900 disabled:text-slate-400"
      >
        {enCours ? '…' : 'Détacher'}
      </button>
      {etat.erreur ? <span className="ml-2 text-xs text-red-700">{etat.erreur}</span> : null}
    </form>
  );
}

export function BoutonSupprimerContrat({ contrat }: { contrat: ContratDepot }) {
  const [etat, action, enCours] = useActionState(supprimerContrat, ETAT_INITIAL);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm('Supprimer ce contrat de dépôt ?')) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={contrat.id} />
      <Bouton type="submit" variante="danger" disabled={enCours}>
        {enCours ? '…' : 'Supprimer'}
      </Bouton>
      {etat.erreur ? <p className="mt-1 text-xs text-red-700">{etat.erreur}</p> : null}
    </form>
  );
}
