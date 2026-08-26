'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { modifierProduit, type EtatProduit } from '../actions';
import { AttributsDynamiques } from '../nouveau/attributs-dynamiques';
import { ChampPhoto } from '../nouveau/champ-photo';
import { AssignationBoutique, BoutonSupprimerProduit } from './actions-fiche';
import { CorrectionVente } from './correction-vente';
import { PaiementDeposant } from './paiement-deposant';
import { ChangementStatut } from '../changement-statut';
import { BadgeStatut } from '@/components/badge-statut';
import { Alerte, Bouton } from '@/components/champ';
import {
  aplatirArbre,
  attributsLisibles,
  euros,
  LIBELLES_TYPE_VENTE,
  type Boutique,
  type CategorieArbre,
  type Produit,
  type Statut,
  type TypeVente,
} from '@/lib/types';

const ETAT_INITIAL: EtatProduit = {};

const CHAMP =
  'w-full rounded-md border border-slate-400 bg-white px-3 py-1.5 text-sm text-slate-900';

/**
 * Une donnée du produit.
 *
 * Consultation et modification passent par le même composant : le libellé, la
 * place et l'espacement ne bougent pas d'un mode à l'autre, seul le contenu
 * devient saisissable. C'est la seule façon de garantir que les deux écrans se
 * ressemblent — les tenir alignés à la main dérive au premier changement.
 */
function Donnee({
  libelle,
  valeur,
  saisie,
  modifier,
  aide,
}: {
  libelle: string;
  valeur: React.ReactNode;
  saisie?: React.ReactNode;
  modifier: boolean;
  aide?: string;
}) {
  return (
    <div className="border-b border-slate-100 py-2 last:border-0">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600">
        {libelle}
      </span>
      {modifier && saisie ? (
        saisie
      ) : (
        <p className="text-sm text-slate-900">
          {valeur || <span className="text-slate-500">—</span>}
        </p>
      )}
      {modifier && aide ? <span className="mt-1 block text-xs text-slate-600">{aide}</span> : null}
    </div>
  );
}

function Carte({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="mb-2 text-sm font-medium text-slate-900">{titre}</h2>
      {children}
    </section>
  );
}

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

