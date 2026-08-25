'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { connexion, type EtatFormulaire } from '../actions';
import { Alerte, Bouton, Champ } from '@/components/champ';

const ETAT_INITIAL: EtatFormulaire = {};

export default function PageConnexion() {
  const [etat, action, enCours] = useActionState(connexion, ETAT_INITIAL);

  return (
    <form action={action} className="space-y-4">
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

      <p className="text-center text-sm text-slate-500">
        Pas encore de compte ?{' '}
        <Link href="/register" className="font-medium text-slate-900 underline">
          Créer une entreprise
        </Link>
      </p>
    </form>
  );
}
