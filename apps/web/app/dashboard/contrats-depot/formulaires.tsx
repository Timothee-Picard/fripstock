'use client';

import { useActionState, useState } from 'react';
import { creerContrat, lancerEcheances, type EtatContrat } from './actions';
import { Alerte, Bouton, Champ } from '@/components/champ';
import type { ClientDeposant } from '@/lib/types';

const ETAT_INITIAL: EtatContrat = {};

const CHAMP = 'w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-sm text-slate-900';

function dansNJours(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function FormulaireCreation({ clients }: { clients: ClientDeposant[] }) {
  const [etat, action, enCours] = useActionState(creerContrat, ETAT_INITIAL);
  const [clientId, setClientId] = useState('');

  const client = clients.find((c) => c.id === clientId);

  if (clients.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600">
        Créez d&apos;abord un déposant pour pouvoir établir un contrat.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-medium text-slate-900">Nouveau contrat</h2>
      {etat.erreur ? <Alerte>{etat.erreur}</Alerte> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-800">Déposant</span>
          <select
            name="clientId"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            required
            className={CHAMP}
          >
            <option value="">— Choisir —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.prenom ? `${c.prenom} ${c.nom}` : c.nom} — {c.commissionDefaut} %
              </option>
            ))}
          </select>
        </label>
        <Champ
          label="Commission (%)"
          name="commission"
          inputMode="decimal"
          // Pré-remplie depuis le déposant, mais modifiable pour ce contrat
          // précis (voir CLAUDE.md). La clé force le champ à se recharger.
          key={clientId}
          defaultValue={client?.commissionDefaut ?? ''}
          aide="Part gardée par la boutique. Vide = celle du déposant."
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Champ label="Début" name="dateDebut" type="date" defaultValue={dansNJours(0)} required />
        <Champ label="Fin" name="dateFin" type="date" defaultValue={dansNJours(30)} required />
        <Champ
          label="Alerte (jours avant)"
          name="notifyBeforeDays"
          type="number"
          min={0}
          defaultValue={7}
          aide="Délai avant l'échéance pour être prévenu."
        />
      </div>

      <Bouton type="submit" disabled={enCours}>
        {enCours ? 'Création…' : 'Créer le contrat'}
      </Bouton>
    </form>
  );
}

/**
 * Déclenche la passe d'échéances à la main.
 *
 * Le job tourne une fois par jour ; attendre le lendemain pour vérifier qu'une
 * alerte part serait absurde, en développement comme après avoir ajusté une
 * date d'échéance.
 */
export function BoutonEcheances() {
  const [etat, action, enCours] = useActionState(async () => lancerEcheances(), ETAT_INITIAL);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <Bouton type="submit" variante="secondaire" disabled={enCours}>
        {enCours ? 'Vérification…' : 'Vérifier les échéances'}
      </Bouton>
      {etat.succes ? <span className="text-xs text-slate-600">{etat.succes}</span> : null}
      {etat.erreur ? <span className="text-xs text-red-700">{etat.erreur}</span> : null}
    </form>
  );
}
