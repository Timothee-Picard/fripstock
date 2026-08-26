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
  const [commission, setCommission] = useState('');

  const part = Number(commission.replace(',', '.'));
  const partDeposant = Number.isFinite(part) && commission !== '' ? 100 - part : null;

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
            onChange={(e) => {
              setClientId(e.target.value);
              // La valeur du déposant n'est qu'un point de départ : on la
              // recopie ici, puis c'est le contrat qui fait foi.
              setCommission(clients.find((c) => c.id === e.target.value)?.commissionDefaut ?? '');
            }}
            required
            className={CHAMP}
          >
            <option value="">— Choisir —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.prenom ? `${c.prenom} ${c.nom}` : c.nom}
              </option>
            ))}
          </select>
        </label>
        {/* Le déposant ne porte qu'une valeur par défaut, qui évite de la
            retaper à chaque contrat : c'est bien ce contrat qui fait foi, et
            c'est sa commission que le relevé fige à la vente (CLAUDE.md). */}
        <Champ
          label="Commission de ce contrat (%)"
          name="commission"
          inputMode="decimal"
          value={commission}
          onChange={(e) => setCommission(e.target.value)}
          aide={
            partDeposant === null
              ? 'Part gardée par la boutique.'
              : `Part gardée par la boutique — le déposant touchera ${partDeposant} %.`
          }
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
