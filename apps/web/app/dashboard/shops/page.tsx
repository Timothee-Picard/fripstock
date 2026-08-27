import { ShopForm, ShopRow } from './form';
import { apiFetch } from '@/lib/api';
import { requireSession } from '@/lib/session';
import type { Shop } from '@/lib/types';

export default async function ShopsPage() {
  const session = await requireSession();
  const shops = await apiFetch<Shop[]>('/shops');

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="mt-1 text-sm text-slate-600">
          {session.isManager
            ? 'Les points de vente de votre entreprise. Créer ou supprimer une boutique est réservé au gérant.'
            : 'Les boutiques auxquelles vous avez accès.'}
        </p>
      </div>

      {/* Le bouton est masqué pour un employé, mais c'est l'API qui décide :
          elle renvoie 403 même si quelqu'un force la requête. */}
      {session.isManager ? <ShopForm /> : null}

      {shops.length === 0 ? (
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
                {session.isManager ? <th className="px-4 py-2" /> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shops.map((b) =>
                session.isManager ? (
                  <ShopRow key={b.id} shop={b} />
                ) : (
                  <tr key={b.id}>
                    <td className="px-4 py-2 font-medium text-slate-800">{b.name}</td>
                    <td className="px-4 py-2 text-slate-600">{b.address ?? '—'}</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
