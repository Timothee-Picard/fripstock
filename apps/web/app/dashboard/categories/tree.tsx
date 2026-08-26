'use client';

import { useActionState, useState } from 'react';
import { createCategory, updateCategory, deleteCategory, type CategoryState } from './actions';
import { CategoryAttributes } from './category-attributes';
import { Alert, Button, Field } from '@/components/field';
import { flattenTree, type AttributeDefinition, type CategoryTree } from '@/lib/types';

const INITIAL_STATE: CategoryState = {};

function ParentSelector({
  tree,
  exclureId,
  defaut,
}: {
  tree: CategoryTree[];
  exclureId?: string;
  defaut?: string | null;
}) {
  // On retire la catégorie éditée et sa descendance : l'API refuserait le
  // cycle, autant ne pas le proposer.
  const interdits = new Set<string>();
  if (exclureId) {
    const marquer = (n: CategoryTree) => {
      interdits.add(n.id);
      n.children.forEach(marquer);
    };
    const trouver = (nodes: CategoryTree[]): void => {
      for (const n of nodes) {
        if (n.id === exclureId) marquer(n);
        else trouver(n.children);
      }
    };
    trouver(tree);
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
        {flattenTree(tree)
          .filter((c) => !interdits.has(c.id))
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
      </select>
    </label>
  );
}

export function CreateForm({ tree }: { tree: CategoryTree[] }) {
  const [state, action, pending] = useActionState(createCategory, INITIAL_STATE);

  return (
    <form action={action} className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-medium text-slate-900">Nouvelle catégorie</h2>
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.success ? <Alert tone="info">{state.success}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nom" name="name" required />
        <ParentSelector tree={tree} />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? 'Création…' : 'Créer'}
      </Button>
    </form>
  );
}

function CategoryRow({
  node,
  tree,
  attributes,
  depth,
}: {
  node: CategoryTree;
  tree: CategoryTree[];
  attributes: AttributeDefinition[];
  depth: number;
}) {
  const [editing, setEdition] = useState(false);
  const [etatEdit, actionEdit, editEnCours] = useActionState(updateCategory, INITIAL_STATE);
  const [etatSuppr, actionSuppr, supprEnCours] = useActionState(deleteCategory, INITIAL_STATE);

  return (
    <li>
      <div
        className="flex flex-wrap items-center gap-3 border-b border-slate-100 py-2"
        style={{ paddingLeft: `${depth * 1.5}rem` }}
      >
        {editing ? (
          <form action={actionEdit} className="flex flex-1 flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={node.id} />
            <div className="min-w-40 flex-1">
              <Field label="Nom" name="name" defaultValue={node.name} required />
            </div>
            <div className="min-w-48 flex-1">
              <ParentSelector tree={tree} exclureId={node.id} defaut={node.parentId} />
            </div>
            <Button type="submit" disabled={editEnCours}>
              {editEnCours ? '…' : 'Enregistrer'}
            </Button>
            <Button type="button" variante="secondaire" onClick={() => setEdition(false)}>
              Annuler
            </Button>
          </form>
        ) : (
          <>
            <span className="min-w-40 text-sm text-slate-900">
              {depth > 0 ? <span className="text-slate-500">└ </span> : null}
              {node.name}
            </span>
            <CategoryAttributes
              categoryId={node.id}
              categorieNom={node.name}
              attributes={attributes}
              selected={attributes
                .filter((a) => a.categories.some((c) => c.categoryId === node.id))
                .map((a) => a.id)}
            />
            <Button type="button" variante="secondaire" onClick={() => setEdition(true)}>
              Renommer
            </Button>
            <form
              action={actionSuppr}
              onSubmit={(e) => {
                if (!confirm(`Supprimer la catégorie « ${node.name} » ?`)) e.preventDefault();
              }}
            >
              <input type="hidden" name="id" value={node.id} />
              <Button type="submit" variante="danger" disabled={supprEnCours}>
                {supprEnCours ? '…' : 'Supprimer'}
              </Button>
            </form>
          </>
        )}
      </div>

      {etatEdit.error ? (
        <div style={{ paddingLeft: `${depth * 1.5}rem` }} className="py-1">
          <Alert>{etatEdit.error}</Alert>
        </div>
      ) : null}
      {etatSuppr.error ? (
        <div style={{ paddingLeft: `${depth * 1.5}rem` }} className="py-1">
          <Alert>{etatSuppr.error}</Alert>
        </div>
      ) : null}

      {node.children.length > 0 ? (
        <ul>
          {node.children.map((enfant) => (
            <CategoryRow
              key={enfant.id}
              node={enfant}
              tree={tree}
              attributes={attributes}
              depth={depth + 1}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function CategoryTreeView({
  tree,
  attributes,
}: {
  tree: CategoryTree[];
  attributes: AttributeDefinition[];
}) {
  if (tree.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">
        Aucune catégorie pour l&apos;instant.
      </p>
    );
  }
  return (
    <ul className="rounded-lg border border-slate-200 bg-white px-4">
      {tree.map((n) => (
        <CategoryRow key={n.id} node={n} tree={tree} attributes={attributes} depth={0} />
      ))}
    </ul>
  );
}
