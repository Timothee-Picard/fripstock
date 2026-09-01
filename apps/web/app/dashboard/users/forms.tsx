'use client';

import { useActionState } from 'react';
import { saveAccess, inviteEmployee, deleteEmployee, type UserState } from './actions';
import { Alert, Button, Field } from '@/components/field';
import {
  COMPANY_PERMISSIONS,
  PERMISSION_HINTS,
  PERMISSION_LABELS,
  SHOP_PERMISSIONS,
  type Permission,
  type Shop,
  type Employee,
} from '@/lib/types';

const INITIAL_STATE: UserState = {};

export function InviteForm() {
  const [state, action, pending] = useActionState(inviteEmployee, INITIAL_STATE);

  return (
    <form action={action} className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-medium text-slate-900">Inviter un employé</h2>
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.success ? (
        <Alert tone="info">
          {state.success}
          {state.temporaryPassword ? (
            <>
              {' '}
              Mot de passe temporaire :{' '}
              <code className="rounded bg-white px-1 py-0.5 font-mono">
                {state.temporaryPassword}
              </code>{' '}
              — il ne sera plus affiché, transmettez-le maintenant.
            </>
          ) : null}
        </Alert>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Prénom" name="firstName" required />
        <Field label="Nom" name="lastName" required />
        <Field label="Email" name="email" type="email" required />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? 'Invitation…' : 'Inviter'}
      </Button>
    </form>
  );
}

/** Une case à cocher de permission, avec son libellé et ce qu'elle ouvre. */
function Case({
  name,
  permission,
  checked,
}: {
  name: string;
  permission: Permission;
  checked: boolean;
}) {
  return (
    <label className="flex gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        name={name}
        defaultChecked={checked}
        className="mt-0.5 size-4 shrink-0 rounded border-slate-400 text-slate-900 accent-slate-900"
      />
      <span>
        {PERMISSION_LABELS[permission]}
        <span className="mt-0.5 block text-xs text-slate-500">{PERMISSION_HINTS[permission]}</span>
      </span>
    </label>
  );
}

export function AccessForm({ employee, shops }: { employee: Employee; shops: Shop[] }) {
  const [state, action, pending] = useActionState(saveAccess, INITIAL_STATE);

  const actuelles = new Map(
    employee.accesses.map((a) => [
      a.shopId,
      new Set(
        Object.entries(a.permissions)
          .filter(([, v]) => v)
          .map(([k]) => k),
      ),
    ]),
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="userId" value={employee.id} />

      {shops.length === 0 ? (
        <p className="text-sm text-slate-600">
          Créez d&apos;abord une boutique pour pouvoir attribuer des permissions.
        </p>
      ) : (
        <>
          {/* Une seule fois, hors des boutiques : le catalogue, les déposants
              et le site sont uniques pour l'entreprise. Les répéter dans chaque
              boutique laissait croire qu'on pouvait les y limiter. */}
          <fieldset className="rounded-md border border-slate-300 bg-slate-50 p-3">
            <legend className="px-1 text-sm font-medium text-slate-800">
              Toute l&apos;entreprise
            </legend>
            <p className="mb-2 text-xs text-slate-600">
              Le catalogue, les clients déposants et la boutique en ligne sont communs à toutes les
              boutiques. Ces droits valent donc partout, quelle que soit la boutique où
              l&apos;employé travaille.
            </p>
            <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {COMPANY_PERMISSIONS.map((permission) => (
                <Case
                  key={permission}
                  name={`company:${permission}`}
                  permission={permission}
                  // Détenue quelque part, elle vaut partout : c'est aussi comme
                  // ça qu'on la relit.
                  checked={[...actuelles.values()].some((set) => set.has(permission))}
                />
              ))}
            </div>
          </fieldset>
        </>
      )}

      {shops.length === 0
        ? null
        : shops.map((shop) => {
            const checked = actuelles.get(shop.id) ?? new Set<string>();
            return (
              <fieldset key={shop.id} className="rounded-md border border-slate-200 p-3">
                <legend className="px-1 text-sm font-medium text-slate-800">{shop.name}</legend>
                <input type="hidden" name="shopId" value={shop.id} />
                <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {SHOP_PERMISSIONS.map((permission) => (
                    <Case
                      key={permission}
                      name={`perm:${shop.id}:${permission}`}
                      permission={permission}
                      checked={checked.has(permission)}
                    />
                  ))}
                </div>
              </fieldset>
            );
          })}

      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.success ? <Alert tone="info">{state.success}</Alert> : null}

      {shops.length > 0 ? (
        <Button type="submit" disabled={pending}>
          {pending ? 'Enregistrement…' : 'Enregistrer les permissions'}
        </Button>
      ) : null}
    </form>
  );
}

export function DeleteEmployeeButton({ employee }: { employee: Employee }) {
  const [state, action, pending] = useActionState(deleteEmployee, INITIAL_STATE);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Supprimer ${employee.firstName} ${employee.lastName} ?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="userId" value={employee.id} />
      <Button type="submit" variant="danger" disabled={pending}>
        {pending ? '…' : 'Supprimer'}
      </Button>
      {state.error ? <p className="mt-1 text-xs text-red-700">{state.error}</p> : null}
    </form>
  );
}
