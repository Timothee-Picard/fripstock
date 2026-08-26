import Link from 'next/link';
import { BoutonDetacher, BoutonSupprimerContrat, FormulaireContrat, Rattachement } from './gestion';
import { BadgeStatut } from '@/components/badge-statut';
import { AccesRefuse } from '@/components/acces-refuse';
import { appelApiTolerant } from '@/lib/api';
import { exigerSession } from '@/lib/session';
import {
  euros,
  joursAvant,
  LIBELLES_STATUT_CONTRAT,
  type ContratDepot,
  type PageProduits,
} from '@/lib/types';

export default async function PageContratDepot({ params }: { params: Promise<{ id: string }> }) {
  await exigerSession();
  const { id } = await params;

  const [fiche, inventaire] = await Promise.all([
    appelApiTolerant<Required<ContratDepot>>(`/contrats-depot/${id}`),
    appelApiTolerant<PageProduits>('/produits?parPage=200'),
  ]);
  if (fiche.refus || !fiche.donnees) {
    return <AccesRefuse quoi="Contrat de dépôt" permission="depots.gerer" />;
  }
  const contrat = fiche.donnees;
  const stock = inventaire.donnees ?? { produits: [], total: 0, page: 1, parPage: 0, pages: 1 };

  // Rattachables : ni vendus, ni déjà sur ce contrat.
  const dejaDessus = new Set(contrat.produits.map((p) => p.id));
  const candidats = stock.produits.filter((p) => !dejaDessus.has(p.id) && !p.statut.estVente);

  const jours = joursAvant(contrat.dateFin);
  const nomClient = contrat.client.prenom
    ? `${contrat.client.prenom} ${contrat.client.nom}`
    : contrat.client.nom;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/dashboard/contrats-depot" className="text-sm text-slate-600 underline">
            ← Contrats de dépôt
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">
            Contrat de{' '}
            <Link
              href={`/dashboard/clients-deposants/${contrat.client.id}`}
              className="underline-offset-2 hover:underline"
            >
              {nomClient}
            </Link>
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {new Date(contrat.dateDebut).toLocaleDateString('fr-FR')} →{' '}
            {new Date(contrat.dateFin).toLocaleDateString('fr-FR')} · {contrat.commission} % pour la
            boutique · {LIBELLES_STATUT_CONTRAT[contrat.statut]}
          </p>
        </div>
        <FormulaireContrat contrat={contrat}>
          <BoutonSupprimerContrat contrat={contrat} />
        </FormulaireContrat>
      </div>

      {contrat.statut === 'ACTIF' && jours >= 0 && jours <= contrat.notifyBeforeDays ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Ce contrat arrive à échéance dans {jours} jour{jours > 1 ? 's' : ''}. Prolongez-le, ou
          rendez ses articles au déposant.
        </p>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-medium text-slate-900">
          Produits déposés ({contrat.produits.length})
        </h2>
        {contrat.produits.length === 0 ? (
          <p className="text-sm text-slate-600">Aucun produit rattaché.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Produit</th>
                  <th className="px-3 py-2 font-medium">Prix</th>
                  <th className="px-3 py-2 font-medium">Statut</th>
                  <th className="px-3 py-2 font-medium">Boutique</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contrat.produits.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2">
                      <Link
                        href={`/dashboard/produits/${p.id}`}
                        className="text-slate-900 underline-offset-2 hover:underline"
                      >
                        {p.nom}
                      </Link>
                      {p.reference ? (
                        <span className="ml-2 font-mono text-xs text-slate-600">{p.reference}</span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                      {p.prixVendu ? (
                        <>
                          {euros(p.prixVendu)}
                          <span className="ml-1 text-xs text-slate-600">encaissé</span>
                        </>
                      ) : (
                        euros(p.prixVente)
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <BadgeStatut statut={p.statut} />
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {p.boutique?.nom ?? <span className="text-slate-500">stock central</span>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {p.statut.estVente ? (
                        <span className="text-xs text-slate-500">vendu</span>
                      ) : (
                        <BoutonDetacher contratId={contrat.id} produit={p} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Rattachement contratId={contrat.id} candidats={candidats} />
    </div>
  );
}
