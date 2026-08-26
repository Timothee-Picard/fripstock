'use client';

import { useActionState, useState } from 'react';
import { setAttributes, type CategoryState } from './actions';
import { Alert, Button } from '@/components/field';
import { TYPE_LABELS, type AttributeDefinition } from '@/lib/types';

const INITIAL_STATE: CategoryState = {};

/**
 * Attributs proposés pour une catégorie.
 *
 * Ce n'est pas une possession : les valeurs vivent sur le produit. Cette liste
 * décide seulement de ce que le formulaire produit demandera — et de ce que
 * l'API acceptera — pour un produit de cette catégorie.
 */
export function CategoryAttributes({
  categoryId,
  categorieNom,
  attributes,
  selected,
}: {
  categoryId: string;
  categorieNom: string;
  attributes: AttributeDefinition[];
  selected: string[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(setAttributes, INITIAL_STATE);

  const checked = new Set(selected);
  const noms = attributes.filter((a) => checked.has(a.id)).map((a) => a.name);

  if (attributes.length === 0) {
    return <span className="text-xs text-slate-600">Aucun attribut défini</span>;
  }

  return (
    <div className="flex-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex flex-wrap items-center gap-1.5 text-left text-xs text-slate-600 transition hover:text-slate-900"
        aria-expanded={open}
      >
        <span className="text-slate-700">{open ? '▾' : '▸'}</span>
        {noms.length === 0 ? (
          <span className="italic">aucun attribut proposé</span>
        ) : (
          noms.map((n) => (
            <span key={n} className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">
              {n}
            </span>
          ))
        )}
        <span className="underline underline-offset-2">modifier</span>
      </button>

      {open ? (
        <form action={action} className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-3">
          <input type="hidden" name="id" value={categoryId} />
          <p className="mb-2 text-xs text-slate-600">
            Attributs demandés lors de la création d&apos;un produit dans « {categorieNom} ».
          </p>
          <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {attributes.map((a) => (
              <label key={a.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="attributeId"
                  value={a.id}
                  defaultChecked={checked.has(a.id)}
                  className="size-4 rounded border-slate-400 accent-slate-900"
                />
                {a.name}
                <span className="text-xs text-slate-600">{TYPE_LABELS[a.type]}</span>
              </label>
            ))}
          </div>
          {state.error ? <div className="mt-2">{<Alert>{state.error}</Alert>}</div> : null}
          {state.success ? (
            <div className="mt-2">{<Alert tone="info">{state.success}</Alert>}</div>
          ) : null}
          <div className="mt-3">
            <Button type="submit" variante="secondaire" disabled={pending}>
              {pending ? '…' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
