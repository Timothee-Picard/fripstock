import { DeleteEmployeeButton, AccessForm, InviteForm } from './forms';
import { apiFetch } from '@/lib/api';
import { requireSession } from '@/lib/session';
import type { Shop, Employee } from '@/lib/types';

/**
 * Ce que l'employé peut faire, en une ligne.
 *
 * Le formulaire est replié : sans ce résumé, la liste ne dirait plus rien de
 * ses droits, et il faudrait tout déplier pour retrouver qui fait quoi.
 */
function resume(employee: Employee): string {
  const total = new Set(
    employee.accesses.flatMap((a) =>
      Object.entries(a.permissions)
        .filter(([, actif]) => actif)
        .map(([cle]) => cle),
    ),
  ).size;
  const boutiques = employee.accesses.length;

  if (total === 0) return 'Aucune permission pour l’instant.';
  return (
    `${total} permission${total > 1 ? 's' : ''} ` +
    `sur ${boutiques} boutique${boutiques > 1 ? 's' : ''}`
  );
}

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
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">
                    {employee.firstName} {employee.lastName}
                  </p>
                  <p className="text-sm text-slate-600">{employee.email}</p>
                  <p className="mt-1 text-xs text-slate-600">{resume(employee)}</p>
                </div>
                <DeleteEmployeeButton employee={employee} />
              </div>

              {/* Repliées par défaut : à cinq employés, cinq formulaires
                  dépliés font défiler la page sur des mètres pour atteindre le
                  dernier. Un `<details>` natif plutôt qu'un état React — la
                  page est rendue côté serveur, et le navigateur sait le faire
                  sans une ligne de JavaScript. */}
              <details className="group mt-3 border-t border-slate-100 pt-3">
                <summary className="cursor-pointer list-none text-sm font-medium text-slate-700 hover:text-slate-900">
                  <span className="group-open:hidden">Afficher les permissions</span>
                  <span className="hidden group-open:inline">Masquer les permissions</span>
                </summary>
                <div className="mt-3">
                  <AccessForm employee={employee} shops={shops} />
                </div>
              </details>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
