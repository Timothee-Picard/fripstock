'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { updateProduct, type ProductState } from '../actions';
import { DynamicAttributes } from '../new/dynamic-attributes';
import { PhotoField } from '../new/photo-field';
import { ShopAssignment, DeleteProductButton } from './detail-actions';
import { SaleCorrection } from './sale-correction';
import { DepositorPayment } from './depositor-payment';
import { StatusChange } from '../status-change';
import { StatusBadge } from '@/components/status-badge';
import { Alert, Button } from '@/components/field';
import {
  flattenTree,
  readableAttributes,
  euros,
  SALE_TYPE_LABELS,
  type Shop,
  type CategoryTree,
  type Product,
  type Status,
  type SaleType,
} from '@/lib/types';

const INITIAL_STATE: ProductState = {};

const FIELD =
  'w-full rounded-md border border-slate-400 bg-white px-3 py-1.5 text-sm text-slate-900';

/**
 * Une donnée du produit.
 *
 * Consultation et modification passent par le même composant : le libellé, la
 * place et l'espacement ne bougent pas d'un mode à l'autre, seul le contenu
 * devient saisissable. C'est la seule façon de garantir que les deux écrans se
 * ressemblent — les tenir alignés à la main dérive au premier changement.
 */
function Data({
  label,
  value,
  saisie,
  modifier,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  saisie?: React.ReactNode;
  modifier: boolean;
  hint?: string;
}) {
  return (
    <div className="border-b border-slate-100 py-2 last:border-0">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600">
        {label}
      </span>
      {modifier && saisie ? (
        saisie
      ) : (
        <p className="text-sm text-slate-900">
          {value || <span className="text-slate-500">—</span>}
        </p>
      )}
      {modifier && hint ? <span className="mt-1 block text-xs text-slate-600">{hint}</span> : null}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="mb-2 text-sm font-medium text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

/** Valeurs actuelles, au format attendu par les champs dynamiques. */
function existingValues(product: Product): Record<string, string[]> {
  const byAttribute: Record<string, string[]> = {};
  for (const v of product.attributeValues) {
    const brut =
      v.textValue ?? v.numberValue ?? (v.booleanValue === null ? null : String(v.booleanValue));
    if (brut !== null) byAttribute[v.attribute.id] = [String(brut)];
  }
  for (const o of product.attributeOptions) {
    const id = o.option.attribute.id;
    byAttribute[id] = [...(byAttribute[id] ?? []), o.option.id];
  }
  return byAttribute;
}

export function ProductSheet({
  product,
  mode,
  tree,
  shops,
  statuses,
}: {
  product: Product;
  mode: 'voir' | 'modifier';
  tree: CategoryTree[];
  shops: Shop[];
  statuses: Status[];
}) {
  const modifier = mode === 'modifier';
  const [state, action, pending] = useActionState(updateProduct, INITIAL_STATE);
  const [categoryId, setCategoryId] = useState(product.category.id);
  const [saleType, setSaleType] = useState<SaleType>(product.saleType);

  const attributes = readableAttributes(product);
  const categorieCourante =
    flattenTree(tree)
      .find((c) => c.id === categoryId)
      ?.label.trim() ?? product.category.name;

  const actions = modifier ? (
    <div className="flex items-center gap-2">
      <Button type="submit" disabled={pending}>
        {pending ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
      <Link
        href={`/dashboard/products/${product.id}`}
        className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      >
        Annuler
      </Link>
    </div>
  ) : (
    <div className="flex items-center gap-2">
      <Link
        href={`/dashboard/products/${product.id}/edit`}
        className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      >
        Modifier
      </Link>
      <DeleteProductButton productId={product.id} name={product.name} />
    </div>
  );

  const contenu = (
    <div className="flex flex-col gap-5">
      {/* --- En-tête : les actions tombent au même endroit dans les deux modes. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/dashboard/products" className="text-sm text-slate-600 underline">
            ← Produits
          </Link>
          {modifier ? (
            <input
              name="name"
              defaultValue={product.name}
              required
              aria-label="Nom du produit"
              className="mt-1 block w-full min-w-72 rounded-md border border-slate-400 bg-white px-3 py-1.5 text-xl font-semibold text-slate-900"
            />
          ) : (
            <h1 className="mt-1 text-xl font-semibold text-slate-900">{product.name}</h1>
          )}
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <StatusBadge status={product.status} />
            {product.reference ? (
              <span className="font-mono text-xs">{product.reference}</span>
            ) : null}
            <span>{categorieCourante}</span>
          </p>
        </div>
        {actions}
      </div>

      {state.error ? <Alert>{state.error}</Alert> : null}

      {product.status.blocksSale ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Ce produit est « {product.status.name} » : il ne peut plus être vendu, ni voir son prix
          encaissé modifié.
        </p>
      ) : null}

      {/* --- Grille principale, sur toute la largeur disponible. */}
      <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="xl:row-span-2">
          <Card title="Photo">
            {modifier ? (
              <PhotoField cleInitiale={product.photoUrl ?? ''} unlabeled />
            ) : product.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/photos/${product.photoUrl}`}
                alt={product.name}
                className="w-full rounded-md border border-slate-200 object-cover"
              />
            ) : (
              <div className="flex aspect-square items-center justify-center rounded-md border border-dashed border-slate-300 text-sm text-slate-500">
                Sans photo
              </div>
            )}
          </Card>
        </div>

        <Card title="Prix et stock">
          <dl>
            <Data
              modifier={modifier}
              label="Référence"
              value={product.reference}
              saisie={
                <input name="reference" defaultValue={product.reference ?? ''} className={FIELD} />
              }
              hint="Votre système actuel, ex : BTR6"
            />
            <Data
              modifier={modifier}
              label="Catégorie"
              value={categorieCourante}
              saisie={
                <select
                  name="categoryId"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className={FIELD}
                >
                  {flattenTree(tree).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              }
              hint="Changer de catégorie fait perdre les attributs qui ne s'y appliquent plus."
            />
            <Data
              modifier={modifier}
              label="Type de vente"
              value={SALE_TYPE_LABELS[product.saleType]}
              saisie={
                <select
                  name="saleType"
                  value={saleType}
                  onChange={(e) => setSaleType(e.target.value as SaleType)}
                  className={FIELD}
                >
                  {Object.entries(SALE_TYPE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              }
            />
            <Data
              modifier={modifier}
              label="Boutique"
              value={product.shop?.name ?? 'Stock central (non assigné)'}
              saisie={
                <select name="shopId" defaultValue={product.shop?.id ?? ''} className={FIELD}>
                  <option value="">Stock central (non assigné)</option>
                  {shops.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              }
            />
            {saleType === 'RESALE' ? (
              <Data
                modifier={modifier}
                label="Prix d'achat"
                value={euros(product.purchasePrice)}
                saisie={
                  <input
                    name="purchasePrice"
                    inputMode="decimal"
                    defaultValue={product.purchasePrice ?? ''}
                    className={FIELD}
                  />
                }
              />
            ) : null}
            <Data
              modifier={modifier}
              label="Prix affiché"
              value={euros(product.salePrice)}
              saisie={
                <input
                  name="salePrice"
                  inputMode="decimal"
                  defaultValue={product.salePrice ?? ''}
                  className={FIELD}
                />
              }
            />
            <Data
              modifier={modifier}
              label="Quantité"
              value={product.quantity}
              saisie={
                <input
                  name="quantity"
                  type="number"
                  min={1}
                  defaultValue={product.quantity}
                  className={FIELD}
                />
              }
            />
            {/* Vente : lecture seule des deux côtés. On corrige une vente par
                son propre formulaire, pour ne pas la confondre avec l'édition
                du produit. */}
            {!modifier && product.soldPrice ? (
              <>
                <Data modifier={false} label="Prix encaissé" value={euros(product.soldPrice)} />
                {product.soldAt ? (
                  <Data
                    modifier={false}
                    label="Date de vente"
                    value={new Date(product.soldAt).toLocaleDateString('fr-FR')}
                  />
                ) : null}
                {product.appliedCommission ? (
                  <Data
                    modifier={false}
                    label="Commission figée"
                    value={`${product.appliedCommission} %`}
                  />
                ) : null}
              </>
            ) : null}
          </dl>
          {!modifier ? (
            <div className="mt-3 space-y-3">
              <SaleCorrection product={product} />
              <DepositorPayment product={product} />
            </div>
          ) : null}
        </Card>

        <Card title="Attributs">
          {modifier ? (
            <DynamicAttributes categoryId={categoryId} values={existingValues(product)} />
          ) : attributes.length === 0 ? (
            <p className="text-sm text-slate-600">Aucun attribut renseigné.</p>
          ) : (
            <dl>
              {attributes.map((a) => (
                <Data key={a.name} modifier={false} label={a.name} value={a.value} />
              ))}
            </dl>
          )}
        </Card>

        <div className="xl:col-span-2">
          <Card title="Description et commentaire">
            <dl>
              <Data
                modifier={modifier}
                label="Description"
                value={
                  product.description ? (
                    <span className="whitespace-pre-line">{product.description}</span>
                  ) : null
                }
                saisie={
                  <textarea
                    name="description"
                    rows={3}
                    defaultValue={product.description ?? ''}
                    className={FIELD}
                  />
                }
              />
              <Data
                modifier={modifier}
                label="Commentaire interne"
                value={
                  product.internalNote ? (
                    <span className="whitespace-pre-line">{product.internalNote}</span>
                  ) : null
                }
                saisie={
                  <textarea
                    name="internalNote"
                    rows={3}
                    defaultValue={product.internalNote ?? ''}
                    className={FIELD}
                  />
                }
              />
            </dl>
          </Card>
        </div>
      </div>

      {!modifier ? (
        <Card title="Statut et affectation">
          <div className="space-y-3">
            <StatusChange
              productId={product.id}
              statutActuel={product.status}
              statuses={statuses}
              salePrice={product.salePrice}
              soldPrice={product.soldPrice}
              compact
            />
            <ShopAssignment
              productId={product.id}
              shopId={product.shop?.id ?? null}
              shops={shops}
            />
          </div>
        </Card>
      ) : null}

      <Card title="Historique des statuts">
        <ol className="space-y-2">
          {product.statusHistory.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="w-32 shrink-0 text-xs text-slate-600">
                {new Date(h.changedAt).toLocaleString('fr-FR', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </span>
              <StatusBadge status={h.status} />
              <span className="text-slate-700">
                {h.author ? `${h.author.firstName} ${h.author.lastName}` : 'Utilisateur supprimé'}
              </span>
              {h.note ? <span className="text-slate-600">— {h.note}</span> : null}
            </li>
          ))}
        </ol>
      </Card>

      {modifier ? <div className="flex justify-end">{actions}</div> : null}
    </div>
  );

  if (!modifier) return contenu;

  return (
    <form action={action}>
      <input type="hidden" name="id" value={product.id} />
      {contenu}
    </form>
  );
}
