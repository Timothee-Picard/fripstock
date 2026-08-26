'use client';

import { useState } from 'react';

/**
 * Dépose la photo dès la sélection et garde sa clé dans un champ caché : le
 * produit est ensuite créé en JSON, sans multipart. La clé pointe sur un objet
 * MinIO privé, jamais sur une URL publique.
 */
export function PhotoField({
  cleInitiale = '',
  unlabeled = false,
}: {
  cleInitiale?: string;
  /** La carte qui l'entoure porte déjà le titre « Photo ». */
  unlabeled?: boolean;
}) {
  const [key, setCle] = useState(cleInitiale);
  const [error, setError] = useState('');
  const [pending, setEnCours] = useState(false);

  async function submit(file: File) {
    setError('');
    setEnCours(true);
    try {
      const body = new FormData();
      body.append('fichier', file);
      const response = await fetch('/api/photos', { method: 'POST', body: body });
      const data = (await response.json()) as { key?: string; message?: string };
      if (!response.ok || !data.key) {
        setError(data.message ?? 'Envoi impossible.');
        return;
      }
      setCle(data.key);
    } catch {
      setError('Envoi impossible.');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div>
      {unlabeled ? null : (
        <span className="mb-1 block text-sm font-medium text-slate-800">Photo</span>
      )}
      <input type="hidden" name="photoUrl" value={key} />
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void submit(file);
        }}
        className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border file:border-slate-400 file:bg-white file:px-3 file:py-1.5 file:text-sm file:text-slate-800"
      />
      <span className="mt-1 block text-xs text-slate-600">
        JPEG, PNG, WebP ou AVIF — 5 Mo maximum.
      </span>

      {pending ? <p className="mt-2 text-sm text-slate-600">Envoi…</p> : null}
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      {key ? (
        <div className="mt-2 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/photos/${key}`} alt="" className="size-16 rounded object-cover" />
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
