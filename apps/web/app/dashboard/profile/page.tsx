import { PasswordForm, ProfileForm } from './forms';
import { requireSession } from '@/lib/session';

export default async function PageProfil() {
  const session = await requireSession();

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
    </div>
  );
}
