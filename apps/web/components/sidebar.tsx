'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { logout } from '@/app/(auth)/actions';
import {
  AttributesIcon,
  CategoriesIcon,
  CollapseIcon,
  ContractIcon,
  DashboardIcon,
  DepositorIcon,
  LogoutIcon,
  ProductsIcon,
  ShopIcon,
  StatusesIcon,
  UsersIcon,
} from '@/components/icons';
import { SIDEBAR_COOKIE, type NavEntry, type NavIcon } from '@/lib/navigation';
import type { Session } from '@/lib/types';

/** La clé d'icône portée par l'entrée, résolue en composant côté client. */
const ICONES: Record<NavIcon, () => React.ReactElement> = {
  dashboard: DashboardIcon,
  products: ProductsIcon,
  categories: CategoriesIcon,
  attributes: AttributesIcon,
  statuses: StatusesIcon,
  depositors: DepositorIcon,
  contracts: ContractIcon,
  shops: ShopIcon,
  users: UsersIcon,
};

/** Un an : le choix de replier le menu n'a pas de raison d'expirer. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Menu latéral, repliable.
 *
 * Il porte l'identité et la déconnexion, en bas : cliquer sur son nom mène au
 * profil, ce qui rendait l'entrée « Mon profil » du menu inutile. Les alertes,
 * elles, restent dans l'en-tête — elles concernent la page, pas la navigation.
 *
 * L'état replié vit dans un cookie et non dans `localStorage` : le serveur le
 * lit au rendu, donc le menu ne s'affiche jamais déplié une fraction de
 * seconde avant de se replier.
 */
export function Sidebar({
  session,
  entries,
  initialCollapsed,
}: {
  session: Session;
  /** Déjà filtrées par les permissions, côté serveur. */
  entries: NavEntry[];
  initialCollapsed: boolean;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const pathname = usePathname();

  function basculer() {
    const suivant = !collapsed;
    setCollapsed(suivant);
    document.cookie = `${SIDEBAR_COOKIE}=${suivant ? '1' : '0'}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
  }

  return (
    // `sticky` plutôt que `fixed` : le menu reste visible quand la page défile,
    // mais garde sa place dans la rangée — le contenu n'a donc pas à
    // compenser sa largeur par une marge qui devrait suivre le repli.
    <aside
      className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-slate-200 bg-white sm:flex ${
        collapsed ? 'w-16' : 'w-56'
      }`}
    >
      <div
        className={`flex items-center gap-2 px-3 py-3 ${collapsed ? 'justify-center' : 'justify-between'}`}
      >
        {collapsed ? null : (
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold tracking-tight text-slate-900">
              Fripstock
            </p>
            <p className="truncate text-xs text-slate-600">{session.company.name}</p>
          </div>
        )}
        <button
          type="button"
          onClick={basculer}
          aria-label={collapsed ? 'Déplier le menu' : 'Replier le menu'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Déplier le menu' : 'Replier le menu'}
          className="shrink-0 rounded p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
        >
          <CollapseIcon collapsed={collapsed} />
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {entries.map((entry) => {
          const Icone = ICONES[entry.icon];
          // `/dashboard` est le préfixe de tout : sans l'égalité stricte, le
          // tableau de bord resterait actif sur chacun des autres écrans.
          const actif =
            entry.href === '/dashboard' ? pathname === entry.href : pathname.startsWith(entry.href);
          return (
            <Link
              key={entry.href}
              href={entry.href}
              title={entry.label}
              aria-current={actif ? 'page' : undefined}
              className={`flex items-center gap-2.5 rounded-md py-1.5 text-sm transition ${
                collapsed ? 'justify-center px-0' : 'px-2'
              } ${
                actif
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icone />
              {collapsed ? null : <span className="truncate">{entry.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* En bas, et non en tête : le menu se lit de haut en bas, et ce qui
          relève de la personne connectée n'a pas à passer avant les sections.
          `mt-auto` le colle au bas même quand la liste est courte. */}
      <div className="mt-auto border-t border-slate-100 p-2">
        <Link
          href="/dashboard/profile"
          title={`${session.firstName} ${session.lastName} — mon profil`}
          className={`flex items-center gap-2 rounded-md py-1.5 transition hover:bg-slate-100 ${
            collapsed ? 'justify-center px-0' : 'px-2'
          }`}
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-medium text-white">
            {initiales(session)}
          </span>
          {collapsed ? null : (
            <span className="min-w-0">
              <span className="block truncate text-sm text-slate-900">
                {session.firstName} {session.lastName}
              </span>
              <span className="block text-xs text-slate-600">
                {session.isManager ? 'Gérant' : 'Employé'}
              </span>
            </span>
          )}
        </Link>

        <form action={logout}>
          <button
            type="submit"
            title="Déconnexion"
            aria-label="Déconnexion"
            className={`flex w-full items-center gap-2.5 rounded-md py-1.5 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 ${
              collapsed ? 'justify-center px-0' : 'px-2'
            }`}
          >
            <LogoutIcon />
            {collapsed ? null : <span>Déconnexion</span>}
          </button>
        </form>
      </div>
    </aside>
  );
}

/** Initiales, pour la pastille qui tient encore quand le menu est replié. */
function initiales(session: Session): string {
  return `${session.firstName.charAt(0)}${session.lastName.charAt(0)}`.toUpperCase();
}
