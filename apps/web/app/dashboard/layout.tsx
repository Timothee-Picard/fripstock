import Link from 'next/link';
import { logout } from '../(auth)/actions';
import { NotificationBell } from '@/components/notification-bell';
import { ShopSelector } from '@/components/shop-selector';
import { apiFetch } from '@/lib/api';
import { requireSession } from '@/lib/session';
import { hasPermission } from '@/lib/permissions';
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
  manager?: boolean;
}[] = [
  { href: '/dashboard', label: 'Tableau de bord' },
  { href: '/dashboard/products', label: 'Produits', permission: 'products.view' },
  { href: '/dashboard/categories', label: 'Catégories' },
  { href: '/dashboard/attributes', label: 'Attributs' },
  { href: '/dashboard/statuses', label: 'Statuts' },
  { href: '/dashboard/depositors', label: 'Clients déposants', permission: 'depositors.manage' },
  {
    href: '/dashboard/deposit-contracts',
    label: 'Contrats de dépôt',
    permission: 'deposits.manage',
  },
  { href: '/dashboard/shops', label: 'Boutiques' },
  { href: '/dashboard/users', label: 'Utilisateurs', manager: true },
  { href: '/dashboard/profile', label: 'Mon profil' },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const notifications = await apiFetch<Notifications>('/notifications');

  return (
    <div className="flex min-h-full flex-1 bg-slate-50">
      <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white p-4 sm:block">
        <p className="px-2 text-lg font-semibold tracking-tight text-slate-900">Fripstock</p>
        <p className="mb-6 px-2 text-xs text-slate-600">{session.company.name}</p>

        <nav className="space-y-0.5">
          {NAVIGATION.filter(
            (e) =>
              (!e.manager || session.isManager) &&
              (!e.permission || hasPermission(session, e.permission)),
          ).map((entry) => (
            <Link
              key={entry.href}
              href={entry.href}
              className="block rounded-md px-2 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100"
            >
              {entry.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-3">
          <ShopSelector shops={session.shops} />
          <div className="ml-auto flex items-center gap-4 text-sm">
            <NotificationBell data={notifications} />
            <Link
              href="/dashboard/profile"
              className="text-slate-700 underline-offset-2 transition hover:text-slate-900 hover:underline"
            >
              {session.firstName} {session.lastName}
              {session.isManager ? (
                <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                  gérant
                </span>
              ) : null}
            </Link>
            <form action={logout}>
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
