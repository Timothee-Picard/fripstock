'use client';

import { useActionState, useState } from 'react';
import { changerMotDePasse, modifierProfil, type EtatProfil } from './actions';
import { Alerte, Bouton, Champ } from '@/components/champ';
import type { Session } from '@/lib/types';

const ETAT_INITIAL: EtatProfil = {};

export function FormulaireProfil({ session }: { session: Session }) {
  const [etat, action, enCours] = useActionState(modifierProfil, ETAT_INITIAL);
  const [email, setEmail] = useState(session.email);

  const emailChange = email.trim().toLowerCase() !== session.email.toLowerCase();

  return (
    <form action={action} className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-medium text-slate-900">Identité</h2>

      {etat.erreur ? <Alerte>{etat.erreur}</Alerte> : null}
      {etat.succes ? <Alerte ton="info">{etat.succes}</Alerte> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Champ label="Prénom" name="prenom" defaultValue={session.prenom} required />
        <Champ label="Nom" name="nom" defaultValue={session.nom} required />
      </div>

      <Champ
        label="Email"
        name="email"
        type="email"
        defaultValue={session.email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
        aide="C'est aussi votre identifiant de connexion."
      />

      {/* Le champ n'apparaît que si l'email change réellement : c'est la seule
          situation où l'API l'exige, inutile de le demander pour un renommage. */}
      {emailChange ? (
        <Champ
          label="Mot de passe actuel"
          name="motDePasseActuel"
          type="password"
          required
          autoComplete="current-password"
          aide="Requis pour changer votre adresse de connexion."
        />
      ) : null}

      <Bouton type="submit" disabled={enCours}>
        {enCours ? 'Enregistrement…' : 'Enregistrer'}
      </Bouton>
    </form>
  );
}

export function FormulaireMotDePasse() {
  const [etat, action, enCours] = useActionState(changerMotDePasse, ETAT_INITIAL);

  return (
    <form action={action} className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-medium text-slate-900">Mot de passe</h2>

      {etat.erreur ? <Alerte>{etat.erreur}</Alerte> : null}
      {etat.succes ? <Alerte ton="info">{etat.succes}</Alerte> : null}

      <Champ
        label="Mot de passe actuel"
        name="motDePasseActuel"
        type="password"
        required
        autoComplete="current-password"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Champ
          label="Nouveau mot de passe"
          name="nouveauMotDePasse"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          aide="8 caractères minimum"
        />
        <Champ
          label="Confirmation"
          name="confirmation"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>

      <Bouton type="submit" disabled={enCours}>
        {enCours ? 'Modification…' : 'Changer le mot de passe'}
      </Bouton>
    </form>
  );
}
