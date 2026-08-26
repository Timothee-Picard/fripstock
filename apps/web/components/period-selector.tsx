'use client';

import { useRouter, useSearchParams } from 'next/navigation';

const SHORTCUTS = [
  { days: 7, label: '7 jours' },
  { days: 30, label: '30 jours' },
  { days: 90, label: '3 mois' },
  { days: 365, label: '1 an' },
] as const;

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Période du tableau de bord — dans l'URL, donc partageable et rechargeable. */
export function PeriodSelector() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get('from') ?? '';

  function apply(fromValue: string) {
    const next = new URLSearchParams(params.toString());
    if (fromValue) next.set('from', fromValue);
    else next.delete('from');
    router.push(`/dashboard?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {SHORTCUTS.map((r) => {
        const target = daysAgo(r.days);
        const active = from === target || (from === '' && r.days === 30);
        return (
          <button
            key={r.days}
            type="button"
            onClick={() => apply(target)}
            className={
              active
                ? 'rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white'
                : 'rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50'
            }
          >
            {r.label}
          </button>
        );
      })}
      <label className="flex items-center gap-1.5 text-sm text-slate-700">
        <span>Depuis le</span>
        <input
          type="date"
          value={from || daysAgo(30)}
          onChange={(e) => apply(e.target.value)}
          className="rounded-md border border-slate-400 bg-white px-2 py-1 text-sm text-slate-900"
        />
      </label>
    </div>
  );
}
