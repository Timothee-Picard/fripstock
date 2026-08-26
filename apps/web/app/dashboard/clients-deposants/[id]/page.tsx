import Link from 'next/link';
import { BoutonSupprimerClient, ModificationClient } from '../formulaires';
import { BadgeStatut } from '@/components/badge-statut';
import { AccesRefuse } from '@/components/acces-refuse';
import { appelApiTolerant } from '@/lib/api';
import { exigerSession } from '@/lib/session';
import {
  eurosNombre,
  LIBELLES_STATUT_CONTRAT,
  type ClientDeposant,
  type ContratDepot,
  type Releve,
} from '@/lib/types';

function Total({ libelle, valeur, fort }: { libelle: string; valeur: string; fort?: boolean }) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <span className="block text-xs uppercase tracking-wide text-slate-600">{libelle}</span>
      <span
        className={`mt-0.5 block ${fort ? 'text-lg font-semibold text-slate-900' : 'text-sm text-slate-800'}`}
      >
        {valeur}
      </span>
    </div>
  );
}

export default async function PageClientDeposant({ params }: { params: Promise<{ id: string }> }) {
  await exigerSession();
  const { id } = await params;

  const [fiche, bilan, tousContrats] = await Promise.all([
    appelApiTolerant<ClientDeposant & { contrats: ContratDepot[] }>(`/clients-deposants/${id}`),
    appelApiTolerant<Releve>(`/clients-deposants/${id}/releve`),
    appelApiTolerant<ContratDepot[]>('/contrats-depot'),
  ]);
  if (fiche.refus || !fiche.donnees || !bilan.donnees) {
    return <AccesRefuse quoi="Client déposant" permission="clients.gerer" />;
  }

  const client = fiche.donnees;
  const releve = bilan.donnees;
  // Les contrats exigent `depots.gerer` : sans, on affiche le relevé sans eux
  // plutôt que de refuser toute la page.
  const siens = (tousContrats.donnees ?? []).filter((c) => c.clientId === id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/dashboard/clients-deposants" className="text-sm text-slate-600 underline">
            ← Clients déposants
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">
            {client.prenom ? `${client.prenom} ${client.nom}` : client.nom}
          </h1>
          {client.iban ? (
            <p className="mt-1 font-mono text-xs text-slate-600">{client.iban}</p>
          ) : null}
        </div>
        <ModificationClient client={client}>
          <BoutonSupprimerClient client={client} />
        </ModificationClient>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-medium text-slate-900">Relevé</h2>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Total libelle="Produits vendus" valeur={String(releve.totaux.produitsVendus)} />
          <Total libelle="Total encaissé" valeur={eurosNombre(releve.totaux.totalVendu)} />
          <Total libelle="Part boutique" valeur={eurosNombre(releve.totaux.partBoutique)} />
          <Total libelle="Déjà réglé" valeur={eurosNombre(releve.totaux.dejaPaye)} />
          <Total libelle="Restant dû" valeur={eurosNombre(releve.totaux.restantDu)} fort />
        </div>

        {releve.lignes.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">
            Aucun produit vendu pour ce déposant pour l&apos;instant.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Produit</th>
                  <th className="px-3 py-2 font-medium">Vendu le</th>
                  <th className="px-3 py-2 font-medium">Encaissé</th>
                  <th className="px-3 py-2 font-medium">Commission</th>
                  <th className="px-3 py-2 font-medium">Part boutique</th>
                  <th className="px-3 py-2 font-medium">Part déposant</th>
                  <th className="px-3 py-2 font-medium">Réglé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {releve.lignes.map((l) => (
                  <tr key={l.produitId}>
                    <td className="px-3 py-2">
                      <Link
                        href={`/dashboard/produits/${l.produitId}`}
                        className="text-slate-900 underline-offset-2 hover:underline"
                      >
                        {l.nom}
                      </Link>
                      {l.reference ? (
                        <span className="ml-2 font-mono text-xs text-slate-600">{l.reference}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {l.dateVente ? new Date(l.dateVente).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{eurosNombre(l.prixVendu)}</td>
                    <td className="px-3 py-2 text-slate-700">{l.commission} %</td>
                    <td className="px-3 py-2 text-slate-700">{eurosNombre(l.partBoutique)}</td>
                    <td className="px-3 py-2 font-medium text-slate-900">
                      {eurosNombre(l.partDeposant)}
                    </td>
                    <td className="px-3 py-2">
                      {l.deposantPaye ? (
                        <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">
                          réglé
                        </span>
                      ) : (
                        <span className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-900">
                          à régler
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-3 text-xs text-slate-600">
          La commission retenue est celle figée au moment de la vente, pas celle du contrat :
          modifier un contrat ne réécrit donc pas un relevé déjà réglé. Le règlement se coche depuis
          la fiche du produit.
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-medium text-slate-900">Contrats</h2>
        {siens.length === 0 ? (
          <p className="text-sm text-slate-600">
            Aucun contrat.{' '}
            <Link href="/dashboard/contrats-depot" className="underline">
              En créer un
            </Link>
            .
          </p>
        ) : (
          <ul className="space-y-2">
            {siens.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 text-sm">
                <Link
                  href={`/dashboard/contrats-depot/${c.id}`}
                  className="text-slate-900 underline-offset-2 hover:underline"
                >
                  {new Date(c.dateDebut).toLocaleDateString('fr-FR')} →{' '}
                  {new Date(c.dateFin).toLocaleDateString('fr-FR')}
                </Link>
                <BadgeStatut
                  statut={{
                    nom: LIBELLES_STATUT_CONTRAT[c.statut],
                    couleur: c.statut === 'ACTIF' ? '#10b981' : '#94a3b8',
                  }}
                />
                <span className="text-slate-600">
                  {c.commission} % · {c._count.produits} produit(s)
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
