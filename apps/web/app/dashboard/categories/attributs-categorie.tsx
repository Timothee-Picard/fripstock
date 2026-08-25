'use client';

import { useActionState, useState } from 'react';
import { definirAttributs, type EtatCategorie } from './actions';
import { Alerte, Bouton } from '@/components/champ';
import { LIBELLES_TYPES, type AttributDefinition } from '@/lib/types';

const ETAT_INITIAL: EtatCategorie = {};

/**
 * Attributs proposés pour une catégorie.
 *
 * Ce n'est pas une possession : les valeurs vivent sur le produit. Cette liste
 * décide seulement de ce que le formulaire produit demandera — et de ce que
 * l'API acceptera — pour un produit de cette catégorie.
 */
export function AttributsCategorie({
  categorieId,
  categorieNom,
  attributs,
  selectionnes,
}: {
  categorieId: string;
  categorieNom: string;
  attributs: AttributDefinition[];
  selectionnes: string[];
}) {
  const [ouvert, setOuvert] = useState(false);
  const [etat, action, enCours] = useActionState(definirAttributs, ETAT_INITIAL);

  const coches = new Set(selectionnes);
  const noms = attributs.filter((a) => coches.has(a.id)).map((a) => a.nom);

  if (attributs.length === 0) {
    return <span className="text-xs text-slate-600">Aucun attribut défini</span>;
  }

  return (
    <div className="flex-1">
      <button
        type="button"
        onClick={() => setOuvert(!ouvert)}
        className="flex flex-wrap items-center gap-1.5 text-left text-xs text-slate-600 transition hover:text-slate-900"
        aria-expanded={ouvert}
      >
        <span className="text-slate-700">{ouvert ? '▾' : '▸'}</span>
        {noms.length === 0 ? (
          <span className="italic">aucun attribut proposé</span>
        ) : (
          noms.map((n) => (
            <span key={n} className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">
              {n}
            </span>
          ))
        )}
        <span className="underline underline-offset-2">modifier</span>
      </button>

      {ouvert ? (
        <form action={action} className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-3">
          <input type="hidden" name="id" value={categorieId} />
          <p className="mb-2 text-xs text-slate-600">
            Attributs demandés lors de la création d&apos;un produit dans « {categorieNom} ».
          </p>
          <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {attributs.map((a) => (
              <label key={a.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="attributId"
                  value={a.id}
                  defaultChecked={coches.has(a.id)}
                  className="size-4 rounded border-slate-400 accent-slate-900"
                />
                {a.nom}
                <span className="text-xs text-slate-600">{LIBELLES_TYPES[a.type]}</span>
              </label>
            ))}
          </div>
          {etat.erreur ? <div className="mt-2">{<Alerte>{etat.erreur}</Alerte>}</div> : null}
          {etat.succes ? (
            <div className="mt-2">{<Alerte ton="info">{etat.succes}</Alerte>}</div>
          ) : null}
          <div className="mt-3">
            <Bouton type="submit" variante="secondaire" disabled={enCours}>
              {enCours ? '…' : 'Enregistrer'}
            </Bouton>
          </div>
        </form>
      ) : null}
    </div>
  );
}
