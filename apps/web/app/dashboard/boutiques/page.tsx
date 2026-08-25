import { BoutonSupprimer, FormulaireBoutique } from './formulaire';
import { appelApi } from '@/lib/api';
import { exigerSession } from '@/lib/session';
import type { Boutique } from '@/lib/types';

export default async function PageBoutiques() {
  const session = await exigerSession();
  const boutiques = await appelApi<Boutique[]>('/boutiques');

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Boutiques</h1>
        <p className="mt-1 text-sm text-slate-600">
          {session.estGerant
            ? 'Les points de vente de votre entreprise. Créer ou supprimer une boutique est réservé au gérant.'
            : 'Les boutiques auxquelles vous avez accès.'}
        </p>
      </div>

      {/* Le bouton est masqué pour un employé, mais c'est l'API qui décide :
          elle renvoie 403 même si quelqu'un force la requête. */}
      {session.estGerant ? <FormulaireBoutique /> : null}

      {boutiques.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">
          Aucune boutique pour l&apos;instant.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-2 font-medium">Nom</th>
                <th className="px-4 py-2 font-medium">Adresse</th>
                {session.estGerant ? <th className="px-4 py-2" /> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {boutiques.map((b) => (
                <tr key={b.id}>
                  <td className="px-4 py-2 font-medium text-slate-800">{b.nom}</td>
                  <td className="px-4 py-2 text-slate-600">{b.adresse ?? '—'}</td>
                  {session.estGerant ? (
                    <td className="px-4 py-2 text-right">
                      <BoutonSupprimer id={b.id} nom={b.nom} />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
