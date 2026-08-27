'use client';

import { usePathname } from 'next/navigation';
import { sectionTitle } from '@/lib/navigation';

/**
 * Nom de l'écran courant, dans l'en-tête.
 *
 * Il remplace le titre que chaque page d'index répétait en tête de contenu.
 * Les sous-pages gardent le leur : l'en-tête dit la section, la page dit ce
 * qu'on y fait.
 */
export function PageTitle() {
  const titre = sectionTitle(usePathname());
  if (!titre) return null;
  return <h1 className="truncate text-base font-semibold text-slate-900">{titre}</h1>;
}
