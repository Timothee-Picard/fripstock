import { DangerZone } from './danger-zone';
import { PasswordForm, ProfileForm } from './forms';
import { apiFetch } from '@/lib/api';
import { requireSession } from '@/lib/session';
import type { AccountSummary } from '@/lib/types';

export default async function PageProfil() {
  const session = await requireSession();

  // Le récapitulatif n'existe que pour le gérant : la route est réservée, et
  // l'appeler pour un employé rendrait un 403 qui casserait la page.
  const summary = session.isManager ? await apiFetch<AccountSummary>('/auth/account') : null;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <p className="mt-1 text-sm text-slate-600">
          {session.isManager
            ? `Gérant de ${session.company.name}.`
            : `Employé chez ${session.company.name}.`}
        </p>
      </div>

      <ProfileForm session={session} />
      <PasswordForm />

      {summary ? (
        <DangerZone summary={summary} />
      ) : (
        // Écrit plutôt que masqué : un bouton absent passe pour une panne, et
        // l'employé doit savoir à qui s'adresser.
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-medium text-slate-900">Supprimer le compte</h2>
          <p className="mt-1 text-sm text-slate-600">
            Votre compte est géré par le gérant de {session.company.name} : c’est à lui qu’il faut
            demander sa suppression.
          </p>
        </section>
      )}
    </div>
  );
}
