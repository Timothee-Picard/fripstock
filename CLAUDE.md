# Fripstock — contexte projet

Application de gestion de stock pour boutiques de seconde main. Ce fichier est chargé
automatiquement par Claude Code à chaque session dans ce repo : il fait foi sur les
règles métier et les conventions.

## Stack

- **Backend** : NestJS (TypeScript), Prisma ORM, PostgreSQL
- **Frontend** : Next.js (App Router, TypeScript), Tailwind CSS
- **Stockage fichiers** : MinIO (compatible S3) pour les photos produit
- **Auth** : JWT (email/mot de passe pour l'instant, OAuth Google prévu plus tard mais pas
  implémenté maintenant — ne pas complexifier le schéma User pour ça avant qu'on le demande)
- **Orchestration** : docker-compose + Makefile. **Deux composes, jamais mélangés** :
  `docker-compose.yml` est strictement celui du développement (code monté en volume,
  rechargement à chaud, ports publiés), `docker-compose.prod.yml` celui de la
  production, déployé par Coolify. Même partage pour les images : `Dockerfile` et
  `Dockerfile.prod` dans chaque app.
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

**Supprimer « le compte », c'est supprimer l'Entreprise** (`DELETE /auth/account`,
`@ManagerOnly()`). Un gérant n'en a qu'une, et la lui retirer sans retirer l'entreprise
laisserait ses employés enfermés dans des données que plus personne ne peut administrer.
Un employé est supprimé par son gérant (`DELETE /users/:id`) — et l'écran du profil le lui
**écrit** au lieu de masquer un bouton, sinon le refus passe pour une panne.

- Le **mot de passe est réexigé**, comme pour un changement d'email : c'est définitif et il
  n'y a pas de corbeille. La confirmation est une vraie modale, pas un `window.confirm()`,
  parce qu'elle doit **montrer** ce qui part : `GET /auth/account` renvoie les chiffres
  (boutiques, employés, produits, déposants, contrats), et ce qui est à zéro ne se dit pas.
- **L'ordre de suppression n'est pas libre**, deux `onDelete: Restrict` s'y opposent : les
  **produits d'abord** (leur catégorie et leur statut sont en `Restrict`), puis les
  **catégories des feuilles vers la racine** (`parentId` en `Restrict`, que Postgres
  vérifie ligne à ligne — même quand l'enfant disparaît dans la même commande). Le reste
  tombe en cascade. Ne pas « simplifier » en un seul `company.delete()`.

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
- **Une entreprise neuve arrive avec un catalogue**, posé par l'inscription dans la
  transaction de création : les attributs de base et les catégories de base, chacune
  rattachée aux attributs qui la concernent. Un catalogue vide rendait le premier écran
  utile — créer un produit — inatteignable sans passer par deux écrans de réglage.
  Contrairement aux statuts, **rien n'y est figé** : c'est un point de départ à remanier,
  et aucune migration de données ne l'impose aux entreprises existantes.
- La liste vit à un **seul endroit**, `catalog/catalog.defaults.ts`, parce qu'elle sert
  trois usages : la bibliothèque globale (seed), le catalogue de la démonstration (seed)
  et celui de toute inscription. Le clone se rattache à son template quand la bibliothèque
  est seedée et s'en passe sinon — en production seules les migrations tournent, et le
  catalogue doit se poser quand même.

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
- **La vente en ligne est un second axe, pas un statut.** `isOnline` est un booléen sur le
  produit : un vêtement sur un portant peut être annoncé sur le site **en même temps**,
  alors qu'un produit ne porte qu'un statut à la fois. `onlinePrice` est nullable — vide
  veut dire « même prix qu'en boutique », pas « gratuit », et évite de saisir deux fois le
  même montant. La **vente**, elle, est bien un statut (« Vendu en ligne ») : elle n'a
  qu'un canal.
- **`pendingRemoval` : la corvée de l'autre canal**, et elle n'est pas la même dans les
  deux sens. Le sens se **déduit de `isOnlineSale` du statut de vente**, il n'est pas
  stocké une seconde fois.
  - **Vendu par le site** : celui qui enregistre la vente est celui qui tient le site,
    l'annonce part donc avec la commande — `isOnline` retombe tout seul. Reste le vêtement
    à décrocher, et **seulement s'il est dans une boutique** (`shopId != null`) : au stock
    central il n'est sur aucun portant.
  - **Sorti du stock autrement** — vendu au comptoir, rendu, retiré — alors que l'annonce
    est publiée : personne côté site n'est au courant. Le drapeau se lève, et **l'annonce
    n'est surtout pas coupée** : la couper effacerait la trace de ce qu'il reste à faire.
    Elle tombe avec le drapeau, quand quelqu'un confirme le retrait.
- **La vente rapide en ligne ne puise que dans les articles annoncés** (`isOnline`) : un
  article jamais publié n'a pas pu se vendre sur le site.
- Une seule photo par produit pour l'instant (`photoUrl`), stockée sur MinIO.
- Champs `nom`, `description`, `internalNote` : texte libre.

## Statuts — customisables mais avec comportement métier

- Les statuts (`Status`) sont définis par entreprise, posés à sa création, et **ne
  bougent plus ensuite** : ni créés, ni supprimés, ni renommés. Ce sont des rouages
  internes, qu'**aucun écran n'expose** — l'API n'en garde que la lecture
  (`GET /statuses`), dont la liste des produits, leur fiche et leur changement de statut
  ont besoin. Le flux (`StatusTransition`) les référence : un statut ajouté n'aurait
  aucune flèche et resterait inatteignable. Statuts de base à seeder à la création
  d'une entreprise : "En stock", "En rayon", "Réservé", "Vendu", "Rendu au client",
  "Retiré".
- Ce qui compte d'un statut n'est pas son nom mais le **comportement porté par ses
  flags**. Le code ne doit jamais se fier au libellé — la règle vaut même si plus
  personne ne peut renommer un statut : c'est la lisibilité de l'intention qui est en
  jeu, pas seulement la robustesse.
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
  - `isOnlineSale: boolean` — si vrai, la vente est passée par le site et non par le
    comptoir. C'est ce flag, et lui seul, qui dit à qui ne détient que `online.manage`
    quels statuts il peut atteindre, et dans quel sens va un retrait à faire.
    **Ne jamais lire le libellé** pour ça.
- Valeurs des flags pour les statuts de base :

  | Statut          | `isSale` | `blocksSale` | `leavesStock` | `isOnlineSale` |
  | --------------- | -------- | ------------ | ------------- | -------------- |
  | En stock        | ✗        | ✗            | ✗             | ✗              |
  | En rayon        | ✗        | ✗            | ✗             | ✗              |
  | Réservé         | ✗        | ✗            | ✗             | ✗              |
  | Vendu           | ✓        | ✗            | ✓             | ✗              |
  | Vendu en ligne  | ✓        | ✗            | ✓             | ✓              |
  | Rendu au client | ✗        | ✓            | ✓             | ✗              |
  | Retiré          | ✗        | ✓            | ✓             | ✗              |

- Le flux de base autorise « En stock » → « Vendu » : un client peut acheter un article
  sorti de la réserve, lui imposer un passage par le rayon bloquerait la vente au
  comptoir pour rien.
- « Vendu en ligne » part des trois mêmes points que « Vendu » — En stock, En rayon,
  Réservé — et revient en rayon comme lui. Passer par « Réservé » reste **possible et non
  imposé** : c'est ce qu'on fait pour un article encore en rayon, afin que personne ne le
  vende au comptoir pendant la préparation du colis, mais un article en réserve part
  directement.
- **Le comptoir n'utilise que le statut de vente non-en-ligne.** Depuis qu'il existe deux
  statuts de vente, `saleStatus()` filtre sur `isSale && !isOnlineSale` : sans ce filtre,
  chaque encaissement se heurterait à « plusieurs statuts de vente existent, précisez
  lequel ».
- Un **flux** (`StatusTransition`) dit quels passages sont autorisés d'un statut à l'autre.
  Il est posé à la création de l'entreprise et n'est pas modifiable, ni par une route ni
  par un écran. Les règles de flags s'appliquent **par-dessus** le flux,
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
- **Un contrat porte au moins un article** : on ne fait pas signer un déposant pour rien,
  et le relevé qui en découlerait serait vide. Les articles se saisissent dans la même
  passe que le contrat, dans la même transaction — une ligne refusée n'enregistre rien.
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
- **Le contrat s'imprime et se signe** : `GET /deposit-contracts/:id/pdf` rend le
  document (entreprise, coordonnées complètes du déposant IBAN compris, période,
  commission, articles avec leur référence, conditions, deux zones de signature).
  Rendu côté API avec `pdfkit`, jamais par l'impression du navigateur : la fiche
  d'écran ne charge pas ces coordonnées, et une page imprimée ne donne ni nom de
  fichier ni mise en page reproductible. Les articles sont rangés **par référence**,
  celle des étiquettes, et non par ordre de saisie. Même droit que la fiche
  (`deposits.manage`) : qui peut lire le contrat peut l'imprimer.
- Notification automatique (job planifié) quand `endDate` d'un contrat approche
  (`notifyBeforeDays` avant l'échéance).
- Quand un produit en dépôt est "rendu" : il sort de l'inventaire actif (`leavesStock` du
  statut), passe en `blocksSale = true`, ne doit plus jamais être vendable.

## Permissions (clés utilisées dans le JSON `ShopAccess.permissions`)

```
products.view
products.manage
products.delete
products.changeStatus
online.manage
categories.manage
attributes.manage
depositors.manage
deposits.manage
stats.view
stock.view
export.csv
```

**Droits d'entreprise.** Le catalogue, les déposants, les contrats et la boutique en ligne
sont **uniques pour l'entreprise** : il n'y a pas une arborescence de catégories par
boutique, ni un site par boutique. `categories.manage`, `attributes.manage`,
`depositors.manage`, `deposits.manage` et `online.manage` sont donc des droits
d'entreprise — les détenir sur **une** boutique, c'est les détenir partout, y compris sur
une route qui cible un produit rattaché à une autre boutique. La liste fait foi dans
`COMPANY_PERMISSIONS` (`common/permissions.ts`), et le garde évalue **chaque droit selon
sa propre règle** : une route qui accepte « `products.manage` ou `online.manage` » mêle un
droit de boutique et un droit d'entreprise, et trancher pour les deux à la fois refuserait
le second hors de la boutique où il est coché.

Côté écran, ces droits se cochent **une fois** et non par boutique. À l'enregistrement ils
sont recopiés sur **toutes** les lignes `ShopAccess` de l'employé : la table n'a pas
d'autre endroit où les poser, et c'est ce qui les rend vrais partout. Le miroir web
(`COMPANY_PERMISSIONS` dans `lib/types.ts`) doit bouger avec celui de l'API.

Le gérant (`isManager = true`) bypass entièrement cette table : toujours tous les droits,
sur toutes les boutiques de son entreprise.

**Produits non assignés (`shopId = null`)** : ils n'appartiennent à aucune boutique,
donc aucune ligne `ShopAccess` ne les couvre. Règle : un utilisateur qui possède la
permission dans **au moins une** boutique de son entreprise l'a aussi sur le stock central
(un employé doit pouvoir créer un produit avant de savoir dans quelle boutique il ira).

**Tableau de bord** : il n'est gouverné par aucune permission unique — la route
`/stats/dashboard` ne porte donc **pas** de `@RequirePermission`. Trois droits y ouvrent
des blocs distincts, et le service n'envoie que ceux auxquels l'utilisateur a droit :

| Bloc                                                        | Droit                                       | Contenu                                                                      |
| ----------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------- |
| `sales`, `byDay`, `topCategories`, `topProducts`, `returns` | `stats.view`                                | Chiffre d'affaires, marge, panier moyen, courbe, classements, taux de retour |
| `rotation`, `topAttributes`                                 | `stats.view`                                | Temps de rotation, ventes classées par valeur d'attribut                     |
| `stock`                                                     | `stock.view`                                | Stock actif et sa valeur, répartition par statut                             |
| `today`                                                     | `stats.view` **ou** `products.changeStatus` | Recette du jour. `today.margin` n'est joint qu'avec `stats.view`             |
| `removals.toDelist`                                         | `online.manage`                             | Vendus au comptoir, annonce encore publiée : à dépublier                     |
| `removals.toPull`                                           | `products.manage`                           | Vendus par le site, vêtement encore en boutique : à décrocher                |

**Le temps de rotation et le classement par attribut relèvent de `stats.view`**, comme le
taux de retour et pour la même raison : ils ne disent pas ce qu'il y a en rayon, ils jugent
ce qui s'y vend. La rotation se compte de l'**entrée en stock** (`createdAt`) à la **vente**
(`soldAt`), sur les seuls articles vendus — un invendu n'a pas encore de durée, et le
compter à zéro tirerait la moyenne vers le bas au fil des saisies. La **médiane accompagne
toujours la moyenne** : un manteau resté un an suffit à faire mentir la seconde.

**Le classement par attribut porte sur les listes et le texte libre**, jamais sur les
nombres ni les oui/non — ranger des pointures ne répond à aucune question. Il se compte en
**nombre d'articles vendus**, pas en euros : la question est ce qui part, et un manteau à
120 € placerait sa couleur devant dix t-shirts. Le chiffre d'affaires reste joint et se lit
dans l'infobulle ; à nombre égal, c'est lui qui départage. Une entrée par attribut
classable de l'entreprise est renvoyée **même sans vente** : la liste des modules proposés
ne doit pas changer selon la période regardée, sinon la carte qu'on vient d'ajouter
disparaît dès qu'on remonte à sept jours. Un article en choix multiples compte dans
**chacune** de ses valeurs — la question posée est « qu'est-ce qui se vend », pas « comment
se répartit l'inventaire », et l'écran le dit.

**Les graphiques du tableau de bord sont des modules rangeables.** Chacun s'affiche ou se
masque, et leur ordre se change par glisser-déposer dans la zone des graphiques — pas
ailleurs : la recette du jour, le comptoir et les retraits sont des actions, ils ne se
rangent pas. C'est une **préférence personnelle** (`User.dashboardLayout`), pas un réglage
d'entreprise : deux employés d'une même boutique n'ont ni les mêmes droits ni le même
travail, et un rangement imposé masquerait à l'un ce que l'autre ne regarde jamais.

- `GET /stats/layout` et `PUT /stats/layout` — **aucune permission** : ranger une carte
  n'ouvre pas le bloc qu'elle contient, et les blocs restent découpés par droit comme
  avant.
- La forme stockée est une **liste ordonnée** de `{ key, visible }` : l'ordre du tableau
  est l'ordre à l'écran, rien d'autre ne le porte. L'API en valide la **forme** et non le
  sens — elle ne connaît pas le catalogue des modules, qui appartient à l'écran. Une clé
  devenue inconnue est ignorée à l'affichage, pas un 400 qui bloquerait tout le reste.
- Un module **absent de la liste** n'a jamais été rangé : il se pose à la fin avec sa
  visibilité par défaut, plutôt que de disparaître parce qu'il est né après elle.
- **« Meilleures ventes par attribut » est UN module qu'on ajoute plusieurs fois**, et non
  un module par attribut. La réserve n'en propose qu'une entrée générique et l'attribut se
  choisit **sur la carte** : les attributs vont et viennent, et une réserve qui les
  énumérerait se périmerait à la première suppression. En interne chaque carte porte la clé
  `attribute:<attributeId>` — c'est ce qui la relie à son classement, et ce qui la fait
  disparaître proprement quand l'attribut est supprimé, sans laisser d'entrée morte. Aucune
  carte d'attribut n'est posée par défaut.
- Le rangement ne part qu'au « Terminer », **complet** : on essaie, on regarde, on garde ou
  on abandonne. Et le glisser-déposer ne suffit pas seul — chaque carte porte aussi deux
  boutons de déplacement, qui sont la version utilisable sans souris, pas un pis-aller.

**L'aperçu du tableau de bord n'est pas la liste.** L'écran `/dashboard/removals` en donne
la totalité, cherchable et paginée : un article vendu il y a trois semaines n'est ni dans
l'aperçu ni dans les cinquante que l'API renvoie, et il faut pourtant pouvoir aller le
décrocher. L'entrée de menu s'ouvre à `online.manage` **ou** `products.manage`.

**L'aperçu du tableau de bord est borné à 5, et renvoie le compte réel.** Un lendemain de
week-end peut en aligner cinquante : une liste illimitée pousserait les chiffres hors de
l'écran et alourdirait chaque chargement. `total` ne se déduit donc **jamais** de
`items.length` — une troncature muette se lirait comme « tout est là ». Rien ne s'y déplie :
tout ce qui dépasse se traite sur l'écran des retraits, qui range **par endroit où aller**
— la boutique en ligne, puis une section par boutique — et porte le
**« tout marquer comme retiré »** (`PUT /products/removals-done`), une action par section.
Le geste réel est groupé : on dépublie douze annonces d'affilée, puis on revient le dire,
et douze clics pour une seule action font abandonner une liste de tâches.

**Les deux corvées n'ont pas le même périmètre**, et la règle vit à un seul endroit :
`products/removal-scope.ts`, dont le tableau de bord et l'écran des retraits se servent
tous les deux.

- **Retirer une annonce** est un travail de site. `online.manage` porte sur **tous** les
  produits de l'entreprise, quelle que soit la boutique qui détient l'article : le borner
  laisserait des annonces vendues sans personne pour les ôter.
- **Décrocher un vêtement** demande d'aller dans le rayon. Il faut donc, sur cette
  boutique-là, `products.manage` **et** `products.view`.

La recette du jour échappe à ce croisement : un total ne nomme aucun article.

La liste des produits suit la même correction : son périmètre est celui des boutiques où
`products.view` est détenu, et non celles où une ligne `ShopAccess` existe — depuis que les
droits d'entreprise y sont recopiés, une ligne existe partout.

L'écran des retraits passe par une **route dédiée** (`GET /products/removals`) et non par
un filtre de la liste : le filtrage générique ne sait pas distinguer les deux périmètres,
et l'appliquer aurait caché à qui gère le site les annonces des boutiques qu'il ne consulte
pas.

**L'endroit regardé choisit laquelle des deux listes s'affiche** : la boutique en ligne
montre les annonces à dépublier, une boutique physique les vêtements à y décrocher, et
« Tout » les deux. Le droit dit ce qu'on a le droit de voir, le lieu ce qu'on peut y
faire — montrer l'autre liste ferait apparaître une corvée qu'on ne peut pas traiter là.

Les deux listes de retrait sont **séparées et non fusionnées** : ce ne sont ni les mêmes
gestes ni les mêmes personnes. Le droit ne décide pas seulement si on voit la liste, mais
**laquelle** — montrer à qui gère le site des vêtements à décrocher ferait apparaître une
corvée que personne ne prendrait. Une liste présente mais vide veut dire « rien à faire » ;
une liste absente veut dire « ce n'est pas votre travail ».

Les droits sont indépendants : quelqu'un peut gérer le stock sans connaître les
marges, et tenir la caisse sans voir ni l'un ni l'autre. Le **taux de retour** relève de
`stats.view` et non de `stock.view` : il ne dit pas ce qu'il y a en boutique, mais si les
dépôts qu'on accepte se vendent — un jugement sur la sélection, du même ordre que la marge. Un bloc absent de la réponse
n'est pas une panne, c'est un droit qui manque — ne jamais le renvoyer « pour que
l'interface le masque », la réponse HTTP est lisible par son destinataire.

**La boutique en ligne est un choix du sélecteur, au même rang qu'une boutique physique**
(`?channel=online`, exclusif de `?shopId=`) : elle a ses ventes, son stock annoncé, sa
vente rapide et ses retraits. Deux filtres différents, et il ne faut pas les confondre :

- une **vente passée** se reconnaît au flag de son statut, `isOnlineSale`, qui ne bouge
  plus ;
- le **stock annoncé** est un état courant, `isOnline`.

Filtrer l'historique sur `isOnline` ferait disparaître les ventes d'hier au fur et à
mesure que les retraits sont confirmés — l'annonce tombe à ce moment-là. Le **taux de
retour** est volontairement absent quand un canal est choisi : un article rendu n'a été
vendu nulle part, le filtrer par canal donnerait toujours zéro.

Sans boutique précisée, un employé ne voit que les boutiques où il détient le droit
concerné, plus le stock central : une permission accordée sur une boutique ne doit pas
livrer les chiffres des autres. Avec `?shopId=`, le droit doit être détenu **sur cette
boutique-là** — le garde de route ne peut plus s'en charger. Le sélecteur de boutique
appartient au **tableau de bord seul** et y est posé, pas dans l'en-tête : il ne gouverne
que cet écran, et la liste des produits a son propre filtre boutique dans sa barre de
filtres. Il écrit son choix dans l'URL, lue côté serveur ; l'API applique la restriction de
son côté, elle ne fait pas confiance à l'écran.

**`online.manage` est un métier à part, pas un sous-ensemble.** Une personne peut n'avoir
que lui : elle publie un article sur le site, fixe son prix en ligne, et enregistre une
vente en ligne — sans pouvoir modifier le vêtement ni vendre au comptoir. D'où deux
conséquences :

- **Publier passe par une route dédiée** (`PUT /products/:id/online`), pas par
  `PUT /products/:id` qui exige `products.manage` et ouvrirait le nom, la description et
  le prix boutique.
- **Le changement de statut accepte `products.changeStatus` OU `online.manage`**, puis le
  **service** vérifie qu'un utilisateur qui n'a que le second ne vise qu'un statut portant
  `isOnlineSale`. Le garde ne peut pas trancher : le statut visé est dans le corps de la
  requête, pas dans l'URL. Même partage que le `?shopId=` du tableau de bord.

**Créer et modifier ne se séparent pas** : `products.manage` couvre les deux. Les
distinguer produisait un état cassé — un employé créait un article et ne pouvait plus en
corriger la faute de frappe. `products.delete` (irréversible) et `products.changeStatus`
(c'est la vente) restent des droits à part.

**Une route qui fait deux choses les exige toutes les deux** : `@RequirePermission` est
variadique et cumule. Créer un contrat de dépôt crée aussi les produits qui y figurent,
d'où `@RequirePermission('deposits.manage', 'products.manage')` — n'exiger que le premier
en faisait une porte dérobée vers la création de produits. Ce lien n'a rien d'évident vu
de l'écran : partout où il se manifeste — bouton masqué, page refusée, case à cocher des
accès — il doit être **écrit**, sinon le refus passe pour une panne.

**`@RequireAnyPermission` pour une lecture qu'un second droit rend indispensable** : la
liste des déposants s'ouvre à `depositors.manage` **ou** `deposits.manage`, parce qu'on ne
peut pas ouvrir un contrat sans choisir le déposant qu'il lie. Écrire un déposant reste
réservé à `depositors.manage` — gérer des contrats ne donne pas le droit de corriger un
IBAN.

**Statuts** : aucune permission, parce qu'il n'y a plus rien à autoriser — seule la
lecture subsiste, et elle est ouverte à tout utilisateur de l'entreprise. N'ajoute pas de
route d'écriture sans qu'un écran l'appelle : une route sans appelant est une surface
offerte pour rien.

## Export CSV

- Endpoint d'export du stock produits, avec les **mêmes filtres** que la liste (catégorie,
  boutique, statut, typeVente, recherche texte, plage de dates).
- Colonnes fixes : référence, catégorie, boutique, nom, description, commentaire, statut,
  typeVente, prixAchat, prixVente, prixVendu, dateVente, déposant (nom du client si
  DEPOT_VENTE), commissionAppliquee, deposantPaye, enLigne, prixEnLigne, retraitAFaire.
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
- **Toute date affichée passe par `apps/web/lib/dates.ts`**, jamais par un
  `toLocaleDateString` direct. Le serveur Next tourne en UTC et le navigateur dans le
  fuseau de son utilisateur : sans `timeZone` explicite, les deux écrivent des heures
  différentes et React refuse l'hydratation. Le fuseau d'affichage est celui de la
  **boutique** (`SHOP_TIMEZONE`), pas celui du lecteur — une vente encaissée à 23 h 30 à
  Paris appartient à cette soirée-là, y compris relue d'ailleurs. La constante existe des
  deux côtés (`apps/api/src/stats/today.ts` et `apps/web/lib/dates.ts`) et les deux
  doivent bouger ensemble.
- Un **jour calendaire** (`AAAA-MM-JJ`, ce que renvoie l'API pour `today.date` et
  `byDay`) n'est pas un instant : il se formate avec `formatCalendarDay`, qui le lit à
  midi UTC pour qu'aucun décalage ne le fasse glisser sur la veille ou le lendemain.
- **Un seul service est exposé en production**, `web`, et c'est le navigateur qui le
  décide : il ne parle jamais à l'API. Photos, PDF de contrat et export CSV passent par
  des route handlers Next qui rattachent le jeton depuis le cookie `httpOnly`. L'API,
  PostgreSQL et MinIO restent en `expose:` sur le réseau interne — jamais en `ports:`.
  C'est pour cette raison que `main.ts` n'appelle pas `enableCors()` : aucune requête ne
  traverse d'origine. Donner un domaine à l'API imposerait de l'ajouter.
- **Les migrations s'appliquent au démarrage du conteneur `api`** (`prisma migrate deploy`
  avant Nest), et sa sonde `/health` ne passe au vert qu'ensuite. Rien à lancer à la main
  après un déploiement.
- **`SHOP_TIMEZONE` doit être posée explicitement en production**, sur `api` comme sur
  `web` : les conteneurs tournent en UTC, et le défaut `Europe/Paris` des deux constantes
  ne se voit que dans le code. Une vente de 23 h 30 basculerait sinon au lendemain.
- Écrire les tests au fur et à mesure n'est pas demandé pour le MVP, sauf mention
  contraire dans un prompt d'étape.

## Tenir la documentation à jour

**Toute fonctionnalité ajoutée, modifiée ou retirée met à jour la documentation dans le
même mouvement** — pas « plus tard », pas dans un commit de rattrapage. Une doc fausse
coûte plus cher que pas de doc : elle se lit comme vraie. Le `README.md` décrivait encore
`estVente`, `bloqueVente` et `/dashboard/products/nouveau` des semaines après la
traduction du code en anglais, et annonçait « aucune route n'exige encore de permission
fine » alors que toutes en portaient.

Ce qui est concerné, dans l'ordre :

| Fichier            | Quand le toucher                                                          |
| ------------------ | ------------------------------------------------------------------------- |
| `CLAUDE.md`        | Une **règle métier** change, ou une convention de code                    |
| `README.md`        | Un écran, une route, un comportement visible change — et son pourquoi     |
| `.claude/memoire/` | Un repère de code se déplace, une commande ou un piège d'outillage change |

`.claude/memoire/` contient des notes écrites **pour Claude**, versionnées avec le code :
une carte de la doc, l'outillage, et les modules qui concentrent une règle. Elles ne
redisent pas `CLAUDE.md` ni le `README.md` — elles disent où aller chercher, et ce qui ne
se trouve nulle part ailleurs. Les relire avant de fouiller le code fait gagner du temps ;
les laisser mentir en fait perdre.

Le réflexe : avant de considérer une tâche terminée, se demander **ce qu'un lecteur de la
doc croirait encore à tort**.

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

- **Versions en tags `vX.Y.Z`** (semver), posés par `make deploy` : le script calcule le
  bump depuis les commits conventionnels et le présélectionne, l'humain valide. Tant que la
  version majeure est `0`, un breaking change ne bump que le mineur.
- **Poser un tag, c'est déployer la production** — `release.yml` s'y déclenche. D'où les
  garde-fous de `make deploy` : la branche est comparée à son équivalent GitHub et une
  désynchronisation refuse, parce que ce qui se déploie est le commit tel que GitHub le
  connaît. Un tag hors `main`, ou hors du motif `vX.Y.Z`, se pose mais ne déploie rien, et
  le script le dit avant de valider.
- **`make check` avant une PR** — client Prisma, format, lint, types, dérive Prisma,
  tests, build. C'est exactement ce que lance la CI ; ne recopie jamais ces commandes
  ailleurs, appelle la cible.
- **`make check-fast` à chaque push**, lancé par le hook `pre-push` : le même jeu sans les
  tests ni le build, une minute et demie au lieu de trois. Le partage n'est pas une
  question de temps mais de filet : la CI rejoue tests et build sur chaque PR, tandis
  qu'une dérive Prisma ne se manifeste qu'au prochain clone. C'est un **sous-ensemble
  strict** de `check` — n'y mets jamais une vérification que `check` ne lance pas, sinon
  les deux divergent et un `check-fast` vert ne veut plus rien dire.
- **La cible doit se suffire à elle-même.** `apps/api/src/generated/` est ignoré par git :
  sur un dépôt fraîchement cloné il n'existe pas, et sans lui chaque type Prisma devient
  un type d'erreur — mille « Unsafe ... of a type that could not be resolved » au lint, et
  une API qui ne démarre pas. Invisible en local, où le dossier traîne d'une génération
  précédente. `make check` et `make check-fast` génèrent donc le client en premier, et le
  conteneur `api` le génère à son démarrage. Toute étape supposant un artefact non
  versionné doit le produire elle-même : la CI part toujours d'un clone nu.

## Ce qui n'est PAS dans le scope pour l'instant

- Pas d'encaissement en ligne : l'application sait qu'un article est **proposé** sur le
  site et enregistre qu'il y a été **vendu**, mais ne prend aucune commande et n'encaisse
  rien. Quelqu'un coche « Vendu en ligne » et saisit le prix réellement encaissé, remise
  comprise, exactement comme au comptoir.
- Pas de place de marché (Vinted, Vestiaire…) : aucun identifiant externe, aucune
  synchronisation. Le jour venu, ce sera une table d'annonces, pas un champ de plus.
- Pas de scan de code-barres/QR (le champ `sku` existe mais n'est pas exploité).
- Pas d'OAuth Google (prévu plus tard, ne pas préparer de champs spécifiques maintenant).
- Pas de gestion de plusieurs photos par produit (une seule pour l'instant).
- Pas d'historique de mouvement produit entre boutiques (juste le champ `shopId`
  courant).
