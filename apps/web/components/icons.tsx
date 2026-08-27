import type { NavIcon } from '@/lib/navigation';

/**
 * Icônes en SVG inline : trois traits chacune, aucune dépendance à charger.
 * Elles héritent de la couleur du texte et se dimensionnent en `em`, donc
 * suivent la taille du contenu autour.
 */
const commun = {
  width: '1.15em',
  height: '1.15em',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export function ViewIcon() {
  return (
    <svg {...commun}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function EditIcon() {
  return (
    <svg {...commun}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export function DeleteIcon() {
  return (
    <svg {...commun}>
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

/* --- Icônes du menu latéral ------------------------------------------------
 *
 * Une par section : c'est ce qui reste visible quand le menu est replié, et
 * donc le seul repère pour retrouver un écran. Elles doivent se distinguer au
 * premier coup d'œil, pas seulement au survol.
 */

export function DashboardIcon() {
  return (
    <svg {...commun}>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}

export function ProductsIcon() {
  return (
    <svg {...commun}>
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2a2 2 0 0 1-.4-2.3l3-6A2 2 0 0 1 7.8 4h6a2 2 0 0 1 1.4.6l5.4 5.4a2 2 0 0 1 0 2.8Z" />
      <circle cx="8.5" cy="8.5" r="1.2" />
    </svg>
  );
}

export function CategoriesIcon() {
  return (
    <svg {...commun}>
      <path d="M3 6a2 2 0 0 1 2-2h3l2 2h7a2 2 0 0 1 2 2v2" />
      <path d="M3 6v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6H8l-2 3" />
    </svg>
  );
}

export function AttributesIcon() {
  return (
    <svg {...commun}>
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h10M18 18h2" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="16" cy="18" r="2" />
    </svg>
  );
}

export function DepositorIcon() {
  return (
    <svg {...commun}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}

export function ContractIcon() {
  return (
    <svg {...commun}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h4" />
    </svg>
  );
}

export function ShopIcon() {
  return (
    <svg {...commun}>
      <path d="M4 9V6l1.5-3h13L20 6v3" />
      <path d="M4 9a2.5 2.5 0 0 0 4 1.8A2.5 2.5 0 0 0 12 9a2.5 2.5 0 0 0 4 1.8A2.5 2.5 0 0 0 20 9" />
      <path d="M5 11v9h14v-9" />
      <path d="M10 20v-5h4v5" />
    </svg>
  );
}

export function UsersIcon() {
  return (
    <svg {...commun}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19a6 6 0 0 1 12 0" />
      <path d="M16 6.2a3 3 0 0 1 0 5.6" />
      <path d="M17.5 14.3A5 5 0 0 1 21 19" />
    </svg>
  );
}

export function LogoutIcon() {
  return (
    <svg {...commun}>
      <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H10" />
    </svg>
  );
}

/** Chevrons doubles : replie le menu vers la gauche, le déplie vers la droite. */
export function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg {...commun} style={collapsed ? { transform: 'rotate(180deg)' } : undefined}>
      <path d="M11 6l-6 6 6 6" />
      <path d="M18 6l-6 6 6 6" />
    </svg>
  );
}

/** Trois traits : le déclencheur du menu sur mobile. */
export function MenuIcon() {
  return (
    <svg {...commun}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg {...commun}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/** La clé d'icône portée par l'entrée, résolue en composant côté client. */
export const NAV_ICONS: Record<NavIcon, () => React.ReactElement> = {
  dashboard: DashboardIcon,
  products: ProductsIcon,
  categories: CategoriesIcon,
  attributes: AttributesIcon,
  depositors: DepositorIcon,
  contracts: ContractIcon,
  shops: ShopIcon,
  users: UsersIcon,
};
