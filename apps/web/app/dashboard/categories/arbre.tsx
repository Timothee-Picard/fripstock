'use client';

import { useActionState, useState } from 'react';
import {
  creerCategorie,
  modifierCategorie,
  supprimerCategorie,
  type EtatCategorie,
} from './actions';
import { AttributsCategorie } from './attributs-categorie';
import { Alerte, Bouton, Champ } from '@/components/champ';
import { aplatirArbre, type AttributDefinition, type CategorieArbre } from '@/lib/types';

const ETAT_INITIAL: EtatCategorie = {};

function SelecteurParent({
  arbre,
  exclureId,
  defaut,
}: {
  arbre: CategorieArbre[];
  exclureId?: string;
  defaut?: string | null;
}) {
  // On retire la catégorie éditée et sa descendance : l'API refuserait le
  // cycle, autant ne pas le proposer.
  const interdits = new Set<string>();
  if (exclureId) {
    const marquer = (n: CategorieArbre) => {
      interdits.add(n.id);
      n.enfants.forEach(marquer);
    };
    const trouver = (noeuds: CategorieArbre[]): void => {
      for (const n of noeuds) {
        if (n.id === exclureId) marquer(n);
        else trouver(n.enfants);
      }
    };
    trouver(arbre);
  }

  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-800">Catégorie parente</span>
      <select
        name="parentId"
        defaultValue={defaut ?? ''}
        className="w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-sm text-slate-900"
      >
        <option value="">— Racine —</option>
        {aplatirArbre(arbre)
          .filter((c) => !interdits.has(c.id))
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.libelle}
            </option>
          ))}
      </select>
    </label>
  );
}

export function FormulaireCreation({ arbre }: { arbre: CategorieArbre[] }) {
  const [etat, action, enCours] = useActionState(creerCategorie, ETAT_INITIAL);

  return (
    <form action={action} className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-medium text-slate-900">Nouvelle catégorie</h2>
      {etat.erreur ? <Alerte>{etat.erreur}</Alerte> : null}
      {etat.succes ? <Alerte ton="info">{etat.succes}</Alerte> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Champ label="Nom" name="nom" required />
        <SelecteurParent arbre={arbre} />
      </div>
      <Bouton type="submit" disabled={enCours}>
        {enCours ? 'Création…' : 'Créer'}
      </Bouton>
    </form>
  );
}

function LigneCategorie({
  noeud,
  arbre,
  attributs,
  profondeur,
}: {
  noeud: CategorieArbre;
  arbre: CategorieArbre[];
  attributs: AttributDefinition[];
  profondeur: number;
}) {
  const [edition, setEdition] = useState(false);
  const [etatEdit, actionEdit, editEnCours] = useActionState(modifierCategorie, ETAT_INITIAL);
  const [etatSuppr, actionSuppr, supprEnCours] = useActionState(supprimerCategorie, ETAT_INITIAL);

  return (
    <li>
      <div
        className="flex flex-wrap items-center gap-3 border-b border-slate-100 py-2"
        style={{ paddingLeft: `${profondeur * 1.5}rem` }}
      >
        {edition ? (
          <form action={actionEdit} className="flex flex-1 flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={noeud.id} />
            <div className="min-w-40 flex-1">
              <Champ label="Nom" name="nom" defaultValue={noeud.nom} required />
            </div>
            <div className="min-w-48 flex-1">
              <SelecteurParent arbre={arbre} exclureId={noeud.id} defaut={noeud.parentId} />
            </div>
            <Bouton type="submit" disabled={editEnCours}>
              {editEnCours ? '…' : 'Enregistrer'}
            </Bouton>
            <Bouton type="button" variante="secondaire" onClick={() => setEdition(false)}>
              Annuler
            </Bouton>
          </form>
        ) : (
          <>
            <span className="min-w-40 text-sm text-slate-900">
              {profondeur > 0 ? <span className="text-slate-500">└ </span> : null}
              {noeud.nom}
            </span>
            <AttributsCategorie
              categorieId={noeud.id}
              categorieNom={noeud.nom}
              attributs={attributs}
              selectionnes={attributs
                .filter((a) => a.categories.some((c) => c.categorieId === noeud.id))
                .map((a) => a.id)}
            />
            <Bouton type="button" variante="secondaire" onClick={() => setEdition(true)}>
              Renommer
            </Bouton>
            <form
              action={actionSuppr}
              onSubmit={(e) => {
                if (!confirm(`Supprimer la catégorie « ${noeud.nom} » ?`)) e.preventDefault();
              }}
            >
              <input type="hidden" name="id" value={noeud.id} />
              <Bouton type="submit" variante="danger" disabled={supprEnCours}>
                {supprEnCours ? '…' : 'Supprimer'}
              </Bouton>
            </form>
          </>
        )}
      </div>

      {etatEdit.erreur ? (
        <div style={{ paddingLeft: `${profondeur * 1.5}rem` }} className="py-1">
          <Alerte>{etatEdit.erreur}</Alerte>
        </div>
      ) : null}
      {etatSuppr.erreur ? (
        <div style={{ paddingLeft: `${profondeur * 1.5}rem` }} className="py-1">
          <Alerte>{etatSuppr.erreur}</Alerte>
        </div>
      ) : null}

      {noeud.enfants.length > 0 ? (
        <ul>
          {noeud.enfants.map((enfant) => (
            <LigneCategorie
              key={enfant.id}
              noeud={enfant}
              arbre={arbre}
              attributs={attributs}
              profondeur={profondeur + 1}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function ArbreCategories({
  arbre,
  attributs,
}: {
  arbre: CategorieArbre[];
  attributs: AttributDefinition[];
}) {
  if (arbre.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">
        Aucune catégorie pour l&apos;instant.
      </p>
    );
  }
  return (
    <ul className="rounded-lg border border-slate-200 bg-white px-4">
      {arbre.map((n) => (
        <LigneCategorie key={n.id} noeud={n} arbre={arbre} attributs={attributs} profondeur={0} />
      ))}
    </ul>
  );
}
