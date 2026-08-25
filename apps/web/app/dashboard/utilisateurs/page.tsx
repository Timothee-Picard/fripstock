import { BoutonSupprimerEmploye, FormulaireAcces, FormulaireInvitation } from './formulaires';
import { appelApi } from '@/lib/api';
import { exigerSession } from '@/lib/session';
import type { Boutique, Employe } from '@/lib/types';

export default async function PageUtilisateurs() {
  const session = await exigerSession();

  // La page entière est réservée au gérant : l'API renvoie 403 aux employés,
  // et le lien est déjà masqué dans la barre latérale.
  if (!session.estGerant) {
    return (
      <p className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
        La gestion des utilisateurs est réservée au gérant de l&apos;entreprise.
      </p>
    );
  }

  const [employes, boutiques] = await Promise.all([
    appelApi<Employe[]>('/users'),
    appelApi<Boutique[]>('/boutiques'),
  ]);

  const equipe = employes.filter((e) => !e.estGerant);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Utilisateurs</h1>
        <p className="mt-1 text-sm text-slate-600">
          Chaque employé a accès aux boutiques que vous cochez, avec les permissions que vous lui
          donnez sur chacune.
        </p>
      </div>

      <FormulaireInvitation />

      {equipe.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">
          Aucun employé pour l&apos;instant.
        </p>
      ) : (
        <div className="space-y-4">
          {equipe.map((employe) => (
            <section key={employe.id} className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">
                    {employe.prenom} {employe.nom}
                  </p>
                  <p className="text-sm text-slate-600">{employe.email}</p>
                </div>
                <BoutonSupprimerEmploye employe={employe} />
              </div>
              <FormulaireAcces employe={employe} boutiques={boutiques} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
