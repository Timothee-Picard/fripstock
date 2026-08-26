import { DeleteEmployeeButton, AccessForm, InviteForm } from './forms';
import { apiFetch } from '@/lib/api';
import { requireSession } from '@/lib/session';
import type { Shop, Employee } from '@/lib/types';

export default async function UsersPage() {
  const session = await requireSession();

  // La page entière est réservée au gérant : l'API renvoie 403 aux employés,
  // et le lien est déjà masqué dans la barre latérale.
  if (!session.isManager) {
    return (
      <p className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
        La gestion des utilisateurs est réservée au gérant de l&apos;entreprise.
      </p>
    );
  }

  const [employees, shops] = await Promise.all([
    apiFetch<Employee[]>('/users'),
    apiFetch<Shop[]>('/shops'),
  ]);

  const team = employees.filter((e) => !e.isManager);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Utilisateurs</h1>
        <p className="mt-1 text-sm text-slate-600">
          Chaque employé a accès aux boutiques que vous cochez, avec les permissions que vous lui
          donnez sur chacune.
        </p>
      </div>

      <InviteForm />

      {team.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">
          Aucun employé pour l&apos;instant.
        </p>
      ) : (
        <div className="space-y-4">
          {team.map((employee) => (
            <section key={employee.id} className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">
                    {employee.firstName} {employee.lastName}
                  </p>
                  <p className="text-sm text-slate-600">{employee.email}</p>
                </div>
                <DeleteEmployeeButton employee={employee} />
              </div>
              <AccessForm employee={employee} shops={shops} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
