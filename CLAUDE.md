# Fripstock — contexte projet

Application de gestion de stock pour boutiques de seconde main. Ce fichier est chargé
automatiquement par Claude Code à chaque session dans ce repo : il fait foi sur les
règles métier et les conventions. Le plan détaillé par étapes est dans `PLAN.md`,
les prompts prêts-à-coller sont dans `prompts`.

## Stack

- **Backend** : NestJS (TypeScript), Prisma ORM, PostgreSQL
- **Frontend** : Next.js (App Router, TypeScript), Tailwind CSS
- **Stockage fichiers** : MinIO (compatible S3) pour les photos produit
- **Auth** : JWT (email/mot de passe pour l'instant, OAuth Google prévu plus tard mais pas
  implémenté maintenant — ne pas complexifier le schéma User pour ça avant qu'on le demande)
- **Orchestration** : docker-compose + Makefile
- **Monorepo** : `apps/api` (NestJS), `apps/web` (Next.js)

## Hiérarchie métier

```
Company (le compte parent, un gérant)
 └─ Shop(s) — points de vente physiques, stock affiché par boutique
     └─ User — rattaché à UNE Company, accès à N Boutiques avec permissions par boutique
```

- Une personne (User) appartient à **une seule** Entreprise.
- Un User peut avoir accès à **plusieurs** Boutiques de son Entreprise.
- Le **gérant** (`isManager = true`) a tous les droits sur toutes les boutiques de son
  entreprise, sans passer par la table de permissions.
- Un **employé** a une ligne `ShopAccess` par boutique à laquelle il a accès, avec un
  objet JSON de permissions activées/désactivées (voir liste ci-dessous).
- Chaque Entreprise est totalement cloisonnée : aucune donnée (produits, catégories,
  clients déposants...) n'est partagée entre deux entreprises différentes.

## Catalogue : catégories & attributs — RÈGLE IMPORTANTE

- Les **catégories** sont définies **au niveau Entreprise** (hiérarchiques, parent/enfant),
  et partagées par toutes les boutiques de cette entreprise. **Pas** de catégories par boutique.
- Les **attributs** (Taille, Couleur, Matière, Marque...) sont définis **au niveau
  Entreprise** également, jamais au niveau boutique.
- Chaque attribut a un **type** : `TEXT`, `NUMBER`, `SELECT` (choix unique dans une liste
  d'options), `MULTISELECT` (plusieurs choix), `BOOLEAN`.
- Un attribut est rattaché à une ou plusieurs catégories (table de jointure) : une catégorie
  "Sac" peut ne pas avoir l'attribut "Taille", une catégorie "Robe" l'aura.
- Il existe une bibliothèque globale de templates d'attributs courants (Taille, Couleur,
  Matière, Marque...) que chaque entreprise peut **cloner puis personnaliser librement**
  (renommer, changer les options) sans impacter les autres entreprises. Cette bibliothèque
  de templates est en lecture seule, gérée par seed, pas par les entreprises elles-mêmes.

## Produits — RÈGLE IMPORTANTE

- Un produit est créé **au niveau Entreprise** (pas directement rattaché à une boutique à
  la création). Le champ `shopId` est **nullable**, et une action dédiée
  "assigner à une boutique" vient le renseigner ensuite. Un produit non assigné existe
  (stock central / à trier) mais n'apparaît pas dans le stock d'une boutique précise.
- Un produit peut être réassigné à une autre boutique plus tard (simple mise à jour du
  champ, pas d'historique de mouvement à prévoir pour le MVP).
- Deux modes de vente, champ `saleType` : `RESALE` ou `CONSIGNMENT`.
  - `RESALE` : la boutique a acheté l'article, champ `purchasePrice` pertinent.
  - `CONSIGNMENT` : l'article appartient à un client déposant via un `DepositContract`,
    pas de `purchasePrice`, une commission s'applique à la vente.
  - À valider au niveau service : `CONSIGNMENT` exige un `depositContractId` et refuse
    `purchasePrice` ; `RESALE` refuse `depositContractId` et `depositorPaid`.
- Champs prix à bien distinguer (vu dans le fichier client existant) :
  - `salePrice` = prix affiché / prix de vente fixé (l'étiquette)
  - `soldPrice` = prix réellement encaissé (peut différer si négocié), rempli au moment
    du passage au statut "vendu"
- Un produit a une **quantité** (`quantity`, défaut 1). Souvent 1 (article unique de
  seconde main), mais peut être > 1 si plusieurs exemplaires identiques. Le statut porte
  sur la ligne entière : pour le MVP, **pas de vente partielle** d'un lot (vendre 2 sur 3
  n'est pas représentable — il faut créer deux produits). Ne pas essayer de modéliser ça.
- Un produit a une **référence** (`reference`), **générée à la création** si elle n'est
  pas saisie : `A-0042` pour un article acheté (compteur de l'entreprise), `D-MAR-001`
  pour un article déposé (code du déposant + compteur qui lui est propre, reparti à 1
  pour chacun). Une référence saisie à la main l'emporte toujours. Les compteurs
  (`Company.productCounter`, `Depositor.productCounter`) sont incrémentés **par la base**
  dans la transaction de création : un `max + 1` lu puis réécrit donnerait le même numéro
  à deux employés simultanés. La paire (`companyId`, `reference`) est **unique**.
  Champ `sku` séparé, nullable, prévu pour un futur scan QR code, non utilisé pour l'instant.
- **La référence ne change jamais toute seule** : elle est écrite sur l'étiquette collée
  au vêtement. Rattacher un article à un contrat de dépôt, ou l'en détacher, propose la
  renumérotation (`renumber`) mais ne l'impose pas — décochée par défaut, puisqu'elle
  oblige à refaire l'étiquette. Un numéro libéré n'est jamais réattribué : une vieille
  étiquette ne doit pas désigner un jour un autre article.
- **Un produit n'appartient qu'à un contrat de dépôt à la fois.** Le rattacher à un second
  est refusé — le déplacer en silence le retirerait du relevé du premier déposant.
- Une seule photo par produit pour l'instant (`photoUrl`), stockée sur MinIO.
- Champs `nom`, `description`, `internalNote` : texte libre.

## Statuts — customisables mais avec comportement métier

- Les statuts (`Status`) sont définis par entreprise. Le gérant en ajuste le **libellé, la
  couleur et le choix de celui par défaut** — mais ne peut ni en créer ni en supprimer :
  le flux (`StatusTransition`) les référence, un statut ajouté n'aurait aucune flèche et
  resterait inatteignable. C'est précisément pour ça que le comportement tient à des flags
  et non aux noms. Statuts de base à seeder à la création
  d'une entreprise : "En stock", "En rayon", "Réservé", "Vendu", "Rendu au client",
  "Retiré".
- Trois flags booléens sur `Status`, non désactivables par l'UI mais définis à la création
  du statut, pour piloter la logique métier indépendamment du libellé choisi par
  l'utilisateur :
  - `isSale: boolean` — si vrai, passer un produit à ce statut **est** une vente : c'est
    à ce moment que `soldPrice` et `soldAt` sont acceptés/exigés, et c'est ce flag (et
    lui seul) qui définit ce qui compte comme vendu pour le relevé déposant et le chiffre
    d'affaires. Utilisé pour "Vendu". **Ne jamais se fier au libellé** (`nom == "Vendu"`)
    pour détecter une vente : le gérant peut renommer ses statuts.
  - `blocksSale: boolean` — si vrai, impossible de faire passer ce produit à un statut
    `isSale = true` ou de modifier son prix vendu (utilisé pour "Rendu au client",
    "Retiré").
  - `leavesStock: boolean` — si vrai, le produit ne compte plus dans l'inventaire actif /
    les stats de stock disponible (utilisé pour "Rendu au client", "Retiré", "Vendu").
- Valeurs des flags pour les statuts de base :

  | Statut          | `isSale` | `blocksSale` | `leavesStock` |
  | --------------- | -------- | ------------ | ------------- |
  | En stock        | ✗        | ✗            | ✗             |
  | En rayon        | ✗        | ✗            | ✗             |
  | Réservé         | ✗        | ✗            | ✗             |
  | Vendu           | ✓        | ✗            | ✓             |
  | Rendu au client | ✗        | ✓            | ✓             |
  | Retiré          | ✗        | ✓            | ✓             |

- Un **flux** (`StatusTransition`) dit quels passages sont autorisés d'un statut à l'autre.
  Il est posé à la création de l'entreprise et n'est pas modifiable ; l'écran des statuts
  l'affiche en lecture seule. Les règles de flags s'appliquent **par-dessus** le flux,
  jamais à sa place. Repli : tant qu'aucune transition n'existe, tous les passages sont
  permis — un graphe vide bloquerait tout le stock.
- Chaque changement de statut est tracé dans `StatusHistory` (produit, statut, qui,
  quand, note optionnelle).
- Quand un produit passe à un statut avec `blocksSale = true` (ex: "Rendu au client"),
  bloquer toute tentative ultérieure de vente au niveau service (pas juste UI).

## Dépôt-vente

- `Depositor` (déposant) : nom, prénom, contact, IBAN, `defaultCommission` (%), et un
  `code` court (le `MAR` de `D-MAR-001`) déduit du nom à la création et modifiable
  ensuite — il finit écrit sur des étiquettes. Rattaché à
  l'Entreprise (pas à une boutique précise, un déposant peut avoir des articles dans
  plusieurs boutiques de l'entreprise).
- `DepositContract` : lie un `Depositor` à une période (`startDate`, `endDate`), une commission
  (copiée depuis `defaultCommission` à la création mais modifiable pour ce contrat précis),
  et `notifyBeforeDays` pour l'alerte d'échéance. Un ou plusieurs produits sont rattachés
  à un contrat.
- **Sens de la commission** : le pourcentage est la **part que garde la boutique**.
  `commission = 40` sur un article vendu 100 € → 40 € pour la boutique, 60 € dus au
  déposant. Le calcul du relevé est donc toujours
  `partDeposant = soldPrice * (1 - commission / 100)`.
- **La commission est figée à la vente** : au passage à un statut `isSale = true`, copier
  la commission du contrat dans `Product.commissionAppliquee`. Tous les relevés, exports et
  stats lisent ce champ, jamais celui du contrat — sinon modifier un contrat réécrirait
  rétroactivement des relevés déjà réglés.
- Champ `depositorPaid: boolean` sur `Product` (pertinent seulement si `CONSIGNMENT` et
  vendu) : indique si le déposant a reçu sa part. Paiement en espèces, donc pas
  d'intégration de paiement, juste un flag à cocher manuellement.
- Notification automatique (job planifié) quand `endDate` d'un contrat approche
  (`notifyBeforeDays` avant l'échéance).
- Quand un produit en dépôt est "rendu" : il sort de l'inventaire actif (`leavesStock` du
  statut), passe en `blocksSale = true`, ne doit plus jamais être vendable.

## Permissions (clés utilisées dans le JSON `ShopAccess.permissions`)

```
products.view
products.create
products.update
products.delete
products.changeStatus
categories.manage
attributes.manage
depositors.manage
deposits.manage
stats.view
export.csv
```

Le gérant (`isManager = true`) bypass entièrement cette table : toujours tous les droits,
sur toutes les boutiques de son entreprise.

**Produits non assignés (`shopId = null`)** : ils n'appartiennent à aucune boutique,
donc aucune ligne `ShopAccess` ne les couvre. Règle : un utilisateur qui possède la
permission dans **au moins une** boutique de son entreprise l'a aussi sur le stock central
(un employé doit pouvoir créer un produit avant de savoir dans quelle boutique il ira).

**Statuts** : leur CRUD est réservé au gérant (`isManager`), comme les boutiques — pas de
clé de permission fine, puisqu'ils sont personnalisables _par le gérant_.

## Export CSV

- Endpoint d'export du stock produits, avec les **mêmes filtres** que la liste (catégorie,
  boutique, statut, typeVente, recherche texte, plage de dates).
- Colonnes fixes : référence, catégorie, boutique, nom, description, commentaire, statut,
  typeVente, prixAchat, prixVente, prixVendu, dateVente, déposant (nom du client si
  DEPOT_VENTE), commissionAppliquee, deposantPaye.
- Colonnes dynamiques : une colonne par attribut présent parmi les produits exportés
  (ex: Couleur, Taille, Marque), pour retrouver la souplesse du fichier Excel actuel
  du client.
- Format CSV avec séparateur `;` (Excel FR) et encodage UTF-8 avec BOM, pour que les
  accents et les `€` s'affichent correctement à l'ouverture dans Excel.

## Conventions de code

- **Tout le code est en anglais** : modèles, champs, routes, variables, noms de
  fichiers et clés de permission. Seuls les textes vus par l'utilisateur (libellés
  d'interface, messages d'erreur, en-têtes CSV) et les commentaires sont en français.
- Modèles Prisma en `PascalCase` (ex: `Product`, `DepositContract`).
- Champs en `camelCase` (ex: `salePrice`, `soldAt`).
- Tables et colonnes en base en `snake_case` via `@@map` / `@map` (convention Postgres).
- DTOs de validation avec `class-validator` sur chaque endpoint qui reçoit un body.
- Un module Nest par domaine (`products/`, `shops/`, etc.), avec `*.controller.ts`,
  `*.service.ts`, `*.module.ts`, `dto/`.
- Toute requête sur une ressource métier doit être scopée à `companyId` (et
  `shopId` quand pertinent) déduit du JWT — jamais du body/params fournis par le
  client, pour éviter toute fuite de données entre entreprises.
- Plusieurs modèles n'ont **pas** de colonne `companyId` : `DepositContract` (via `Depositor`),
  `AttributOption` (via `AttributeDefinition`), `CategoryAttribute`, `AttributeValue`,
  `ProductAttributeOption`, `StatusHistory` (via `Product`), `ShopAccess` (via `User`).
  Pour ceux-là, le `where` doit **toujours** filtrer via la relation parente
  (`where: { client: { companyId } }`) — un `where: { id }` seul sur ces tables est une
  fuite inter-entreprises, pas un raccourci acceptable.
- Écrire les tests au fur et à mesure n'est pas demandé pour le MVP, sauf mention
  contraire dans un prompt d'étape.

## Commits, versions et vérifications

- **Conventional Commits obligatoires**, appliqués par un hook `commit-msg` (commitlint) :
  `type(scope): sujet`. Types : `feat`, `fix`, `docs`, `style`, `refactor`, `perf`,
  `test`, `build`, `ci`, `chore`, `revert`. Scopes usuels : `api`, `web`, `db`, `docker`,
  `ci`, `deps`, `auth`, `catalogue`, `produits`, `depots`, `stats`.
- Sujet sur **une seule ligne, 72 caractères maximum**, en minuscule, à l'impératif, sans
  point final. Corps facultatif après une ligne vide, réservé au _pourquoi_ d'un choix
  non évident. Breaking change : `feat!:` ou un pied `BREAKING CHANGE: ...`.

  ```
  feat(produits): bloque la vente d'un produit rendu au client
  fix(api): scope les contrats de dépôt via client.companyId
  ```

- **Versions en tags `vX.Y.Z`** (semver), posés par `make release` : le script calcule le
  bump depuis les commits conventionnels et le propose, l'humain valide. Tant que la
  version majeure est `0`, un breaking change ne bump que le mineur.
- **`make check` avant de pousser** — format, lint, types, dérive Prisma, tests, build.
  C'est exactement ce que lance la CI ; ne recopie jamais ces commandes ailleurs, appelle
  la cible.

## Ce qui n'est PAS dans le scope pour l'instant

- Pas d'encaissement en ligne (paiement en espèces, l'app ne gère que le stock/statut).
- Pas de scan de code-barres/QR (le champ `sku` existe mais n'est pas exploité).
- Pas d'OAuth Google (prévu plus tard, ne pas préparer de champs spécifiques maintenant).
- Pas de gestion de plusieurs photos par produit (une seule pour l'instant).
- Pas d'historique de mouvement produit entre boutiques (juste le champ `shopId`
  courant).
