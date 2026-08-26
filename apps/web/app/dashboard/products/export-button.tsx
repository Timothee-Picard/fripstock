'use client';

import { useSearchParams } from 'next/navigation';

/**
 * Export CSV du stock affiché.
 *
 * Les filtres de la liste sont recopiés dans le lien : on exporte exactement ce
 * qu'on voit à l'écran, filtres compris, ou tout le stock si aucun n'est actif.
 * Pagination exclue — un export ne s'arrête pas à la page en cours.
 */
export function ExportButton() {
  const params = useSearchParams();

  const filters = new URLSearchParams(params.toString());
  filters.delete('page');
  filters.delete('perPage');

  const request = filters.toString();
  const active = [...filters.keys()].length;

  return (
    <a
      href={`/api/export${request ? `?${request}` : ''}`}
      className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      title={
        active > 0
          ? `Exporte les produits correspondant aux ${active} filtre(s) appliqué(s)`
          : 'Exporte tout le stock'
      }
    >
      Exporter en CSV
    </a>
  );
}
