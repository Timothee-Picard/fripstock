import Link from 'next/link';

/**
 * Écran affiché quand l'API refuse l'accès.
 *
 * Une page en erreur pour un simple manque de droits est illisible : on
 * explique ce qui manque et on renvoie vers ce qui reste accessible.
 */
export function AccessDenied({ what, permission }: { what: string; permission: string }) {
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">{what}</h1>
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-700">
          Vous n&apos;avez pas la permission <code className="font-mono text-xs">{permission}</code>{' '}
          nécessaire pour consulter cet écran.
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Demandez-la au gérant de votre entreprise, ou revenez au{' '}
          <Link href="/dashboard" className="underline underline-offset-2">
            tableau de bord
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