export function FicheProduit({
  produit,
  mode,
  arbre,
  boutiques,
  statuts,
}: {
  produit: Produit;
  mode: 'voir' | 'modifier';
  arbre: CategorieArbre[];
  boutiques: Boutique[];
  statuts: Statut[];
}) {
  const modifier = mode === 'modifier';
  const [etat, action, enCours] = useActionState(modifierProduit, ETAT_INITIAL);
  const [categorieId, setCategorieId] = useState(produit.categorie.id);
  const [typeVente, setTypeVente] = useState<TypeVente>(produit.typeVente);

  const attributs = attributsLisibles(produit);
  const categorieCourante =
    aplatirArbre(arbre)
      .find((c) => c.id === categorieId)
      ?.libelle.trim() ?? produit.categorie.nom;

  const actions = modifier ? (
    <div className="flex items-center gap-2">
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
  ) : (
    <div className="flex items-center gap-2">
      <Link
        href={`/dashboard/produits/${produit.id}/modifier`}
        className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      >
        Modifier
      </Link>
      <BoutonSupprimerProduit produitId={produit.id} nom={produit.nom} />
    </div>
  );

  const contenu = (
    <div className="flex flex-col gap-5">
      {/* --- En-tête : les actions tombent au même endroit dans les deux modes. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/dashboard/produits" className="text-sm text-slate-600 underline">
            ← Produits
          </Link>
          {modifier ? (
            <input
              name="nom"
              defaultValue={produit.nom}
              required
              aria-label="Nom du produit"
              className="mt-1 block w-full min-w-72 rounded-md border border-slate-400 bg-white px-3 py-1.5 text-xl font-semibold text-slate-900"
            />
          ) : (
            <h1 className="mt-1 text-xl font-semibold text-slate-900">{produit.nom}</h1>
          )}
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <BadgeStatut statut={produit.statut} />
            {produit.reference ? (
              <span className="font-mono text-xs">{produit.reference}</span>
            ) : null}
            <span>{categorieCourante}</span>
          </p>
        </div>
        {actions}
      </div>

      {etat.erreur ? <Alerte>{etat.erreur}</Alerte> : null}

      {produit.statut.bloqueVente ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Ce produit est « {produit.statut.nom} » : il ne peut plus être vendu, ni voir son prix
          encaissé modifié.
        </p>
      ) : null}

      {/* --- Grille principale, sur toute la largeur disponible. */}
      <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="xl:row-span-2">
          <Carte titre="Photo">
            {modifier ? (
              <ChampPhoto cleInitiale={produit.photoUrl ?? ''} sansLibelle />
            ) : produit.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/photos/${produit.photoUrl}`}
                alt={produit.nom}
                className="w-full rounded-md border border-slate-200 object-cover"
              />
            ) : (
              <div className="flex aspect-square items-center justify-center rounded-md border border-dashed border-slate-300 text-sm text-slate-500">
                Sans photo
              </div>
            )}
          </Carte>
        </div>

        <Carte titre="Prix et stock">
          <dl>
            <Donnee
              modifier={modifier}
              libelle="Référence"
              valeur={produit.reference}
              saisie={
                <input name="reference" defaultValue={produit.reference ?? ''} className={CHAMP} />
              }
              aide="Votre système actuel, ex : BTR6"
            />
            <Donnee
              modifier={modifier}
              libelle="Catégorie"
              valeur={categorieCourante}
              saisie={
                <select
                  name="categorieId"
                  value={categorieId}
                  onChange={(e) => setCategorieId(e.target.value)}
                  className={CHAMP}
                >
                  {aplatirArbre(arbre).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.libelle}
                    </option>
                  ))}
                </select>
              }
              aide="Changer de catégorie fait perdre les attributs qui ne s'y appliquent plus."
            />
            <Donnee
              modifier={modifier}
              libelle="Type de vente"
              valeur={LIBELLES_TYPE_VENTE[produit.typeVente]}
              saisie={
                <select
                  name="typeVente"
                  value={typeVente}
                  onChange={(e) => setTypeVente(e.target.value as TypeVente)}
                  className={CHAMP}
                >
                  {Object.entries(LIBELLES_TYPE_VENTE).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              }
            />
            <Donnee
              modifier={modifier}
              libelle="Boutique"
              valeur={produit.boutique?.nom ?? 'Stock central (non assigné)'}
              saisie={
                <select
                  name="boutiqueId"
                  defaultValue={produit.boutique?.id ?? ''}
                  className={CHAMP}
                >
                  <option value="">Stock central (non assigné)</option>
                  {boutiques.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.nom}
                    </option>
                  ))}
                </select>
              }
            />
            {typeVente === 'ACHAT_REVENTE' ? (
              <Donnee
                modifier={modifier}
                libelle="Prix d'achat"
                valeur={euros(produit.prixAchat)}
                saisie={
                  <input
                    name="prixAchat"
                    inputMode="decimal"
                    defaultValue={produit.prixAchat ?? ''}
                    className={CHAMP}
                  />
                }
              />
            ) : null}
            <Donnee
              modifier={modifier}
              libelle="Prix affiché"
              valeur={euros(produit.prixVente)}
              saisie={
                <input
                  name="prixVente"
                  inputMode="decimal"
                  defaultValue={produit.prixVente ?? ''}
                  className={CHAMP}
                />
              }
            />
            <Donnee
              modifier={modifier}
              libelle="Quantité"
              valeur={produit.quantite}
              saisie={
                <input
                  name="quantite"
                  type="number"
                  min={1}
                  defaultValue={produit.quantite}
                  className={CHAMP}
                />
              }
            />
            {/* Vente : lecture seule des deux côtés. On corrige une vente par
                son propre formulaire, pour ne pas la confondre avec l'édition
                du produit. */}
            {!modifier && produit.prixVendu ? (
              <>
                <Donnee
                  modifier={false}
                  libelle="Prix encaissé"
                  valeur={euros(produit.prixVendu)}
                />
                {produit.dateVente ? (
                  <Donnee
                    modifier={false}
                    libelle="Date de vente"
                    valeur={new Date(produit.dateVente).toLocaleDateString('fr-FR')}
                  />
                ) : null}
                {produit.commissionAppliquee ? (
                  <Donnee
                    modifier={false}
                    libelle="Commission figée"
                    valeur={`${produit.commissionAppliquee} %`}
                  />
                ) : null}
              </>
            ) : null}
          </dl>
          {!modifier ? (
            <div className="mt-3 space-y-3">
              <CorrectionVente produit={produit} />
              <PaiementDeposant produit={produit} />
            </div>
          ) : null}
        </Carte>

        <Carte titre="Attributs">
          {modifier ? (
            <AttributsDynamiques categorieId={categorieId} valeurs={valeursExistantes(produit)} />
          ) : attributs.length === 0 ? (
            <p className="text-sm text-slate-600">Aucun attribut renseigné.</p>
          ) : (
            <dl>
              {attributs.map((a) => (
                <Donnee key={a.nom} modifier={false} libelle={a.nom} valeur={a.valeur} />
              ))}
            </dl>
          )}
        </Carte>

        <div className="xl:col-span-2">
          <Carte titre="Description et commentaire">
            <dl>
              <Donnee
                modifier={modifier}
                libelle="Description"
                valeur={
                  produit.description ? (
                    <span className="whitespace-pre-line">{produit.description}</span>
                  ) : null
                }
                saisie={
                  <textarea
                    name="description"
                    rows={3}
                    defaultValue={produit.description ?? ''}
                    className={CHAMP}
                  />
                }
              />
              <Donnee
                modifier={modifier}
                libelle="Commentaire interne"
                valeur={
                  produit.commentaire ? (
                    <span className="whitespace-pre-line">{produit.commentaire}</span>
                  ) : null
                }
                saisie={
                  <textarea
                    name="commentaire"
                    rows={3}
                    defaultValue={produit.commentaire ?? ''}
                    className={CHAMP}
                  />
                }
              />
            </dl>
          </Carte>
        </div>
      </div>

      {!modifier ? (
        <Carte titre="Statut et affectation">
          <div className="space-y-3">
            <ChangementStatut
              produitId={produit.id}
              statutActuel={produit.statut}
              statuts={statuts}
              prixVente={produit.prixVente}
              prixVendu={produit.prixVendu}
              compact
            />
            <AssignationBoutique
              produitId={produit.id}
              boutiqueId={produit.boutique?.id ?? null}
              boutiques={boutiques}
            />
          </div>
        </Carte>
      ) : null}

      <Carte titre="Historique des statuts">
        <ol className="space-y-2">
          {produit.historique.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="w-32 shrink-0 text-xs text-slate-600">
                {new Date(h.changedAt).toLocaleString('fr-FR', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </span>
              <BadgeStatut statut={h.statut} />
              <span className="text-slate-700">
                {h.auteur ? `${h.auteur.prenom} ${h.auteur.nom}` : 'Utilisateur supprimé'}
              </span>
              {h.note ? <span className="text-slate-600">— {h.note}</span> : null}
            </li>
          ))}
        </ol>
      </Carte>

      {modifier ? <div className="flex justify-end">{actions}</div> : null}
    </div>
  );

  if (!modifier) return contenu;

  return (
    <form action={action}>
      <input type="hidden" name="id" value={produit.id} />
      {contenu}
    </form>
  );
}
