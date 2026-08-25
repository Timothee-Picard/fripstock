import Link from 'next/link';
import { exigerSession } from '@/lib/session';

export default async function PageTableauDeBord() {
  const session = await exigerSession();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Bonjour {session.prenom}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {session.estGerant
            ? `Vous êtes gérant de ${session.entreprise.nom}.`
            : `Vous êtes employé chez ${session.entreprise.nom}.`}
        </p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-medium text-slate-900">Vos accès</h2>
        {session.boutiques.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">
            {session.estGerant ? (
              <>
                Aucune boutique pour l&apos;instant.{' '}
                <Link href="/dashboard/boutiques" className="font-medium text-slate-900 underline">
                  Créez la première
                </Link>
                .
              </>
            ) : (
              'Aucune boutique ne vous a encore été attribuée. Demandez à votre gérant de vous donner accès.'
            )}
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {session.boutiques.map((b) => (
              <li key={b.boutiqueId} className="text-sm">
                <span className="font-medium text-slate-800">{b.nom}</span>
                <span className="ml-2 text-slate-600">
                  {b.tousDroits ? 'tous les droits' : `${b.permissions.length} permission(s)`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-sm text-slate-600">
        Produits, catalogue et dépôt-vente arrivent aux étapes suivantes du PLAN.md.
      </p>
    </div>
  );
}
