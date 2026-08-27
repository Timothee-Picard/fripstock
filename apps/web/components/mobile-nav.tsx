'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { logout } from '@/app/(auth)/actions';
import { CloseIcon, LogoutIcon, MenuIcon, NAV_ICONS } from '@/components/icons';
import type { NavEntry } from '@/lib/navigation';
import type { Session } from '@/lib/types';

/**
 * Navigation sur petit écran.
 *
 * Le menu latéral est masqué sous 640 px, faute de place : sans ce panneau, il
 * n'y avait aucun moyen de changer d'écran depuis un téléphone — l'application
 * s'ouvrait sur le tableau de bord et y restait.
 *
 * Le panneau est en `fixed` : ce composant vit dans l'en-tête, mais s'affiche
 * par-dessus toute la page, sans que l'état ait à remonter d'un cran.
 */
export function MobileNav({ session, entries }: { session: Session; entries: NavEntry[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ouvrir le menu"
        aria-expanded={open}
        className="rounded p-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
      >
        <MenuIcon />
      </button>

      {open ? (
        <>
          {/* Le voile ferme au toucher à côté : sur un téléphone, viser la
              croix n'est pas toujours commode. */}
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default bg-slate-900/40"
          />
          <nav
            aria-label="Navigation principale"
            className="fixed inset-y-0 left-0 z-50 flex w-64 max-w-[85vw] flex-col border-r border-slate-200 bg-white"
          >
            <div className="flex items-center justify-between px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold tracking-tight text-slate-900">
                  Fripstock
                </p>
                <p className="truncate text-xs text-slate-600">{session.company.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer le menu"
                className="rounded p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
              {entries.map((entry) => {
                const Icone = NAV_ICONS[entry.icon];
                const actif =
                  entry.href === '/dashboard'
                    ? pathname === entry.href
                    : pathname.startsWith(entry.href);
                return (
                  <Link
                    key={entry.href}
                    href={entry.href}
                    // Le panneau recouvre la page : le laisser ouvert après un
                    // choix masquerait l'écran qu'on vient de demander.
                    onClick={() => setOpen(false)}
                    aria-current={actif ? 'page' : undefined}
                    className={`flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition ${
                      actif ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Icone />
                    <span className="truncate">{entry.label}</span>
                  </Link>
                );
              })}
            </div>

            <div className="border-t border-slate-100 p-2">
              <Link
                href="/dashboard/profile"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 transition hover:bg-slate-100"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-medium text-white">
                  {`${session.firstName.charAt(0)}${session.lastName.charAt(0)}`.toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm text-slate-900">
                    {session.firstName} {session.lastName}
                  </span>
                  <span className="block text-xs text-slate-600">
                    {session.isManager ? 'Gérant' : 'Employé'}
                  </span>
                </span>
              </Link>
              <form action={logout}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  <LogoutIcon />
                  <span>Déconnexion</span>
                </button>
              </form>
            </div>
          </nav>
        </>
      ) : null}
    </div>
  );
}
