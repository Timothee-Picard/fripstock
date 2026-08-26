import Link from 'next/link';
import { AssignationBoutique, BoutonSupprimerProduit } from './actions-fiche';
import { ChangementStatut } from '../changement-statut';
import { BadgeStatut } from '@/components/badge-statut';
import { appelApi } from '@/lib/api';
import { exigerSession } from '@/lib/session';
import {
  attributsLisibles,
  euros,
  LIBELLES_TYPE_VENTE,
  type Boutique,
  type Produit,
  type Statut,
} from '@/lib/types';

function Ligne({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-1.5 last:border-0">
      <dt className="text-sm text-slate-600">{libelle}</dt>
      <dd className="text-right text-sm text-slate-900">{children}</dd>
    </div>
  );
}

export default async function PageFicheProduit({ params }: { params: Promise<{ id: string }> }) {
  await exigerSession();
  const { id } = await params;

  const [produit, statuts, boutiques] = await Promise.all([
    appelApi<Produit>(`/produits/${id}`),
    appelApi<Statut[]>('/statuts'),
    appelApi<Boutique[]>('/boutiques'),
  ]);

  const attributs = attributsLisibles(produit);

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/dashboard/produits" className="text-sm text-slate-600 underline">
            ← Produits
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">{produit.nom}</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-slate-600">
            <BadgeStatut statut={produit.statut} />
            {produit.reference ? (
              <span className="font-mono text-xs">{produit.reference}</span>
            ) : null}
            <span>{produit.categorie.nom}</span>
          </p>
        </div>
        <BoutonSupprimerProduit produitId={produit.id} nom={produit.nom} />
      </div>

      {produit.statut.bloqueVente ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Ce produit est « {produit.statut.nom} » : il ne peut plus être vendu, ni voir son prix
          vendu modifié.
        </p>
      ) : null}

      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        <div>
          {produit.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/photos/${produit.photoUrl}`}
              alt={produit.nom}
              className="w-full rounded-lg border border-slate-200 object-cover"
            />
          ) : (
            <div className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-500">
              Sans photo
            </div>
          )}
        </div>

        <div className="space-y-6">
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-2 text-sm font-medium text-slate-900">Vente</h2>
            <dl>
              <Ligne libelle="Type">{LIBELLES_TYPE_VENTE[produit.typeVente]}</Ligne>
              {produit.typeVente === 'ACHAT_REVENTE' ? (
                <Ligne libelle="Prix d'achat">{euros(produit.prixAchat)}</Ligne>
              ) : null}
              <Ligne libelle="Prix affiché">{euros(produit.prixVente)}</Ligne>
              <Ligne libelle="Prix encaissé">{euros(produit.prixVendu)}</Ligne>
              {produit.dateVente ? (
                <Ligne libelle="Date de vente">
                  {new Date(produit.dateVente).toLocaleDateString('fr-FR')}
                </Ligne>
              ) : null}
              {produit.commissionAppliquee ? (
                <Ligne libelle="Commission figée">{produit.commissionAppliquee} %</Ligne>
              ) : null}
              <Ligne libelle="Quantité">{produit.quantite}</Ligne>
            </dl>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-2 text-sm font-medium text-slate-900">Attributs</h2>
            {attributs.length === 0 ? (
              <p className="text-sm text-slate-600">Aucun attribut renseigné.</p>
            ) : (
              <dl>
                {attributs.map((a) => (
                  <Ligne key={a.nom} libelle={a.nom}>
                    {a.valeur}
                  </Ligne>
                ))}
              </dl>
            )}
          </section>

          {produit.description || produit.commentaire ? (
            <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
              {produit.description ? (
                <div>
                  <h2 className="text-sm font-medium text-slate-900">Description</h2>
                  <p className="mt-1 whitespace-pre-line text-sm text-slate-700">
                    {produit.description}
                  </p>
                </div>
              ) : null}
              {produit.commentaire ? (
                <div>
                  <h2 className="text-sm font-medium text-slate-900">Commentaire interne</h2>
                  <p className="mt-1 whitespace-pre-line text-sm text-slate-700">
                    {produit.commentaire}
                  </p>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>

      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-medium text-slate-900">Actions</h2>
        <ChangementStatut
          produitId={produit.id}
          statutActuel={produit.statut}
          statuts={statuts}
          compact
        />
        <AssignationBoutique
          produitId={produit.id}
          boutiqueId={produit.boutique?.id ?? null}
          boutiques={boutiques}
        />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-medium text-slate-900">Historique des statuts</h2>
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
      </section>
    </div>
  );
}
