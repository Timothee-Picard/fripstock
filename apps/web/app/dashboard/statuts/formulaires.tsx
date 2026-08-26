'use client';

import { useActionState, useState } from 'react';
import {
  creerStatut,
  definirParDefaut,
  deplacerStatut,
  modifierStatut,
  supprimerStatut,
  type EtatStatut,
} from './actions';
import { BadgeStatut } from '@/components/badge-statut';
import { Alerte, Bouton, Champ } from '@/components/champ';
import type { Statut } from '@/lib/types';

const ETAT_INITIAL: EtatStatut = {};

/**
 * Les trois flags pilotent la logique métier indépendamment du libellé, que le
 * gérant peut renommer. Ils se fixent à la création et ne bougent plus : des
 * produits s'appuient dessus.
 */
const FLAGS = [
  {
    cle: 'estVente',
    titre: 'Vente',
    aide: "Passer un produit à ce statut, c'est le vendre : le prix encaissé est alors demandé, et c'est ce qui compte dans le chiffre d'affaires.",
  },
  {
    cle: 'bloqueVente',
    titre: 'Invendable ensuite',
    aide: 'Un produit dans ce statut ne pourra plus jamais être vendu, ni voir son prix encaissé modifié. Pour « rendu au client » ou « retiré ».',
  },
  {
    cle: 'sortStock',
    titre: 'Sort du stock',
    aide: "Le produit ne compte plus dans l'inventaire actif ni dans les statistiques de stock disponible.",
  },
] as const;

export function FormulaireCreation() {
  const [etat, action, enCours] = useActionState(creerStatut, ETAT_INITIAL);

  return (
    <form action={action} className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-medium text-slate-900">Nouveau statut</h2>
      {etat.erreur ? <Alerte>{etat.erreur}</Alerte> : null}
      {etat.succes ? <Alerte ton="info">{etat.succes}</Alerte> : null}

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <Champ label="Nom" name="nom" required />
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-800">Couleur</span>
          <input
            type="color"
            name="couleur"
            defaultValue="#6b7280"
            className="h-9 w-16 cursor-pointer rounded-md border border-slate-400 bg-white p-1"
          />
        </label>
      </div>

      <fieldset className="rounded-md border border-slate-200 bg-slate-50 p-3">
        <legend className="px-1 text-sm font-medium text-slate-800">Comportement</legend>
        <p className="mb-2 text-xs text-slate-600">
          Ces trois réglages se fixent maintenant et ne pourront plus être changés : des produits
          s&apos;appuieront dessus. Ils valent quel que soit le nom que vous donnez au statut — le
          renommer plus tard ne change rien à son comportement.
        </p>
        <div className="space-y-2">
          {FLAGS.map((f) => (
            <label key={f.cle} className="flex gap-2 text-sm">
              <input
                type="checkbox"
                name={f.cle}
                className="mt-0.5 size-4 shrink-0 rounded border-slate-400 accent-slate-900"
              />
              <span>
                <span className="font-medium text-slate-800">{f.titre}</span>
                <span className="block text-xs text-slate-600">{f.aide}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Bouton type="submit" disabled={enCours}>
        {enCours ? 'Création…' : 'Créer le statut'}
      </Bouton>
    </form>
  );
}

export function LigneStatut({
  statut,
  premier,
  dernier,
}: {
  statut: Statut;
  premier: boolean;
  dernier: boolean;
}) {
  const [edition, setEdition] = useState(false);
  const [etatEdit, actionEdit, editEnCours] = useActionState(modifierStatut, ETAT_INITIAL);
  const [etatDefaut, actionDefaut, defautEnCours] = useActionState(definirParDefaut, ETAT_INITIAL);
  const [etatSuppr, actionSuppr, supprEnCours] = useActionState(supprimerStatut, ETAT_INITIAL);
  const [, actionDeplacer, deplacerEnCours] = useActionState(deplacerStatut, ETAT_INITIAL);

  const marques = [
    statut.estVente ? 'vente' : null,
    statut.bloqueVente ? 'invendable ensuite' : null,
    statut.sortStock ? 'sort du stock' : null,
  ].filter(Boolean);

  return (
    <li className="border-b border-slate-100 py-3 last:border-0">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-col gap-0.5">
          {[
            { sens: 'haut', signe: '▲', desactive: premier },
            { sens: 'bas', signe: '▼', desactive: dernier },
          ].map((b) => (
            <form key={b.sens} action={actionDeplacer}>
              <input type="hidden" name="id" value={statut.id} />
              <input type="hidden" name="sens" value={b.sens} />
              <button
                type="submit"
                disabled={b.desactive || deplacerEnCours}
                aria-label={b.sens === 'haut' ? 'Monter' : 'Descendre'}
                className="px-1 text-[10px] leading-none text-slate-500 transition hover:text-slate-900 disabled:invisible"
              >
                {b.signe}
              </button>
            </form>
          ))}
        </div>

        {edition ? (
          <form action={actionEdit} className="flex flex-1 flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={statut.id} />
            <div className="min-w-40 flex-1">
              <Champ label="Nom" name="nom" defaultValue={statut.nom} required />
            </div>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-800">Couleur</span>
              <input
                type="color"
                name="couleur"
                defaultValue={statut.couleur}
                className="h-9 w-16 cursor-pointer rounded-md border border-slate-400 bg-white p-1"
              />
            </label>
            <Bouton type="submit" disabled={editEnCours}>
              {editEnCours ? '…' : 'Enregistrer'}
            </Bouton>
            <Bouton type="button" variante="secondaire" onClick={() => setEdition(false)}>
              Annuler
            </Bouton>
          </form>
        ) : (
          <>
            <BadgeStatut statut={statut} />
            <span className="flex-1 text-xs text-slate-600">
              {marques.length > 0 ? marques.join(' · ') : 'statut ordinaire'}
            </span>

            {statut.estDefaut ? (
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                par défaut
              </span>
            ) : (
              <form action={actionDefaut}>
                <input type="hidden" name="id" value={statut.id} />
                <Bouton type="submit" variante="secondaire" disabled={defautEnCours}>
                  {defautEnCours ? '…' : 'Définir par défaut'}
                </Bouton>
              </form>
            )}

            <Bouton type="button" variante="secondaire" onClick={() => setEdition(true)}>
              Modifier
            </Bouton>

            <form
              action={actionSuppr}
              onSubmit={(e) => {
                if (!confirm(`Supprimer le statut « ${statut.nom} » ?`)) e.preventDefault();
              }}
            >
              <input type="hidden" name="id" value={statut.id} />
              <Bouton type="submit" variante="danger" disabled={supprEnCours}>
                {supprEnCours ? '…' : 'Supprimer'}
              </Bouton>
            </form>
          </>
        )}
      </div>

      {[etatEdit.erreur, etatDefaut.erreur, etatSuppr.erreur].filter(Boolean).map((e) => (
        <div key={e} className="mt-2">
          <Alerte>{e}</Alerte>
        </div>
      ))}
    </li>
  );
}
