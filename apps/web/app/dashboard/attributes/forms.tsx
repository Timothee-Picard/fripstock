'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import {
  clonerTemplate,
  createAttribute,
  definirOptions,
  renameAttribute,
  deleteAttribute,
  type AttributeState,
} from './actions';
import { Alert, Button, Field } from '@/components/field';
import {
  flattenTree,
  TYPE_LABELS,
  TYPES_WITH_OPTIONS,
  type AttributeDefinition,
  type AttributeTemplate,
  type CategoryTree,
  type AttributeType,
} from '@/lib/types';

/** Noms des catégories qui proposent cet attribut, pour un rappel en lecture seule. */
function nameCategories(tree: CategoryTree[], attribute: AttributeDefinition): string[] {
  const checked = new Set(attribute.categories.map((c) => c.categoryId));
  return flattenTree(tree)
    .filter((c) => checked.has(c.id))
    .map((c) => c.label.replace(/[\u00a0└ ]/g, ''));
}

const INITIAL_STATE: AttributeState = {};

export function DepuisModele({ templates }: { templates: AttributeTemplate[] }) {
  const [state, action, pending] = useActionState(clonerTemplate, INITIAL_STATE);

  if (templates.length === 0) return null;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-medium text-slate-900">Ajouter depuis un modèle</h2>
      <p className="mt-1 text-sm text-slate-600">
        Le modèle est copié dans votre entreprise, options comprises. La copie est ensuite
        indépendante : la renommer ou changer ses options n&apos;affecte pas le modèle.
      </p>
      {state.error ? <div className="mt-3">{<Alert>{state.error}</Alert>}</div> : null}
      {state.success ? (
        <div className="mt-3">{<Alert tone="info">{state.success}</Alert>}</div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {templates.map((t) => (
          <form key={t.id} action={action}>
            <input type="hidden" name="templateId" value={t.id} />
            <input type="hidden" name="name" value={t.name} />
            <Button type="submit" variante="secondaire" disabled={pending}>
              {t.name}
              <span className="ml-2 text-xs text-slate-600">
                {TYPE_LABELS[t.type]}
                {t.options.length > 0 ? ` · ${t.options.length} options` : ''}
              </span>
            </Button>
          </form>
        ))}
      </div>
    </section>
  );
}

export function CreateForm() {
  const [state, action, pending] = useActionState(createAttribute, INITIAL_STATE);
  const [type, setType] = useState<AttributeType>('TEXT');

  return (
    <form action={action} className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-medium text-slate-900">Attribut personnalisé</h2>
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.success ? <Alert tone="info">{state.success}</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nom" name="name" required />
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-800">Type</span>
          <select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as AttributeType)}
            className="w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-sm text-slate-900"
          >
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {TYPES_WITH_OPTIONS.includes(type) ? (
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

      <Button type="submit" disabled={pending}>
        {pending ? 'Création…' : 'Créer l’attribut'}
      </Button>
    </form>
  );
}

export function AttributeCard({
  attribute,
  tree,
}: {
  attribute: AttributeDefinition;
  tree: CategoryTree[];
}) {
  const [etatNom, actionNom, nomEnCours] = useActionState(renameAttribute, INITIAL_STATE);
  const [etatOptions, actionOptions, optionsEnCours] = useActionState(
    definirOptions,
    INITIAL_STATE,
  );
  const [etatSuppr, actionSuppr, supprEnCours] = useActionState(deleteAttribute, INITIAL_STATE);

  // Les catégories concernées se choisissent depuis l'écran Catégories : on
  // raisonne « une robe a une taille », pas « la taille appartient aux robes ».
  const categoryNames = tree.length > 0 ? nameCategories(tree, attribute) : [];

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <form action={actionNom} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={attribute.id} />
          <div className="min-w-48">
            <Field label="Nom" name="name" defaultValue={attribute.name} required />
          </div>
          <Button type="submit" variante="secondaire" disabled={nomEnCours}>
            {nomEnCours ? '…' : 'Renommer'}
          </Button>
          <span className="pb-2 text-xs text-slate-600">
            {TYPE_LABELS[attribute.type]}
            {attribute.clonedFromTemplateId ? ' · copié d’un modèle' : ''}
          </span>
        </form>

        <form
          action={actionSuppr}
          onSubmit={(e) => {
            if (!confirm(`Supprimer l’attribut « ${attribute.name} » ?`)) e.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={attribute.id} />
          <Button type="submit" variante="danger" disabled={supprEnCours}>
            {supprEnCours ? '…' : 'Supprimer'}
          </Button>
        </form>
      </div>

      {etatNom.error ? <Alert>{etatNom.error}</Alert> : null}
      {etatSuppr.error ? <Alert>{etatSuppr.error}</Alert> : null}

      <p className="text-xs text-slate-600">
        Proposé pour&nbsp;:{' '}
        {categoryNames.length === 0 ? (
          <span className="italic">aucune catégorie</span>
        ) : (
          categoryNames.map((n) => (
            <span key={n} className="mr-1 rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">
              {n}
            </span>
          ))
        )}
        <Link href="/dashboard/categories" className="ml-1 underline underline-offset-2">
          modifier depuis les catégories
        </Link>
      </p>

      {TYPES_WITH_OPTIONS.includes(attribute.type) ? (
        <form action={actionOptions} className="space-y-2">
          <input type="hidden" name="id" value={attribute.id} />
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-800">Options</span>
            <textarea
              name="options"
              rows={3}
              defaultValue={attribute.options.map((o) => o.value).join(', ')}
              className="w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-sm text-slate-900"
            />
            <span className="mt-1 block text-xs text-slate-600">
              La liste enregistrée remplace l&apos;ancienne : retirer une valeur la supprime,
              l&apos;ordre saisi devient l&apos;ordre affiché. Une option utilisée par un produit ne
              peut pas être retirée.
            </span>
          </label>
          {etatOptions.error ? <Alert>{etatOptions.error}</Alert> : null}
          {etatOptions.success ? <Alert tone="info">{etatOptions.success}</Alert> : null}
          <Button type="submit" variante="secondaire" disabled={optionsEnCours}>
            {optionsEnCours ? '…' : 'Enregistrer les options'}
          </Button>
        </form>
      ) : null}
    </section>
  );
}
