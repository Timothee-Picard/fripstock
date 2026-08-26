'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { modifierProduit, type EtatProduit } from '../../actions';
import { AttributsDynamiques } from '../../nouveau/attributs-dynamiques';
import { ChampPhoto } from '../../nouveau/champ-photo';
import { Alerte, Bouton, Champ } from '@/components/champ';
import {
  aplatirArbre,
  LIBELLES_TYPE_VENTE,
  type Boutique,
  type CategorieArbre,
  type Produit,
  type TypeVente,
} from '@/lib/types';

const ETAT_INITIAL: EtatProduit = {};

/** Valeurs actuelles, au format attendu par les champs dynamiques. */
function valeursExistantes(produit: Produit): Record<string, string[]> {
  const parAttribut: Record<string, string[]> = {};
  for (const v of produit.valeurs) {
    const brut =
      v.valeurTexte ??
      v.valeurNombre ??
      (v.valeurBooleenne === null ? null : String(v.valeurBooleenne));
    if (brut !== null) parAttribut[v.attribut.id] = [String(brut)];
  }
  for (const o of produit.options) {
    const id = o.option.attribut.id;
    parAttribut[id] = [...(parAttribut[id] ?? []), o.option.id];
  }
  return parAttribut;
}

export function FormulaireModification({
  produit,
  arbre,
  boutiques,
}: {
  produit: Produit;
  arbre: CategorieArbre[];
  boutiques: Boutique[];
}) {
  const [etat, action, enCours] = useActionState(modifierProduit, ETAT_INITIAL);
  const [categorieId, setCategorieId] = useState(produit.categorie.id);
  const [typeVente, setTypeVente] = useState<TypeVente>(produit.typeVente);

  const classe =
    'w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-sm text-slate-900';

  // Les mêmes boutons en haut et en bas : le formulaire est long, et en haut
  // ils tombent à l'endroit exact où la fiche affiche « Modifier ».
  const actions = (
    <div className="flex items-center gap-3">
      <Bouton type="submit" disabled={enCours}>
        {enCours ? 'Enregistrement…' : 'Enregistrer'}
      </Bouton>
      <Link
        href={`/dashboard/produits/${produit.id}`}
        className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      >
        Annuler
      </Link>
    </div>
  );

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="id" value={produit.id} />

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <p className="text-sm text-slate-600">
          Le prix encaissé et le statut se modifient depuis la fiche, pour que l&apos;historique
          reste juste.
        </p>
        {actions}
      </div>

      {etat.erreur ? <Alerte>{etat.erreur}</Alerte> : null}

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-medium text-slate-900">Identité</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Champ label="Nom" name="nom" defaultValue={produit.nom} required />
          <Champ label="Référence" name="reference" defaultValue={produit.reference ?? ''} />
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-800">Catégorie</span>
          <select
            name="categorieId"
            value={categorieId}
            onChange={(e) => setCategorieId(e.target.value)}
            required
            className={classe}
          >
            {aplatirArbre(arbre).map((c) => (
              <option key={c.id} value={c.id}>
                {c.libelle}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-slate-600">
            Changer de catégorie change les attributs demandés : ceux qui ne s&apos;y appliquent
            plus seront perdus.
          </span>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-800">Description</span>
          <textarea
            name="description"
            rows={2}
            defaultValue={produit.description ?? ''}
            className={classe}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-800">Commentaire interne</span>
          <textarea
            name="commentaire"
            rows={2}
            defaultValue={produit.commentaire ?? ''}
            className={classe}
          />
        </label>

        <ChampPhoto cleInitiale={produit.photoUrl ?? ''} />
      </section>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-medium text-slate-900">Attributs</h2>
        <AttributsDynamiques categorieId={categorieId} valeurs={valeursExistantes(produit)} />
      </section>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-medium text-slate-900">Vente et stock</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-800">Type de vente</span>
            <select
              name="typeVente"
              value={typeVente}
              onChange={(e) => setTypeVente(e.target.value as TypeVente)}
              className={classe}
            >
              {Object.entries(LIBELLES_TYPE_VENTE).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-800">Boutique</span>
            <select name="boutiqueId" defaultValue={produit.boutique?.id ?? ''} className={classe}>
              <option value="">Stock central (non assigné)</option>
              {boutiques.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nom}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {typeVente === 'ACHAT_REVENTE' ? (
            <Champ
              label="Prix d'achat (€)"
              name="prixAchat"
              inputMode="decimal"
              defaultValue={produit.prixAchat ?? ''}
            />
          ) : null}
          <Champ
            label="Prix de vente (€)"
            name="prixVente"
            inputMode="decimal"
            defaultValue={produit.prixVente ?? ''}
          />
          <Champ
            label="Quantité"
            name="quantite"
            type="number"
            min={1}
            defaultValue={produit.quantite}
          />
        </div>
      </section>

      {actions}
    </form>
  );
}
