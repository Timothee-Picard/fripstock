'use client';

import type { RefObject } from 'react';

/**
 * Raccourci de connexion pour les comptes créés par `make seed`.
 *
 * Le composant ne fait que remplir le formulaire et le soumettre : aucune route
 * ni action serveur supplémentaire, donc aucune surface d'attaque en plus. Les
 * identifiants ci-dessous sont ceux du seed, déjà publics dans le dépôt.
 *
 * L'appel est enveloppé dans un test sur NODE_ENV côté appelant : en build de
 * production, le bloc entier est éliminé du bundle.
 */
const COMPTES = [
  { role: 'gérant', email: 'gerant@fripstock.test', detail: 'tous les droits' },
  { role: 'employé', email: 'employe@fripstock.test', detail: '2 permissions' },
] as const;

const DEMO_PASSWORD = 'fripstock';

export function DemoLogin({ formRef }: { formRef: RefObject<HTMLFormElement | null> }) {
  function fillAndSubmit(email: string) {
    const form = formRef.current;
    if (!form) return;
    const emailField = form.elements.namedItem('email') as HTMLInputElement | null;
    const passwordField = form.elements.namedItem('password') as HTMLInputElement | null;
    if (!emailField || !passwordField) return;
    emailField.value = email;
    passwordField.value = DEMO_PASSWORD;
    form.requestSubmit();
  }

  return (
    <div className="border-t border-dashed border-slate-200 pt-4">
      <p className="mb-2 text-center text-xs uppercase tracking-wide text-slate-500">
        Comptes de démonstration — développement uniquement
      </p>
      <div className="grid grid-cols-2 gap-2">
        {COMPTES.map((compte) => (
          <button
            key={compte.email}
            type="button"
            onClick={() => fillAndSubmit(compte.email)}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
          >
            <span className="block font-medium">{compte.role}</span>
            <span className="block text-xs text-slate-500">{compte.detail}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-center text-xs text-slate-500">
        Créés par <code className="font-mono">make seed</code>
      </p>
    </div>
  );
}
