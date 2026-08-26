'use client';

import { useActionState, useState } from 'react';
import { changePassword, updateProfile, type ProfileState } from './actions';
import { Alert, Button, Field } from '@/components/field';
import type { Session } from '@/lib/types';

const INITIAL_STATE: ProfileState = {};

export function ProfileForm({ session }: { session: Session }) {
  const [state, action, pending] = useActionState(updateProfile, INITIAL_STATE);
  const [email, setEmail] = useState(session.email);

  const emailChange = email.trim().toLowerCase() !== session.email.toLowerCase();

  return (
    <form action={action} className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-medium text-slate-900">Identité</h2>

      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.success ? <Alert tone="info">{state.success}</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Prénom" name="firstName" defaultValue={session.firstName} required />
        <Field label="Nom" name="lastName" defaultValue={session.lastName} required />
      </div>

      <Field
        label="Email"
        name="email"
        type="email"
        defaultValue={session.email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
        hint="C'est aussi votre identifiant de connexion."
      />

      {/* Le champ n'apparaît que si l'email change réellement : c'est la seule
          situation où l'API l'exige, inutile de le demander pour un renommage. */}
      {emailChange ? (
        <Field
          label="Mot de passe actuel"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          hint="Requis pour changer votre adresse de connexion."
        />
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, INITIAL_STATE);

  return (
    <form action={action} className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-medium text-slate-900">Mot de passe</h2>

      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.success ? <Alert tone="info">{state.success}</Alert> : null}

      <Field
        label="Mot de passe actuel"
        name="currentPassword"
        type="password"
        required
        autoComplete="current-password"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Nouveau mot de passe"
          name="newPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          hint="8 caractères minimum"
        />
        <Field
          label="Confirmation"
          name="confirmation"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Modification…' : 'Changer le mot de passe'}
      </Button>
    </form>
  );
}
