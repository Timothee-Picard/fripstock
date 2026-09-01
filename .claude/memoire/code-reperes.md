# Repères de code

> Fripstock — où vit la logique porteuse, pour ne pas la chercher ni la réécrire ailleurs.

Modules qui concentrent une règle, à lire avant d'en réimplémenter une variante :

**API** (`apps/api/src/`)

- `common/permissions.ts` — **seule source de vérité** des clés de permission et
  de leurs libellés français. Ne jamais écrire une clé en dur ailleurs. Porte aussi
  `COMPANY_PERMISSIONS` : les droits qui valent pour toute l'entreprise et ne se
  découpent pas par boutique.
- `common/guards/permissions.guard.ts` — bypass gérant, trois façons de retrouver
  la boutique visée, modes `all` / `any`.
- `common/decorators/require-permission.decorator.ts` — `@RequirePermission`
  (cumule) et `@RequireAnyPermission` (l'une ou l'autre).
- `products/products.service.ts` — le gros morceau : création (avec `createWith`
  transactionnel réutilisé par les contrats), lot, vente multiple, changement de
  statut, filtres et tri partagés entre la liste et l'export.
- `products/references.ts` — génération `A-0042` / `D-MAR-001`, code déposant.
- `products/removal-scope.ts` — **qui voit quels retraits**, la règle à un seul
  endroit : l'annonce à retirer vaut pour toute l'entreprise, le vêtement à
  décrocher exige `products.manage` + `products.view` sur sa boutique.
- `statuses/statuses.defaults.ts` — les 7 statuts et 20 transitions posés à la
  création d'une entreprise. En ajouter un impose une **migration de données** pour
  les entreprises existantes : les statuts sont figés après coup.
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
- `lib/permissions.ts` — `hasPermission` (droit détenu **quelque part**, pour un
  écran transverse) et `hasPermissionOnShop` (**sur cette boutique-là**, dès qu'un
  écran en vise une). Se tromper des deux propose une action que l'API refusera.
- `lib/navigation.ts` — entrées du menu, cookie de repli, titre de section.
- `lib/form-lines.ts` — lecture des tableaux ligne-par-ligne (lot, contrat).
- `lib/dates.ts` — **toute** date affichée passe par là, dans le fuseau boutique.
  Un `toLocaleDateString` sans `timeZone` casse l'hydratation : le serveur est en
  UTC, le navigateur non. `formatCalendarDay` pour un `AAAA-MM-JJ`, qui n'est pas
  un instant. **Jumeau** de `SHOP_TIMEZONE` dans `stats/today.ts` côté API.
- `app/dashboard/counter.tsx` — le comptoir de vente.
- `app/dashboard/removals-card.tsx` — l'aperçu des retraits sur le tableau de bord,
  deux listes selon le droit **et** selon l'endroit regardé. `app/dashboard/removals/`
  en est la liste complète, rangée par endroit où aller (`sections.ts`). Le sens du geste se lit sur
  `status.isOnlineSale`, jamais sur le libellé.
- `components/shop-selector.tsx` — boutique du tableau de bord, écrite dans l'URL.
  Rendu par `app/dashboard/page.tsx`, **pas** par le layout : il ne pilote que cet
  écran. La liste des produits a son propre filtre boutique dans `products/filters.tsx`.

**Couverture** : seuils Jest imposés côté API — 100 % lignes, fonctions et
instructions, 85 % branches. Une ligne non couverte fait échouer `make check`.
Côté web (Vitest) il n'y a pas de seuil.

Voir aussi [ou-chercher](ou-chercher.md) et [outillage](outillage.md).
