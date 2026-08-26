import { EditeurStatuts } from './editeur';
import { BadgeStatut } from '@/components/badge-statut';
import { appelApi } from '@/lib/api';
import { exigerSession } from '@/lib/session';
import type { Statut } from '@/lib/types';

export default async function PageStatuts() {
  const session = await exigerSession();
  const statuts = await appelApi<Statut[]>('/statuts');

  // Personnaliser les statuts est un acte de gérant (voir CLAUDE.md) : l'API
  // renvoie 403 aux employés, l'écran leur montre le flux en lecture seule.
  if (!session.estGerant) {
    return (
      <div className="max-w-3xl space-y-4">
        <h1 className="text-xl font-semibold text-slate-900">Statuts</h1>
        <p className="text-sm text-slate-600">
          Le cycle de vie des produits, défini par le gérant de l&apos;entreprise.
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
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Statuts</h1>
        <p className="mt-1 text-sm text-slate-600">
          Le cycle de vie de vos produits. Les flèches disent quels passages sont autorisés ; le
          comportement coché à la création — et non le nom — décide de ce que l&apos;application
          permet.
        </p>
      </div>

      <EditeurStatuts statuts={statuts} />
    </div>
  );
}
