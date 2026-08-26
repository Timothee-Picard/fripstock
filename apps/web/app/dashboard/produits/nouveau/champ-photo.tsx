'use client';

import { useState } from 'react';

/**
 * Dépose la photo dès la sélection et garde sa clé dans un champ caché : le
 * produit est ensuite créé en JSON, sans multipart. La clé pointe sur un objet
 * MinIO privé, jamais sur une URL publique.
 */
export function ChampPhoto({
  cleInitiale = '',
  sansLibelle = false,
}: {
  cleInitiale?: string;
  /** La carte qui l'entoure porte déjà le titre « Photo ». */
  sansLibelle?: boolean;
}) {
  const [cle, setCle] = useState(cleInitiale);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  async function envoyer(fichier: File) {
    setErreur('');
    setEnCours(true);
    try {
      const corps = new FormData();
      corps.append('fichier', fichier);
      const reponse = await fetch('/api/photos', { method: 'POST', body: corps });
      const donnees = (await reponse.json()) as { cle?: string; message?: string };
      if (!reponse.ok || !donnees.cle) {
        setErreur(donnees.message ?? 'Envoi impossible.');
        return;
      }
      setCle(donnees.cle);
    } catch {
      setErreur('Envoi impossible.');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div>
      {sansLibelle ? null : (
        <span className="mb-1 block text-sm font-medium text-slate-800">Photo</span>
      )}
      <input type="hidden" name="photoUrl" value={cle} />
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        onChange={(e) => {
          const fichier = e.target.files?.[0];
          if (fichier) void envoyer(fichier);
        }}
        className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border file:border-slate-400 file:bg-white file:px-3 file:py-1.5 file:text-sm file:text-slate-800"
      />
      <span className="mt-1 block text-xs text-slate-600">
        JPEG, PNG, WebP ou AVIF — 5 Mo maximum.
      </span>

      {enCours ? <p className="mt-2 text-sm text-slate-600">Envoi…</p> : null}
      {erreur ? <p className="mt-2 text-sm text-red-700">{erreur}</p> : null}
      {cle ? (
        <div className="mt-2 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/photos/${cle}`} alt="" className="size-16 rounded object-cover" />
          <button
            type="button"
            onClick={() => setCle('')}
            className="text-sm text-slate-600 underline underline-offset-2 hover:text-slate-900"
          >
            Retirer
          </button>
        </div>
      ) : null}
    </div>
  );
}
