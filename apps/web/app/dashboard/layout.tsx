import Link from 'next/link';
import { deconnexion } from '../(auth)/actions';
import { ClocheNotifications } from '@/components/cloche-notifications';
import { SelecteurBoutique } from '@/components/selecteur-boutique';
import { appelApi } from '@/lib/api';
import { exigerSession } from '@/lib/session';
import { aLaPermission } from '@/lib/permissions';
import type { Notifications, Permission } from '@/lib/types';

/**
 * Entrées du menu, avec la permission qu'elles supposent.
 *
 * On ne propose pas un lien que l'API refusera : la permission est vérifiée
 * côté serveur de toute façon, mais offrir une porte fermée n'aide personne.
 */
const NAVIGATION: {
  href: string;
  label: string;
  permission?: Permission;
  gerant?: boolean;
}[] = [
  { href: '/dashboard', label: 'Tableau de bord' },
  { href: '/dashboard/produits', label: 'Produits', permission: 'produits.voir' },
  { href: '/dashboard/categories', label: 'Catégories' },
  { href: '/dashboard/attributs', label: 'Attributs' },
  { href: '/dashboard/statuts', label: 'Statuts' },
  { href: '/dashboard/clients-deposants', label: 'Clients déposants', permission: 'clients.gerer' },
  { href: '/dashboard/contrats-depot', label: 'Contrats de dépôt', permission: 'depots.gerer' },
  { href: '/dashboard/boutiques', label: 'Boutiques' },
  { href: '/dashboard/utilisateurs', label: 'Utilisateurs', gerant: true },
  { href: '/dashboard/profil', label: 'Mon profil' },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await exigerSession();
  const notifications = await appelApi<Notifications>('/notifications');

  return (
    <div className="flex min-h-full flex-1 bg-slate-50">
      <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white p-4 sm:block">
        <p className="px-2 text-lg font-semibold tracking-tight text-slate-900">Fripstock</p>
        <p className="mb-6 px-2 text-xs text-slate-600">{session.entreprise.nom}</p>

        <nav className="space-y-0.5">
          {NAVIGATION.filter(
            (e) =>
              (!e.gerant || session.estGerant) &&
              (!e.permission || aLaPermission(session, e.permission)),
          ).map((entree) => (
            <Link
              key={entree.href}
              href={entree.href}
              className="block rounded-md px-2 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100"
            >
              {entree.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-3">
          <SelecteurBoutique boutiques={session.boutiques} />
          <div className="ml-auto flex items-center gap-4 text-sm">
            <ClocheNotifications donnees={notifications} />
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

        {/* flex-col : une page peut se déclarer flex-1 pour occuper toute la
            hauteur disponible (voir l'écran Statuts). Les autres gardent leur
            hauteur naturelle. */}
        <main className="flex min-w-0 flex-1 flex-col p-6">{children}</main>
      </div>
    </div>
  );
}
