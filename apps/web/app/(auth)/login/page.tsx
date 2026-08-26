'use client';

import Link from 'next/link';
import { useActionState, useRef } from 'react';
import { login, type FormState } from '../actions';
import { Alert, Button, Field } from '@/components/field';
import { DemoLogin } from '@/components/demo-login';

const INITIAL_STATE: FormState = {};

export default function PageConnexion() {
  const [state, action, pending] = useActionState(login, INITIAL_STATE);
  const form = useRef<HTMLFormElement>(null);

  return (
    <div className="space-y-5">
      <form ref={form} action={action} className="space-y-4">
        <h2 className="text-lg font-medium text-slate-900">Connexion</h2>

        {state.error ? <Alert>{state.error}</Alert> : null}

        <Field label="Email" name="email" type="email" required autoComplete="email" />
        <Field
          label="Mot de passe"
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? 'Connexion…' : 'Se connecter'}
        </Button>

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
      {process.env.NODE_ENV !== 'production' ? <DemoLogin formRef={form} /> : null}
    </div>
  );
}
