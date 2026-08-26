'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { register, type FormState } from '../actions';
import { Alert, Button, Field } from '@/components/field';

const INITIAL_STATE: FormState = {};

export default function PageInscription() {
  const [state, action, pending] = useActionState(register, INITIAL_STATE);

  return (
    <form action={action} className="space-y-4">
      <h2 className="text-lg font-medium text-slate-900">Créer une entreprise</h2>
      <p className="text-sm text-slate-600">
        Vous en serez le gérant, avec tous les droits sur toutes ses boutiques.
      </p>

      {state.error ? <Alert>{state.error}</Alert> : null}

      <Field label="Nom de l'entreprise" name="companyName" required />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Prénom" name="firstName" required />
        <Field label="Nom" name="lastName" required />
      </div>
      <Field label="Email" name="email" type="email" required autoComplete="email" />
      <Field
        label="Mot de passe"
        name="password"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        hint="8 caractères minimum"
      />

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Création…' : "Créer l'entreprise"}
      </Button>

      <p className="text-center text-sm text-slate-600">
        Déjà un compte ?{' '}
        <Link href="/login" className="font-medium text-slate-900 underline">
          Se connecter
        </Link>
      </p>
    </form>
  );
}
