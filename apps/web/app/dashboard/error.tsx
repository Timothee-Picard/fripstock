'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/**
 * Filet de sécurité du tableau de bord.
 *
 * Sans lui, la moindre erreur d'un appel API — un refus, une coupure — produit
 * un écran technique illisible. Les cas prévus sont traités dans les pages ;
 * celui-ci rattrape le reste sans perdre la navigation.
 */
export default function ErrorMessage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">
        Cet écran n&apos;a pas pu s&apos;afficher
      </h1>
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-700">
          {error.message || 'Une erreur inattendue est survenue.'}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            Réessayer
          </button>
          <Link href="/dashboard" className="text-sm text-slate-600 underline">
            Retour au tableau de bord
          </Link>
        </div>
      </div>
    </div>
  );
}
