import { FormulaireMotDePasse, FormulaireProfil } from './formulaires';
import { exigerSession } from '@/lib/session';

export default async function PageProfil() {
  const session = await exigerSession();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Mon profil</h1>
        <p className="mt-1 text-sm text-slate-600">
          {session.estGerant
            ? `Gérant de ${session.entreprise.nom}.`
            : `Employé chez ${session.entreprise.nom}.`}
        </p>
      </div>

      <FormulaireProfil session={session} />
      <FormulaireMotDePasse />
    </div>
  );
}
