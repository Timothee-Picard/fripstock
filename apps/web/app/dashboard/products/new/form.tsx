'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { createProduct, type ProductState } from '../actions';
import { DynamicAttributes } from './dynamic-attributes';
import { PhotoField } from './photo-field';
import { Alert, Button, Field } from '@/components/field';
import {
  flattenTree,
  SALE_TYPE_LABELS,
  type Shop,
  type CategoryTree,
  type SaleType,
} from '@/lib/types';

const INITIAL_STATE: ProductState = {};

export function ProductForm({ tree, shops }: { tree: CategoryTree[]; shops: Shop[] }) {
  const [state, action, pending] = useActionState(createProduct, INITIAL_STATE);
  const [categoryId, setCategoryId] = useState('');
  const [saleType, setSaleType] = useState<SaleType>('RESALE');

  const css = 'w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-sm text-slate-900';

  return (
    <form action={action} className="space-y-6">
      {state.error ? <Alert>{state.error}</Alert> : null}

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-medium text-slate-900">Le produit</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nom" name="name" required />
          <Field
            label="Référence"
            name="reference"
            hint="Générée si vous la laissez vide : A-0042, ou D-MAR-001 en dépôt."
          />
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-800">Catégorie</span>
          <select
            name="categoryId"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
            className={css}
          >
            <option value="">— Choisir —</option>
            {flattenTree(tree).map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-800">Description</span>
          <textarea name="description" rows={2} className={css} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-800">Commentaire interne</span>
          <textarea name="internalNote" rows={2} className={css} />
        </label>

        <PhotoField />
      </section>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-medium text-slate-900">Attributs</h2>
        <DynamicAttributes categoryId={categoryId} />
      </section>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-medium text-slate-900">Vente et stock</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-800">Type de vente</span>
            <select
              name="saleType"
              value={saleType}
              onChange={(e) => setSaleType(e.target.value as SaleType)}
              className={css}
            >
              {Object.entries(SALE_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-800">Boutique</span>
            <select name="shopId" defaultValue="" className={css}>
              <option value="">Stock central (non assigné)</option>
              {shops.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-slate-600">
              Assignable plus tard depuis la fiche.
            </span>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {/* Le prix d'achat n'a de sens qu'en achat-revente : en dépôt-vente,
              l'article appartient au déposant. */}
          {saleType === 'RESALE' ? (
            <Field label="Prix d'achat (€)" name="purchasePrice" inputMode="decimal" />
          ) : null}
          <Field label="Prix de vente (€)" name="salePrice" inputMode="decimal" />
          <Field label="Quantité" name="quantity" type="number" min={1} defaultValue={1} />
        </div>

        {saleType === 'CONSIGNMENT' ? (
          <Alert tone="info">
            Un article en dépôt-vente doit être rattaché à un contrat. Créez-le ici en
            achat-revente, puis rattachez-le depuis le contrat du déposant — il basculera
            automatiquement.
          </Alert>
        ) : null}
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Création…' : 'Créer le produit'}
        </Button>
        <Link href="/dashboard/products" className="text-sm text-slate-600 underline">
          Annuler
        </Link>
      </div>
    </form>
  );
}
