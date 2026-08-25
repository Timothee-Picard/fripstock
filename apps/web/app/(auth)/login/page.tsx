'use client';

import Link from 'next/link';
import { useActionState, useRef } from 'react';
import { connexion, type EtatFormulaire } from '../actions';
import { Alerte, Bouton, Champ } from '@/components/champ';
import { ConnexionDemo } from '@/components/connexion-demo';

const ETAT_INITIAL: EtatFormulaire = {};

export default function PageConnexion() {
  const [etat, action, enCours] = useActionState(connexion, ETAT_INITIAL);
  const formulaire = useRef<HTMLFormElement>(null);

  return (
    <div className="space-y-5">
      <form ref={formulaire} action={action} className="space-y-4">
        <h2 className="text-lg font-medium text-slate-900">Connexion</h2>

        {etat.erreur ? <Alerte>{etat.erreur}</Alerte> : null}

        <Champ label="Email" name="email" type="email" required autoComplete="email" />
        <Champ
          label="Mot de passe"
          name="motDePasse"
          type="password"
          required
          autoComplete="current-password"
        />

        <Bouton type="submit" disabled={enCours} className="w-full">
          {enCours ? 'Connexion…' : 'Se connecter'}
        </Bouton>

        <p className="text-center text-sm text-slate-600">
          Pas encore de compte ?{' '}
          <Link href="/register" className="font-medium text-slate-900 underline">
            Créer une entreprise
          </Link>
        </p>
      </form>

      {/* Next remplace process.env.NODE_ENV à la compilation : en build de
          production, cette condition est fausse en dur et le composant est
          éliminé du bundle. */}
      {process.env.NODE_ENV !== 'production' ? <ConnexionDemo formulaire={formulaire} /> : null}
    </div>
  );
}
