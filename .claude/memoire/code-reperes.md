# Repères de code

> Fripstock — où vit la logique porteuse, pour ne pas la chercher ni la réécrire ailleurs.

Modules qui concentrent une règle, à lire avant d'en réimplémenter une variante :

**API** (`apps/api/src/`)

- `common/permissions.ts` — **seule source de vérité** des clés de permission et
  de leurs libellés français. Ne jamais écrire une clé en dur ailleurs.
- `common/guards/permissions.guard.ts` — bypass gérant, trois façons de retrouver
  la boutique visée, modes `all` / `any`.
- `common/decorators/require-permission.decorator.ts` — `@RequirePermission`
  (cumule) et `@RequireAnyPermission` (l'une ou l'autre).
- `products/products.service.ts` — le gros morceau : création (avec `createWith`
  transactionnel réutilisé par les contrats), lot, vente multiple, changement de
  statut, filtres et tri partagés entre la liste et l'export.
- `products/references.ts` — génération `A-0042` / `D-MAR-001`, code déposant.
- `products/lot-split.ts` — répartition d'un total au centime (plus forts restes).
  **Jumeau** dans `apps/web/lib/lot-split.ts` : modifier les deux.
- `products/csv-export.ts` — séparateur `;`, BOM UTF-8, échappement des cellules
  commençant par `=`, `+`, `-`, `@`.
- `stats/stats.service.ts` — découpage du tableau de bord par droit ; les blocs
  refusés ne sont pas calculés, donc absents de la réponse.
- `stats/today.ts` — bornes de la journée dans le fuseau boutique, et le **jour
  calendaire** (`day`) à afficher, l'instant se reformatant en la veille côté
  serveur Next qui tourne en UTC.
- `test/prisma-mock.ts`, `test/fixtures.ts`, `test/routes.ts`, `test/validate.ts` —
  l'outillage de test ; `routes.ts` lit les métadonnées des décorateurs.

**Web** (`apps/web/`)

- `lib/types.ts` — miroir des clés de permission, libellés, aides, et types d'API.
  À tenir aligné avec `common/permissions.ts` côté API.
- `lib/permissions.ts` — `hasPermission`, même règle que le guard (droit détenu
  quelque part).
- `lib/navigation.ts` — entrées du menu, cookie de repli, titre de section.
- `lib/form-lines.ts` — lecture des tableaux ligne-par-ligne (lot, contrat).
- `app/dashboard/counter.tsx` — le comptoir de vente.

**Couverture** : seuils Jest imposés côté API — 100 % lignes, fonctions et
instructions, 85 % branches. Une ligne non couverte fait échouer `make check`.
Côté web (Vitest) il n'y a pas de seuil.

Voir aussi [ou-chercher](ou-chercher.md) et [outillage](outillage.md).
