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

const MOT_DE_PASSE = 'fripstock';

export function ConnexionDemo({ formulaire }: { formulaire: RefObject<HTMLFormElement | null> }) {
  function remplirEtSoumettre(email: string) {
    const form = formulaire.current;
    if (!form) return;
    const champEmail = form.elements.namedItem('email') as HTMLInputElement | null;
    const champMotDePasse = form.elements.namedItem('motDePasse') as HTMLInputElement | null;
    if (!champEmail || !champMotDePasse) return;
    champEmail.value = email;
    champMotDePasse.value = MOT_DE_PASSE;
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
            onClick={() => remplirEtSoumettre(compte.email)}
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
