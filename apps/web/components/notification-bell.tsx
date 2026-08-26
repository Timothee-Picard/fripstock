'use client';

import Link from 'next/link';
import { useState } from 'react';
import { markRead } from '@/app/dashboard/notifications/actions';
import type { Notifications } from '@/lib/types';

/**
 * Alertes d'échéance de contrat.
 *
 * Elles appartiennent à l'entreprise et non à un utilisateur : marquer une
 * alerte lue la masque pour tout le monde. Assumé pour le MVP, c'est noté dans
 * le README.
 */
export function NotificationBell({ data }: { data: Notifications }) {
  const [open, setOpen] = useState(false);
  const { notifications, unread } = data;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={`Notifications${unread > 0 ? ` (${unread} non lue${unread > 1 ? 's' : ''})` : ''}`}
        aria-expanded={open}
        className="relative rounded p-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
      >
        <svg
          width="1.25em"
          height="1.25em"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-medium text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          {/* Une couche transparente ferme le panneau au clic à côté, sans
              écouteur global à nettoyer. */}
          <button
            type="button"
            aria-label="Fermer"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="absolute right-0 z-20 mt-2 w-96 max-w-[calc(100vw-2rem)] rounded-lg border border-slate-200 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
              <span className="text-sm font-medium text-slate-900">Alertes</span>
              {unread > 0 ? (
                <form action={markRead}>
                  <button
                    type="submit"
                    className="text-xs text-slate-600 underline underline-offset-2 hover:text-slate-900"
                  >
                    Tout marquer comme lu
                  </button>
                </form>
              ) : null}
            </div>

            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-600">Aucune alerte.</p>
            ) : (
              <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    className={`px-4 py-3 text-sm ${n.isRead ? 'text-slate-600' : 'bg-slate-50 text-slate-900'}`}
                  >
                    <p>{n.message}</p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-slate-600">
                      <span>{new Date(n.createdAt).toLocaleDateString('fr-FR')}</span>
                      {n.depositContractId ? (
                        <Link
                          href={`/dashboard/deposit-contracts/${n.depositContractId}`}
                          onClick={() => setOpen(false)}
                          className="underline underline-offset-2"
                        >
                          Voir le contrat
                        </Link>
                      ) : null}
                      {!n.isRead ? (
                        <form action={markRead} className="inline">
                          <input type="hidden" name="id" value={n.id} />
                          <button type="submit" className="underline underline-offset-2">
                            Marquer comme lu
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
