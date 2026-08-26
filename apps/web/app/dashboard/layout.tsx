import Link from 'next/link';
import { deconnexion } from '../(auth)/actions';
import { SelecteurBoutique } from '@/components/selecteur-boutique';
import { exigerSession } from '@/lib/session';

/** Les entrées grisées pointent vers des écrans à venir (voir PLAN.md). */
const NAVIGATION = [
  { href: '/dashboard', label: 'Tableau de bord', actif: true },
  { href: '/dashboard/produits', label: 'Produits', actif: true },
  { href: '/dashboard/categories', label: 'Catégories', actif: true },
  { href: '/dashboard/attributs', label: 'Attributs', actif: true },
  { href: '/dashboard/clients-deposants', label: 'Clients déposants', actif: false },
  { href: '/dashboard/boutiques', label: 'Boutiques', actif: true },
  { href: '/dashboard/utilisateurs', label: 'Utilisateurs', actif: true, gerant: true },
  { href: '/dashboard/profil', label: 'Mon profil', actif: true },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await exigerSession();

  return (
    <div className="flex min-h-full flex-1 bg-slate-50">
      <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white p-4 sm:block">
        <p className="px-2 text-lg font-semibold tracking-tight text-slate-900">Fripstock</p>
        <p className="mb-6 px-2 text-xs text-slate-600">{session.entreprise.nom}</p>

        <nav className="space-y-0.5">
          {NAVIGATION.filter((e) => !e.gerant || session.estGerant).map((entree) =>
            entree.actif ? (
              <Link
                key={entree.href}
                href={entree.href}
                className="block rounded-md px-2 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100"
              >
                {entree.label}
              </Link>
            ) : (
              <span
                key={entree.href}
                title="Disponible à une étape suivante"
                className="block cursor-not-allowed rounded-md px-2 py-1.5 text-sm text-slate-500"
              >
                {entree.label}
              </span>
            ),
          )}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-3">
          <SelecteurBoutique boutiques={session.boutiques} />
          <div className="ml-auto flex items-center gap-4 text-sm">
            <Link
              href="/dashboard/profil"
              className="text-slate-700 underline-offset-2 transition hover:text-slate-900 hover:underline"
            >
              {session.prenom} {session.nom}
              {session.estGerant ? (
                <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                  gérant
                </span>
              ) : null}
            </Link>
            <form action={deconnexion}>
              <button
                type="submit"
                className="text-slate-600 underline transition hover:text-slate-900"
              >
                Déconnexion
              </button>
            </form>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
