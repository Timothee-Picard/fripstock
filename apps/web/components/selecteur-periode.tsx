'use client';

import { useRouter, useSearchParams } from 'next/navigation';

const RACCOURCIS = [
  { jours: 7, libelle: '7 jours' },
  { jours: 30, libelle: '30 jours' },
  { jours: 90, libelle: '3 mois' },
  { jours: 365, libelle: '1 an' },
] as const;

function ilYA(jours: number): string {
  const d = new Date();
  d.setDate(d.getDate() - jours);
  return d.toISOString().slice(0, 10);
}

/** Période du tableau de bord — dans l'URL, donc partageable et rechargeable. */
export function SelecteurPeriode() {
  const router = useRouter();
  const params = useSearchParams();
  const du = params.get('du') ?? '';

  function appliquer(valeurDu: string) {
    const suivants = new URLSearchParams(params.toString());
    if (valeurDu) suivants.set('du', valeurDu);
    else suivants.delete('du');
    router.push(`/dashboard?${suivants.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {RACCOURCIS.map((r) => {
        const cible = ilYA(r.jours);
        const actif = du === cible || (du === '' && r.jours === 30);
        return (
          <button
            key={r.jours}
            type="button"
            onClick={() => appliquer(cible)}
            className={
              actif
                ? 'rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white'
                : 'rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50'
            }
          >
            {r.libelle}
          </button>
        );
      })}
      <label className="flex items-center gap-1.5 text-sm text-slate-700">
        <span>Depuis le</span>
        <input
          type="date"
          value={du || ilYA(30)}
          onChange={(e) => appliquer(e.target.value)}
          className="rounded-md border border-slate-400 bg-white px-2 py-1 text-sm text-slate-900"
        />
      </label>
    </div>
  );
}
