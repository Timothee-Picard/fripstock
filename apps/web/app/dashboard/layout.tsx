import { MobileNav } from '@/components/mobile-nav';
import { NotificationBell } from '@/components/notification-bell';
import { PageTitle } from '@/components/page-title';
import { Sidebar } from '@/components/sidebar';
import { ShopSelector } from '@/components/shop-selector';
import { apiFetch } from '@/lib/api';
import { hasPermission } from '@/lib/permissions';
import { NAVIGATION, SIDEBAR_COOKIE } from '@/lib/navigation';
import { requireSession } from '@/lib/session';
import { cookies } from 'next/headers';
import type { Notifications } from '@/lib/types';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const notifications = await apiFetch<Notifications>('/notifications');

  // Le menu replié est lu ici et non côté client : passé en prop, il évite au
  // menu de s'afficher déplié une fraction de seconde avant de se replier.
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === '1';

  // Le filtrage reste au serveur : la liste envoyée au client ne contient que
  // ce à quoi l'utilisateur a droit, plutôt que tout, masqué à l'affichage.
  const entries = NAVIGATION.filter(
    (e) =>
      (!e.manager || session.isManager) && (!e.permission || hasPermission(session, e.permission)),
  );

  return (
    <div className="flex min-h-full flex-1 bg-slate-50">
      <Sidebar session={session} entries={entries} initialCollapsed={collapsed} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          {/* Le déclencheur du menu mobile en premier : c'est le seul moyen de
              naviguer sous 640 px, où la colonne de gauche est masquée. */}
          <MobileNav session={session} entries={entries} />
          <PageTitle />
          <div className="ml-auto flex items-center gap-3">
            <ShopSelector shops={session.shops} />
            <NotificationBell data={notifications} />
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
