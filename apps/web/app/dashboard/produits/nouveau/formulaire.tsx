'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { creerProduit, type EtatProduit } from '../actions';
import { AttributsDynamiques } from './attributs-dynamiques';
import { ChampPhoto } from './champ-photo';
import { Alerte, Bouton, Champ } from '@/components/champ';
import {
  aplatirArbre,
  LIBELLES_TYPE_VENTE,
  type Boutique,
  type CategorieArbre,
  type TypeVente,
} from '@/lib/types';

const ETAT_INITIAL: EtatProduit = {};

export function FormulaireProduit({
  arbre,
  boutiques,
}: {
  arbre: CategorieArbre[];
  boutiques: Boutique[];
}) {
  const [etat, action, enCours] = useActionState(creerProduit, ETAT_INITIAL);
  const [categorieId, setCategorieId] = useState('');
  const [typeVente, setTypeVente] = useState<TypeVente>('ACHAT_REVENTE');

  const classe =
    'w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-sm text-slate-900';

  return (
    <form action={action} className="space-y-6">
      {etat.erreur ? <Alerte>{etat.erreur}</Alerte> : null}

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-medium text-slate-900">Identité</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Champ label="Nom" name="nom" required />
          <Champ label="Référence" name="reference" aide="Votre système actuel, ex : BTR6" />
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
            <option value="">— Choisir —</option>
            {aplatirArbre(arbre).map((c) => (
              <option key={c.id} value={c.id}>
                {c.libelle}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-800">Description</span>
          <textarea name="description" rows={2} className={classe} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-800">Commentaire interne</span>
          <textarea name="commentaire" rows={2} className={classe} />
        </label>

        <ChampPhoto />
      </section>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-medium text-slate-900">Attributs</h2>
        <AttributsDynamiques categorieId={categorieId} />
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
            <select name="boutiqueId" defaultValue="" className={classe}>
              <option value="">Stock central (non assigné)</option>
              {boutiques.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nom}
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
          {typeVente === 'ACHAT_REVENTE' ? (
            <Champ label="Prix d'achat (€)" name="prixAchat" inputMode="decimal" />
          ) : null}
          <Champ label="Prix de vente (€)" name="prixVente" inputMode="decimal" />
          <Champ label="Quantité" name="quantite" type="number" min={1} defaultValue={1} />
        </div>

        {typeVente === 'DEPOT_VENTE' ? (
          <Alerte ton="info">
            Le dépôt-vente exige un contrat de dépôt, que l&apos;étape 6 apportera. La création
            échouera tant que ce module n&apos;existe pas.
          </Alerte>
        ) : null}
      </section>

      <div className="flex items-center gap-3">
        <Bouton type="submit" disabled={enCours}>
          {enCours ? 'Création…' : 'Créer le produit'}
        </Bouton>
        <Link href="/dashboard/produits" className="text-sm text-slate-600 underline">
          Annuler
        </Link>
      </div>
    </form>
  );
}
