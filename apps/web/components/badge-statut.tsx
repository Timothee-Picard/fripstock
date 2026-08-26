import type { Statut } from '@/lib/types';

/**
 * Pastille de statut. La couleur vient de la base — chaque entreprise choisit
 * la sienne — et le texte passe en clair ou en foncé selon la luminance, pour
 * rester lisible quelle que soit la teinte retenue.
 */
export function BadgeStatut({ statut }: { statut: Pick<Statut, 'nom' | 'couleur'> }) {
  return (
    <span
      className="inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: statut.couleur, color: texteLisible(statut.couleur) }}
    >
      {statut.nom}
    </span>
  );
}

function texteLisible(fond: string): string {
  const hex = fond.replace('#', '');
  if (hex.length !== 6) return '#ffffff';
  const [r, v, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(v) + 0.0722 * lin(b);
  // Seuil au point où les contrastes avec le noir et le blanc s'équilibrent.
  return luminance > 0.179 ? '#0f172a' : '#ffffff';
}
