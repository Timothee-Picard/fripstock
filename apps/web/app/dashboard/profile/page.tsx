import { PasswordForm, ProfileForm } from './forms';
import { requireSession } from '@/lib/session';

export default async function PageProfil() {
  const session = await requireSession();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Mon profil</h1>
        <p className="mt-1 text-sm text-slate-600">
          {session.isManager
            ? `Gérant de ${session.company.name}.`
            : `Employé chez ${session.company.name}.`}
        </p>
      </div>

      <ProfileForm session={session} />
      <PasswordForm />
    </div>
  );
}
