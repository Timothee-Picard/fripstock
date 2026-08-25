'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { inscription, type EtatFormulaire } from '../actions';
import { Alerte, Bouton, Champ } from '@/components/champ';

const ETAT_INITIAL: EtatFormulaire = {};

export default function PageInscription() {
  const [etat, action, enCours] = useActionState(inscription, ETAT_INITIAL);

  return (
    <form action={action} className="space-y-4">
      <h2 className="text-lg font-medium text-slate-900">Créer une entreprise</h2>
      <p className="text-sm text-slate-500">
        Vous en serez le gérant, avec tous les droits sur toutes ses boutiques.
      </p>

      {etat.erreur ? <Alerte>{etat.erreur}</Alerte> : null}

      <Champ label="Nom de l'entreprise" name="nomEntreprise" required />
      <div className="grid grid-cols-2 gap-3">
        <Champ label="Prénom" name="prenom" required />
        <Champ label="Nom" name="nom" required />
      </div>
      <Champ label="Email" name="email" type="email" required autoComplete="email" />
      <Champ
        label="Mot de passe"
        name="motDePasse"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        aide="8 caractères minimum"
      />

      <Bouton type="submit" disabled={enCours} className="w-full">
        {enCours ? 'Création…' : "Créer l'entreprise"}
      </Bouton>

      <p className="text-center text-sm text-slate-500">
        Déjà un compte ?{' '}
        <Link href="/login" className="font-medium text-slate-900 underline">
          Se connecter
        </Link>
      </p>
    </form>
  );
}
