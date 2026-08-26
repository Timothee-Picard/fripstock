import { FormulaireCreation, LigneStatut } from './formulaires';
import { BadgeStatut } from '@/components/badge-statut';
import { appelApi } from '@/lib/api';
import { exigerSession } from '@/lib/session';
import type { Statut } from '@/lib/types';

export default async function PageStatuts() {
  const session = await exigerSession();
  const statuts = await appelApi<Statut[]>('/statuts');

  // Personnaliser les statuts est un acte de gérant (voir CLAUDE.md) : l'API
  // renvoie 403 aux employés, l'écran leur montre la liste en lecture seule.
  if (!session.estGerant) {
    return (
      <div className="max-w-3xl space-y-6">
        <h1 className="text-xl font-semibold text-slate-900">Statuts</h1>
        <p className="text-sm text-slate-600">
          Les statuts sont définis par le gérant de l&apos;entreprise.
        </p>
        <ul className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-5">
          {statuts.map((s) => (
            <li key={s.id}>
              <BadgeStatut statut={s} />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Statuts</h1>
        <p className="mt-1 text-sm text-slate-600">
          Le cycle de vie de vos produits. Vous choisissez librement les libellés et les
          couleurs&nbsp;: c&apos;est le comportement coché à la création, et non le nom, qui décide
          de ce que l&apos;application autorise.
        </p>
      </div>

      <FormulaireCreation />

      <div className="rounded-lg border border-slate-200 bg-white px-5">
        <ul>
          {statuts.map((s, i) => (
            <LigneStatut
              key={s.id}
              statut={s}
              premier={i === 0}
              dernier={i === statuts.length - 1}
            />
          ))}
        </ul>
      </div>

      <p className="text-xs text-slate-600">
        Le statut « par défaut » est celui attribué automatiquement à un produit à sa création. Un
        statut porté par un produit — ou présent dans un historique — ne peut plus être supprimé.
      </p>
    </div>
  );
}
