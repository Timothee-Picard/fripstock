'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import {
  clonerTemplate,
  creerAttribut,
  definirOptions,
  renommerAttribut,
  supprimerAttribut,
  type EtatAttribut,
} from './actions';
import { Alerte, Bouton, Champ } from '@/components/champ';
import {
  aplatirArbre,
  LIBELLES_TYPES,
  TYPES_A_OPTIONS,
  type AttributDefinition,
  type AttributTemplate,
  type CategorieArbre,
  type TypeAttribut,
} from '@/lib/types';

/** Noms des catégories qui proposent cet attribut, pour un rappel en lecture seule. */
function nommerCategories(arbre: CategorieArbre[], attribut: AttributDefinition): string[] {
  const cochees = new Set(attribut.categories.map((c) => c.categorieId));
  return aplatirArbre(arbre)
    .filter((c) => cochees.has(c.id))
    .map((c) => c.libelle.replace(/[\u00a0└ ]/g, ''));
}

const ETAT_INITIAL: EtatAttribut = {};

export function DepuisModele({ templates }: { templates: AttributTemplate[] }) {
  const [etat, action, enCours] = useActionState(clonerTemplate, ETAT_INITIAL);

  if (templates.length === 0) return null;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-medium text-slate-900">Ajouter depuis un modèle</h2>
      <p className="mt-1 text-sm text-slate-600">
        Le modèle est copié dans votre entreprise, options comprises. La copie est ensuite
        indépendante : la renommer ou changer ses options n&apos;affecte pas le modèle.
      </p>
      {etat.erreur ? <div className="mt-3">{<Alerte>{etat.erreur}</Alerte>}</div> : null}
      {etat.succes ? <div className="mt-3">{<Alerte ton="info">{etat.succes}</Alerte>}</div> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {templates.map((t) => (
          <form key={t.id} action={action}>
            <input type="hidden" name="templateId" value={t.id} />
            <input type="hidden" name="nom" value={t.nom} />
            <Bouton type="submit" variante="secondaire" disabled={enCours}>
              {t.nom}
              <span className="ml-2 text-xs text-slate-600">
                {LIBELLES_TYPES[t.type]}
                {t.options.length > 0 ? ` · ${t.options.length} options` : ''}
              </span>
            </Bouton>
          </form>
        ))}
      </div>
    </section>
  );
}

export function FormulaireCreation() {
  const [etat, action, enCours] = useActionState(creerAttribut, ETAT_INITIAL);
  const [type, setType] = useState<TypeAttribut>('TEXT');

  return (
    <form action={action} className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-medium text-slate-900">Attribut personnalisé</h2>
      {etat.erreur ? <Alerte>{etat.erreur}</Alerte> : null}
      {etat.succes ? <Alerte ton="info">{etat.succes}</Alerte> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Champ label="Nom" name="nom" required />
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-800">Type</span>
          <select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as TypeAttribut)}
            className="w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-sm text-slate-900"
          >
            {Object.entries(LIBELLES_TYPES).map(([valeur, libelle]) => (
              <option key={valeur} value={valeur}>
                {libelle}
              </option>
            ))}
          </select>
        </label>
      </div>

      {TYPES_A_OPTIONS.includes(type) ? (
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-800">Options</span>
          <textarea
            name="options"
            rows={3}
            required
            placeholder="S, M, L"
            className="w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500"
          />
          <span className="mt-1 block text-xs text-slate-600">
            Séparez par une virgule ou un retour à la ligne. L&apos;ordre saisi est l&apos;ordre
            affiché.
          </span>
        </label>
      ) : null}

      <Bouton type="submit" disabled={enCours}>
        {enCours ? 'Création…' : 'Créer l’attribut'}
      </Bouton>
    </form>
  );
}

export function CarteAttribut({
  attribut,
  arbre,
}: {
  attribut: AttributDefinition;
  arbre: CategorieArbre[];
}) {
  const [etatNom, actionNom, nomEnCours] = useActionState(renommerAttribut, ETAT_INITIAL);
  const [etatOptions, actionOptions, optionsEnCours] = useActionState(definirOptions, ETAT_INITIAL);
  const [etatSuppr, actionSuppr, supprEnCours] = useActionState(supprimerAttribut, ETAT_INITIAL);

  // Les catégories concernées se choisissent depuis l'écran Catégories : on
  // raisonne « une robe a une taille », pas « la taille appartient aux robes ».
  const nomsCategories = arbre.length > 0 ? nommerCategories(arbre, attribut) : [];

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <form action={actionNom} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={attribut.id} />
          <div className="min-w-48">
            <Champ label="Nom" name="nom" defaultValue={attribut.nom} required />
          </div>
          <Bouton type="submit" variante="secondaire" disabled={nomEnCours}>
            {nomEnCours ? '…' : 'Renommer'}
          </Bouton>
          <span className="pb-2 text-xs text-slate-600">
            {LIBELLES_TYPES[attribut.type]}
            {attribut.clonedFromTemplateId ? ' · copié d’un modèle' : ''}
          </span>
        </form>

        <form
          action={actionSuppr}
          onSubmit={(e) => {
            if (!confirm(`Supprimer l’attribut « ${attribut.nom} » ?`)) e.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={attribut.id} />
          <Bouton type="submit" variante="danger" disabled={supprEnCours}>
            {supprEnCours ? '…' : 'Supprimer'}
          </Bouton>
        </form>
      </div>

      {etatNom.erreur ? <Alerte>{etatNom.erreur}</Alerte> : null}
      {etatSuppr.erreur ? <Alerte>{etatSuppr.erreur}</Alerte> : null}

      <p className="text-xs text-slate-600">
        Proposé pour&nbsp;:{' '}
        {nomsCategories.length === 0 ? (
          <span className="italic">aucune catégorie</span>
        ) : (
          nomsCategories.map((n) => (
            <span key={n} className="mr-1 rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">
              {n}
            </span>
          ))
        )}
        <Link href="/dashboard/categories" className="ml-1 underline underline-offset-2">
          modifier depuis les catégories
        </Link>
      </p>

      {TYPES_A_OPTIONS.includes(attribut.type) ? (
        <form action={actionOptions} className="space-y-2">
          <input type="hidden" name="id" value={attribut.id} />
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-800">Options</span>
            <textarea
              name="options"
              rows={3}
              defaultValue={attribut.options.map((o) => o.valeur).join(', ')}
              className="w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-sm text-slate-900"
            />
            <span className="mt-1 block text-xs text-slate-600">
              La liste enregistrée remplace l&apos;ancienne : retirer une valeur la supprime,
              l&apos;ordre saisi devient l&apos;ordre affiché. Une option utilisée par un produit ne
              peut pas être retirée.
            </span>
          </label>
          {etatOptions.erreur ? <Alerte>{etatOptions.erreur}</Alerte> : null}
          {etatOptions.succes ? <Alerte ton="info">{etatOptions.succes}</Alerte> : null}
          <Bouton type="submit" variante="secondaire" disabled={optionsEnCours}>
            {optionsEnCours ? '…' : 'Enregistrer les options'}
          </Bouton>
        </form>
      ) : null}
    </section>
  );
}
