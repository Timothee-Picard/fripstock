# Fripstock

Application de gestion de stock pour boutiques de vêtements et objets de seconde main —
achat-revente et dépôt-vente.

## Démarrage

Prérequis : Docker et Docker Compose. Node n'est **pas** nécessaire sur la machine, tout
tourne dans les conteneurs.

```bash
cp .env.example .env
make up
```

- Front : http://localhost:3000 — affiche le statut renvoyé par l'API
- API : http://localhost:3001/health
- Console MinIO : http://localhost:9001 (identifiants dans le `.env`)
- PostgreSQL : `localhost:5432`

`make` sans argument liste toutes les cibles disponibles.

| Cible                         | Effet                                                       |
| ----------------------------- | ----------------------------------------------------------- |
| `make up`                     | Démarre la stack en arrière-plan                            |
| `make down`                   | Arrête la stack, conserve les données                       |
| `make build`                  | Reconstruit les images (après un changement de dépendances) |
| `make logs`                   | Suit les logs de tous les services                          |
| `make restart`                | Redémarre les conteneurs sans reconstruire                  |
| `make ps`                     | État des conteneurs                                         |
| `make sh-api` / `make sh-web` | Shell dans un conteneur                                     |

### Après un clone

Les hooks git ne sont pas actifs par défaut sur un clone neuf :

```bash
make hooks
```

Le code est monté en volume : une modification dans `apps/api` ou `apps/web` est
rechargée à chaud, sans reconstruire l'image. Seul un changement de dépendances
(`package.json`) impose un `make build`.

## Base de données

Le schéma Prisma vit dans `apps/api/prisma/schema.prisma`. Après un premier `make up` :

```bash
make migrate   # crée et applique les migrations
make seed      # jeu de données de démonstration
```

Le seed est idempotent et crée deux comptes de démonstration, affichés à la fin :

| Compte  | Identifiants                           | Accès                                                                        |
| ------- | -------------------------------------- | ---------------------------------------------------------------------------- |
| Gérant  | `gerant@fripstock.test` / `fripstock`  | Tous les droits sur toute l'entreprise                                       |
| Employé | `employe@fripstock.test` / `fripstock` | Boutique Centre-ville : stock ; Boutique Gare : caisse — jamais `stats.view` |

Les permissions de l'employé sont volontairement partielles : tout le reste doit lui
renvoyer un 403, ce qui rend la restriction testable sans bricoler un compte à la main.

La page `/login` affiche deux boutons de connexion rapide pour ces comptes. Ils ne se
contentent que de remplir le formulaire et de le soumettre — aucune route ni action
serveur supplémentaire, donc aucune surface d'attaque en plus.

**Ces comptes n'existent qu'en développement.** Le seed refuse de s'exécuter si
`NODE_ENV=production`, et `next build` fixant toujours `NODE_ENV=production`, le bloc de
connexion rapide est éliminé de tout build de production : zéro occurrence des
identifiants dans `.next/static/`, ce que le navigateur télécharge. La seule trace
restante est une source map côté serveur, jamais servie au client.

| Cible                 | Effet                                             |
| --------------------- | ------------------------------------------------- |
| `make migrate`        | Crée et applique une migration depuis le schéma   |
| `make migrate-deploy` | Applique les migrations existantes, sans en créer |
| `make seed`           | Réinjecte le jeu de démonstration                 |
| `make studio`         | Prisma Studio sur http://localhost:5555           |

`make check-db` rejoue les migrations dans une base miroir (`fripstock_shadow`, créée
au premier démarrage de Postgres) et échoue si le schéma a dérivé — c'est-à-dire si
quelqu'un a modifié `schema.prisma` sans générer la migration correspondante.

Prisma 7 ne lit plus l'URL de connexion depuis le schéma : elle est dans
`apps/api/prisma.config.ts`, et le client reçoit un adaptateur `@prisma/adapter-pg`.
Le client généré (`apps/api/src/generated/prisma`) n'est pas versionné, il se
reconstruit avec `npx prisma generate`.

## Authentification

L'API est protégée par un guard JWT global : toute route exige un jeton, sauf
`POST /auth/register`, `POST /auth/login` et `GET /health`, marquées `@Public()`.

Le front stocke le jeton dans un **cookie httpOnly**, jamais dans `localStorage` : il
reste illisible par le JavaScript de la page, donc une faille XSS ne peut pas
l'exfiltrer. Le navigateur ne parle d'ailleurs jamais directement à l'API — tous les
appels partent du serveur Next, qui rattache le jeton lui-même.

Trois niveaux d'autorisation, tous appliqués côté API et jamais seulement dans l'UI :

| Niveau          | Mécanisme                               | Exemple                                |
| --------------- | --------------------------------------- | -------------------------------------- |
| Authentifié     | `JwtAuthGuard` global                   | Toute route non `@Public()`            |
| Gérant          | `@ManagerOnly()`                        | Créer une boutique, inviter un employé |
| Permission fine | `@RequirePermission('products.manage')` | Créer ou modifier un produit           |

Le gérant contourne entièrement la table des permissions, une seule fois, dans le guard.
Pour un employé, `PermissionsGuard` retrouve la boutique concernée de trois façons :
un `shopId` explicite, une ressource ciblée par l'URL via
`@ShopFromResource`, ou aucune — c'est alors le stock central, et la permission
est accordée si l'employé la détient sur au moins une boutique.

`@RequirePermission` est **variadique et cumule** : une route qui fait deux choses les
exige toutes les deux. Créer un contrat de dépôt crée aussi les produits qui y figurent,
d'où `@RequirePermission('deposits.manage', 'products.manage')` — n'exiger que le premier
en faisait une porte dérobée vers la création de produits.

`@RequireAnyPermission` accepte au contraire **l'une ou l'autre**, pour une lecture qu'un
second droit rend indispensable : la liste des déposants s'ouvre à `depositors.manage`
**ou** `deposits.manage`, parce qu'on ne peut pas ouvrir un contrat sans choisir le
déposant qu'il lie. Écrire un déposant reste réservé à `depositors.manage`.

Un refus nomme le droit **tel qu'il apparaît sur l'écran des accès**, jamais sa clé
technique : « Vous n'avez pas le droit « Créer et modifier des produits » sur cette
boutique. » Une clé n'apprend pas à l'employé quoi demander à son gérant.

### Les droits

| Clé                     | Ce qu'elle ouvre                                                  |
| ----------------------- | ----------------------------------------------------------------- |
| `products.view`         | Consulter la liste et les fiches produit                          |
| `products.manage`       | Créer un article, un lot, et corriger une fiche existante         |
| `products.delete`       | Effacer un article définitivement                                 |
| `products.changeStatus` | Encaisser au comptoir, déplacer un article d'un statut à l'autre  |
| `categories.manage`     | Arborescence des catégories                                       |
| `attributes.manage`     | Attributs et leurs options                                        |
| `depositors.manage`     | Créer et modifier les fiches déposants                            |
| `deposits.manage`       | Contrats de dépôt, rattachements, règlements                      |
| `stats.view`            | Chiffre d'affaires, marge, panier moyen, taux de retour           |
| `stock.view`            | Nombre et valeur des articles en boutique, répartition par statut |
| `export.csv`            | Télécharger le stock au format tableur                            |

**Créer et modifier ne se séparent pas.** Les distinguer produisait un état cassé : un
employé créait un article et ne pouvait plus en corriger la faute de frappe. Supprimer
(irréversible) et vendre (c'est de l'argent) restent des droits à part.

Chaque case de l'écran des accès porte une phrase disant ce qu'elle ouvre réellement —
« Vendre et changer le statut » ne se comprend pas tout seul comme « c'est la vente ».

### Son propre compte

`/dashboard/profile` permet à chacun — gérant comme employé — de modifier son prénom, son
nom, son email et son mot de passe. Les routes correspondantes (`PUT /auth/profile`,
`PUT /auth/password`) ne prennent aucun identifiant dans l'URL : la cible est
toujours l'utilisateur du jeton.

Le mot de passe actuel est exigé pour changer le mot de passe, et pour changer l'email —
sur une session détournée, pouvoir changer l'adresse de connexion suffirait à
s'approprier le compte. Un simple renommage n'a pas cette conséquence et ne le demande
pas.

Les emails sont normalisés (minuscules, espaces retirés) **avant** validation, via
`@EmailNormalise()`. Sans ça `Alice@Test.fr` et `alice@test.fr` seraient deux comptes
distincts pour la contrainte d'unicité, et changer la casse de son propre email
empêcherait de se reconnecter.

**Limite connue** : le changement de mot de passe renvoie un jeton neuf pour que la
session courante reste valide, mais les jetons déjà émis ailleurs restent valables
jusqu'à leur expiration (7 jours). Le JWT est sans état, rien ne permet de les révoquer.
Il n'existe pas non plus de récupération par email — un employé qui oublie son mot de
passe doit être supprimé et réinvité par le gérant ; pour le gérant lui-même, il n'y a
aucun recours.

## Catalogue

Catégories et attributs sont définis **au niveau Entreprise** et partagés par toutes ses
boutiques — jamais par boutique. Les routes d'écriture n'ont donc pas de `shopId` :
le `PermissionsGuard` applique sa règle du stock central, et la permission
(`categories.manage`, `attributes.manage`) est accordée si l'utilisateur la détient sur au
moins une de ses boutiques. La lecture est ouverte à tout utilisateur de l'entreprise.

Deux écrans : `/dashboard/categories` (arbre, avec sélecteur de parent) et
`/dashboard/attributes`.

**L'association se pilote depuis la catégorie**, sur `/dashboard/categories` : chaque
catégorie déclare les attributs qui seront demandés à la création d'un produit. C'est le
sens dans lequel on lit un catalogue — « une robe a une taille et une couleur » — et non
l'inverse.

Attention au contresens que ce nom peut induire : `CategoryAttribute` n'est **pas** une
possession. Les valeurs appartiennent au produit (`AttributeValue`,
`ProductAttributeOption`) ; cette table dit seulement quels attributs le formulaire
produit propose, et lesquels l'API accepte, pour un produit de cette catégorie.

L'API expose les deux directions — `PUT /categories/:id/attributes` (utilisée par l'écran)
et `PUT /attributes/:id/categories` — sur la même table et avec la **même permission**
`attributes.manage` : deux chemins vers la même écriture ne peuvent pas coûter des droits
différents, sinon l'un contourne l'autre.

**L'association attribut ↔ catégorie est directe, sans héritage.** Rattacher « Taille » à
« Vêtements » ne la donne pas à « Robe ». C'est ce que décrit `CLAUDE.md` (« Sac peut ne
pas avoir Taille, Robe l'aura ») et ce que fait le seed. Si l'héritage devient
souhaitable, il ne concerne qu'une requête — mais il faudra d'abord trancher si une
sous-catégorie peut retirer un attribut hérité.

**Les options d'un attribut s'éditent en une seule opération.** `PUT /attributes/:id/options`
reçoit la liste complète et ordonnée : les entrées sans `id` sont créées, celles qui en
ont un sont renommées, les absentes sont supprimées, et l'ordre du tableau devient
l'ordre affiché. Un seul appel atomique couvre ajout, renommage, réordonnancement et
suppression — et c'est exactement ce que fait l'écran. Une option encore utilisée par un
produit ne peut pas être retirée.

**Le type d'un attribut n'est pas modifiable** après création : des valeurs produit
s'appuient dessus, transformer un « choix unique » en « nombre » laisserait des valeurs
orphelines et intraduisibles.

Un attribut cloné depuis un modèle est **totalement indépendant** : le renommer ou
changer ses options n'affecte ni le modèle global ni les autres entreprises.

## Produits

Cinq écrans : la liste filtrée (`/dashboard/products`), la création
(`/dashboard/products/new`), l'achat en lot (`/dashboard/products/lot`), la fiche
(`/dashboard/products/:id`) et sa modification (`.../edit`).

**La référence est générée** si elle n'est pas saisie : `A-0042` pour un article acheté,
d'après un compteur d'entreprise ; `D-MAR-001` pour un article déposé, d'après le code du
déposant et un compteur qui lui est propre, reparti à 1. Les compteurs sont incrémentés
**par la base** dans la transaction de création — un `max + 1` lu puis réécrit donnerait
le même numéro à deux employés simultanés.

**Une référence ne change jamais toute seule** : elle est écrite sur l'étiquette collée au
vêtement. Rattacher un article à un contrat de dépôt propose la renumérotation, décochée
par défaut, puisqu'elle oblige à refaire l'étiquette. Un numéro libéré n'est jamais
réattribué : une vieille étiquette ne doit pas désigner un jour un autre article.

**L'achat en lot** répartit un prix payé entre plusieurs articles, au prorata de leur prix
de vente. Sans aucun prix, la répartition est égale ; s'il en manque un, l'article manquant
compte pour la moyenne des autres. La répartition est exacte au centime (plus forts restes)
et vit à un seul endroit, `lot-split.ts`, en double côté API et côté web — l'écran en
montre l'aperçu, l'API fait foi.

**La liste se trie et se filtre** par référence, nom, prix et statut, par catégorie,
boutique, statut, type de vente, client déposant et plage de dates. Le tri des statuts
suit leur position dans le flux, pas leur libellé : « En stock » avant « Vendu » a un sens,
l'ordre alphabétique n'en a aucun. Un second critère sur l'identifiant ferme le tri — à
prix égal, sans lui, un article pourrait apparaître sur deux pages et un autre sur aucune.
Tri et filtres vivent dans l'URL, et l'export les reprend tous.

**Consultation et modification sont le même composant**, avec un mode. Le libellé, la
place et l'espacement de chaque donnée ne bougent pas d'un écran à l'autre : seul le
contenu devient saisissable. C'est la seule façon de garantir que les deux se ressemblent
— les tenir alignés à la main dérive au premier changement. Les deux occupent toute la
largeur disponible. Chaque ligne de la liste porte trois icônes — voir, modifier, supprimer —
avec libellé en infobulle et pour les lecteurs d'écran. Le changement de statut se fait
depuis la fiche, où l'on voit ce qu'on change.

**Corriger une vente déjà enregistrée** (prix encaissé, date, commission) se fait depuis la
fiche, par `PUT /products/:id/sale`. C'est volontairement distinct du changement de
statut : on rectifie une saisie, on ne fait pas franchir une étape au produit, et
l'historique ne bouge pas. Un produit dont le statut n'est plus un statut de vente — rendu
au client, retiré — n'est pas corrigeable, conformément à la règle `blocksSale` de
`CLAUDE.md`. La commission n'apparaît qu'en dépôt-vente. Les filtres vivent
dans l'URL, donc la vue reste partageable et le retour arrière fonctionne.

**Le formulaire s'adapte à la catégorie** : les champs d'attributs sont chargés depuis
`GET /categories/:id/attributes` dès qu'une catégorie est choisie — on ne demande pas la
taille d'un sac. L'API applique la même règle et refuse un attribut inapplicable :
l'affichage n'est qu'un confort, la validation est côté service.

**Toute la logique de vente repose sur les flags de `Status`, jamais sur le libellé.** Un
statut `isSale` exige un prix vendu et refuse le changement si le statut actuel porte
`blocksSale` ; un statut ordinaire refuse au contraire prix vendu et date de vente. Le
gérant pouvant renommer ses statuts, un test vérifie que le blocage tient après
renommage.

Le champ « encaissé » est **pré-rempli** avec le prix déjà encaissé, sinon celui de
l'étiquette : dans la plupart des ventes il n'y a rien à corriger, seulement à confirmer.
On ne le retape que si le prix a été négocié.

Au passage à un statut de vente, la commission du contrat est **copiée** dans
`Product.appliedCommission`. Relevé, export et statistiques liront cette copie, jamais
celle du contrat — sinon modifier un contrat réécrirait des relevés déjà réglés.

### Statuts

**Les statuts sont des rouages internes, et aucun écran ne les expose.** Les six statuts
et leurs 16 transitions sont posés à la création de l'entreprise et ne bougent plus : ni
créés, ni supprimés, ni renommés. L'API n'en garde que la lecture (`GET /statuses`), dont
la liste des produits, leur fiche et leur changement de statut ont besoin.

Un écran de visualisation du flux a existé, puis a été retiré : il donnait à voir de la
plomberie. Ce qui compte d'un statut n'est pas son nom mais le **comportement porté par
ses flags**, et ce comportement se lit là où il agit — sur la fiche produit, dans les
cibles proposées au changement de statut, dans les chiffres du tableau de bord.

Le repli permissif reste dans le code — **sans aucune transition, tous les passages sont
permis** — parce qu'une entreprise créée avant cette table n'en a pas, et qu'un graphe vide
bloquerait tout son stock. Imposer un graphe vide bloquerait le stock de toutes les
entreprises existantes, et un gérant qui oublie une flèche coincerait la sienne. Dès la
première flèche enregistrée, seuls les chemins tracés sont acceptés — et un statut sans
flèche sortante devient un point d'arrivée.

Les règles de flags s'appliquent **par-dessus** le flux, jamais à la place : tracer une
flèche vers un statut de vente ne permet pas de vendre un produit déjà « rendu au client ».
Les listes de changement rapide ne proposent que les cibles atteignables, mais l'API refait
les deux contrôles — l'affichage n'est qu'un confort. Les trois flags comportementaux (`isSale`, `blocksSale`,
`leavesStock`) se fixent à la création et **ne sont plus modifiables** : des produits
s'appuient dessus, les basculer sous eux réécrirait leur histoire métier.

L'unicité de `isDefault` est tenue par une route dédiée (`PUT /statuses/:id/default`)
qui remet les autres à `false` dans une transaction — un index unique Prisma sur
`[companyId, isDefault]` interdirait aussi deux `false`.

### Photos

Le bucket MinIO **n'est pas public**. Une balise `<img>` ne peut pas porter d'en-tête
`Authorization`, donc le navigateur passe par `/api/photos/…` côté Next, qui lit le cookie
httpOnly et rattache le jeton. Aucune URL de stockage n'est exposée, et une photo reste
inaccessible sans session.

Le type est vérifié sur les **premiers octets du fichier**, pas sur le `mimetype` déclaré
par le navigateur : n'importe qui peut annoncer `image/png` en envoyant autre chose. La
clé d'objet est préfixée par l'entreprise, ce qui cloisonne aussi le stockage.

## Dépôt-vente

Deux écrans : `/dashboard/depositors` (déposants et leur relevé) et
`/dashboard/deposit-contracts` (contrats, rattachement des produits).

Le déposant porte une `defaultCommission` qui n'est **qu'une valeur de départ** : elle
pré-remplit le champ à la création d'un contrat, puis c'est le contrat qui fait foi — et
c'est sa commission que la vente fige. Le formulaire l'écrit, et affiche en direct la part
qui reviendra au déposant à mesure qu'on saisit le pourcentage.

**Le sens de la commission est la chose à ne pas se tromper** : le pourcentage est la part
que _garde la boutique_. `commission = 40` sur un article vendu 100 € donne 40 € à la
boutique et 60 € au déposant. L'interface le rappelle partout où le champ apparaît, parce
que la lecture inverse est tout aussi naturelle et fausserait chaque relevé.

Le relevé lit `Product.appliedCommission`, **figée à la vente**, jamais celle du contrat :
modifier un contrat ne réécrit donc pas un relevé déjà réglé. Un produit y compte comme
vendu si son statut porte `isSale` — jamais sur son libellé.

**Un contrat se saisit avec ses articles, en une passe**, sur un tableau compact — une
ligne par article, les colonnes d'une fiche produit. Contrat et articles partent ensemble
et sont écrits dans la même transaction : une ligne refusée n'enregistre rien, plutôt que
de laisser derrière elle un contrat vide que personne n'a demandé.

Un contrat **doit porter au moins un article**. On ne fait pas signer un déposant pour
rien, et le relevé qui en découlerait serait vide. C'est aussi pourquoi ouvrir un contrat
exige `products.manage` en plus de `deposits.manage` — l'écran l'écrit, plutôt que de
faire disparaître le bouton sans un mot.

**Un produit n'appartient qu'à un contrat à la fois.** Le rattacher à un second est
refusé : le déplacer en silence le retirerait du relevé du premier déposant. Et un produit
déjà vendu ne peut plus être détaché ni rattaché ailleurs — sa commission a été figée
d'après le contrat d'alors, le déplacer falsifierait un relevé.

Le règlement du déposant est un simple drapeau coché depuis la fiche produit — paiement en
espèces, l'application ne gère aucun encaissement.

### Alertes d'échéance

Un job quotidien (`DeadlinesJob`, 7 h) fait deux choses en une passe sur les contrats
`ACTIVE` : il crée une `Notification` quand `endDate - notifyBeforeDays` est atteint, et il
bascule en `EXPIRED` les contrats échus — sans quoi rien ne sortirait jamais de `ACTIVE`.

`notifiedAt` empêche de renotifier chaque jour jusqu'à l'échéance ; repousser une date de
fin le remet à zéro, pour qu'un contrat prolongé puisse alerter à nouveau.
`POST /deposit-contracts/deadlines` (gérant) déclenche la passe à la main — attendre le
lendemain pour vérifier qu'une alerte part serait absurde.

`DepositContract` n'ayant pas de `companyId`, le job remonte l'entreprise via
`depositor.companyId` pour créer la notification au bon endroit.

**Limite connue** : les notifications appartiennent à l'entreprise, pas à un utilisateur.
Marquer une alerte comme lue la masque pour tout le monde.

## Statistiques et export

`/dashboard` affiche le tableau de bord : la recette du jour, le comptoir de vente, puis
les chiffres de la période — chiffre d'affaires, marge boutique, panier moyen, stock actif
et taux de retour, avec la courbe des ventes, la répartition du stock par statut et les
meilleures ventes. Période et boutique vivent dans l'URL, donc la vue est partageable.

**Aucune permission unique ne gouverne cet écran** : la route `/stats/dashboard` ne porte
pas de `@RequirePermission`. Trois droits y ouvrent des blocs distincts, et le service
n'envoie **que** ceux auxquels l'utilisateur a droit :

| Bloc                                                         | Droit                                       |
| ------------------------------------------------------------ | ------------------------------------------- |
| CA, marge, panier moyen, courbe, classements, taux de retour | `stats.view`                                |
| Stock actif et sa valeur, répartition par statut             | `stock.view`                                |
| Recette du jour (sans la marge)                              | `stats.view` **ou** `products.changeStatus` |

Les deux droits sont indépendants : quelqu'un peut gérer le stock sans connaître les
marges, et tenir la caisse sans voir ni l'un ni l'autre. Un bloc absent de la réponse n'est
pas une panne, c'est un droit qui manque — le renvoyer « pour que l'interface le masque »
laisserait la marge dans une réponse HTTP lisible par son destinataire.

Sans boutique précisée, un employé ne voit que les boutiques où il détient le droit
concerné, plus le stock central. Avec `?shopId=`, le droit doit être détenu **sur cette
boutique-là** — le garde de route ne peut plus s'en charger.

Le sélecteur de période ne s'affiche pas au-dessus du seul stock : celui-ci est une photo
de l'instant, sa requête ne porte aucune borne de date, et proposer « 7 jours / 3 mois »
promettrait un filtre qui ne filtre rien.

### Le comptoir

Le tableau de bord porte de quoi encaisser plusieurs articles d'un coup — le cas d'un
client qui arrive avec cinq vêtements. On saisit une référence (ou un début de nom, avec
autocomplétion sur la boutique sélectionnée, navigable au clavier), on ajoute au panier, et
on encaisse.

La remise se négocie **sur le total** : la différence est répartie entre les articles au
prorata, au centime près, par la même fonction que l'achat en lot. Chaque article peut
aussi être renégocié seul. Le passage en vente fige la commission de chaque article et
alimente le relevé de son déposant.

**Le CA est calculé sur `soldPrice`**, ce qui est réellement entré en caisse, jamais sur
`salePrice` qui n'est que l'étiquette. La **marge boutique** est affichée à côté, et c'est
la seule comparable entre les deux modes de vente : `soldPrice - purchasePrice` en
achat-revente, `soldPrice × appliedCommission / 100` en dépôt-vente, où l'essentiel du
prix revient au déposant.

Vendu, stock actif et retour se déterminent par les **flags de `Status`** — `isSale`,
`leavesStock`, `blocksSale` — jamais par le libellé : les chiffres restent justes après un
renommage.

### Export CSV

`GET /products/export` (permission `export.csv`) applique **exactement les mêmes filtres
que la liste** — le service partage la même construction de filtre, sinon « exporter ce
qu'on voit » deviendrait un mensonge. La pagination est ignorée : un export ne s'arrête pas
à la page en cours.

Séparateur `;` et UTF-8 **avec BOM**, sans quoi Excel en français ouvre « Matière » en
« MatiÃ¨re » et tasse tout dans une colonne. Les décimales passent en virgule.

Colonnes fixes, puis **une colonne par attribut réellement présent dans le résultat** :
exporter des sacs ne traîne pas de colonne « Taille » vide.

Les cellules commençant par `=`, `+`, `-` ou `@` sont préfixées d'une apostrophe :
sans ça, une référence saisie `=1+1` s'exécuterait à l'ouverture, et `=HYPERLINK(...)` est
un vecteur d'exfiltration connu.

Le téléchargement passe par `/api/export` côté Next : un lien ne peut pas porter d'en-tête
`Authorization`, et le jeton vit dans un cookie httpOnly.

## Navigation

Le menu de gauche reste visible quand la page défile (`sticky`, pas `fixed` : il garde sa
place dans la rangée, le contenu n'a donc pas à compenser sa largeur par une marge qui
devrait suivre le repli). Il se replie sur ses seules icônes, et le choix passe par un
**cookie** et non `localStorage` — le serveur le lit au rendu, donc le menu ne s'affiche
jamais déplié une fraction de seconde avant de se replier.

L'identité et la déconnexion sont en bas du menu : le nom mène au profil, ce qui rendait
l'entrée « Mon profil » redondante. Les alertes restent dans l'en-tête, à droite — elles
concernent la page, pas la navigation. L'en-tête nomme la section courante ; les pages
d'index ne le répètent donc plus, et une sous-page garde son propre titre, plus précis.

Sous 640 px la colonne de gauche est masquée faute de place : un panneau en superposition
s'ouvre depuis l'en-tête et se referme dès qu'on a choisi, sans quoi il masquerait l'écran
demandé.

Le menu ne propose que ce qui aboutira : une entrée dont la permission manque n'est pas
affichée, et le filtrage se fait **côté serveur** plutôt qu'en masquant une liste complète
envoyée au client.

## Contribuer

### Convention de commit

Les messages suivent [Conventional Commits](https://www.conventionalcommits.org/),
appliqués par un hook `commit-msg` :

```
feat(produits): bloque la vente d'un produit rendu au client
fix(api): scope les contrats de dépôt via client.companyId
```

Sujet sur **une seule ligne, 72 caractères maximum**, en minuscule, à l'impératif,
sans point final. Corps facultatif après une ligne vide, pour le _pourquoi_ d'un choix
non évident. Types : `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`,
`build`, `ci`, `chore`, `revert`.

Contre-exemples refusés : `wip`, `Ajoute la vente.` (majuscule et point final),
ou un sujet de plus de 72 caractères.

### Avant de pousser

```bash
make check
```

Génération du client Prisma, format, lint, typage, dérive du schéma, tests et build des
deux apps — exactement ce que lance la CI. **À passer avant d'ouvrir une PR.**

Le hook `pre-push` n'exécute pas celle-là mais `make check-fast` : le même jeu **sans les
tests ni le build**, soit une minute et demie au lieu de trois. Ce n'est pas un
allègement au jugé — c'est le partage entre ce qui a un filet et ce qui n'en a pas. Un
test rouge, la CI le rattrape en trois minutes et il coûte un commit de rattrapage ; une
migration absente du dépôt, elle, ne se manifeste qu'au prochain clone, et on la cherche
alors ailleurs. `check-fast` garde donc la dérive Prisma, le typage et le lint, et laisse
partir ce que la CI rejoue de toute façon.

`check-fast` est un **sous-ensemble strict** de `check` : il ne redéfinit rien, il
n'énumère que des cibles que `check` lance déjà. Une vérification ajoutée à l'une n'a
jamais à être recopiée dans l'autre.

La cible **se suffit à elle-même**, et c'est la règle : `apps/api/src/generated/` est
ignoré par git, donc absent d'un clone frais. Sans lui, chaque type Prisma devient un type
d'erreur — mille « Unsafe … of a type that could not be resolved » au lint, et une API qui
ne démarre pas. Invisible en local, où le dossier traîne d'une génération précédente ;
fatal en CI. Toute étape supposant un artefact non versionné doit donc le produire
elle-même.

| Cible                               | Effet                                            |
| ----------------------------------- | ------------------------------------------------ |
| `make check`                        | Toutes les vérifications — ce que lance la CI    |
| `make check-fast`                   | Sans tests ni build — ce que lance le `pre-push` |
| `make check-format` … `check-build` | Une vérification isolée                          |
| `make format`                       | Reformate tout le dépôt                          |
| `make install`                      | Réinstalle les dépendances et pose les hooks     |

Les hooks se contournent avec `--no-verify` : ils sont là pour le retour rapide,
**la CI est le seul filet qui ne se contourne pas**. Les deux lancent des
cibles `make`, jamais des commandes recopiées.

**Angle mort à connaître** : la CI se déclenche sur les push vers `main` et sur les pull
requests. Une branche de travail poussée **sans PR ouverte** ne déclenche rien — ses tests
et son build ne tournent donc nulle part tant que la PR n'existe pas, puisque le
`pre-push` ne les lance plus.

Les cibles passent par `scripts/node-run.sh`, qui exécute **toujours dans les
conteneurs** dès que Docker est disponible — même si Node est installé sur la machine.
Ce n'est pas un excès de prudence : les `node_modules` du dépôt sont installés par les
images Alpine, et leurs binaires natifs (le swc de Next, par exemple) sont en musl,
illisibles par la glibc de l'hôte. Les lancer localement échoue sur un
`invalid ELF header`, et les dossiers de build montés (`.next`, `dist`) appartiennent
à root.

La CI, elle, installe ses dépendances nativement : elle pose `FRIPSTOCK_RUNNER=local`
pour court-circuiter Docker et lancer les mêmes cibles directement.

### Publier une version

```bash
make release
```

Le script lit les commits depuis le dernier tag, en déduit le bump
(`feat` → mineur, `fix` → patch, `!` ou `BREAKING CHANGE` → majeur) et te le
propose — Entrée pour accepter, ou `M`/`m`/`p` pour forcer. Il génère le
`CHANGELOG.md`, pose un tag annoté `vX.Y.Z` et demande confirmation avant de
pousser. Le tag déclenche la création de la release GitHub.

Tant que la version majeure est `0`, un breaking change ne bump que le mineur —
le script le signale au lieu de le faire en silence.

## Organisation du dépôt

```
apps/
├── api/       API NestJS (TypeScript strict, Prisma, class-validator)
└── web/       Front Next.js (App Router, TypeScript, Tailwind)
docker-compose.yml   postgres, minio, api, web
Makefile             raccourcis de développement et vérifications
scripts/             node-run.sh, check-db.sh, release.sh
.githooks/           commit-msg, pre-commit, pre-push
.github/workflows/   CI et publication des releases
prompts/             archive des prompts ayant servi à construire l'app
docs/KIT.md          documentation du kit de démarrage
.claude/             agents, skills, hooks, et memoire/ (notes pour Claude Code)
```

- **`CLAUDE.md`** — règles métier et conventions de code. C'est le document qui fait foi ;
  il est chargé automatiquement par Claude Code à chaque session.
- **`docs/KIT.md`** — comment se servir du kit de prompts et de la configuration
  `.claude/` (skills, subagents, hooks).
- **`.claude/memoire/`** — notes écrites pour Claude Code, versionnées avec le code :
  carte de la doc, outillage, et les modules qui concentrent une règle. Elles ne
  redisent pas les documents ci-dessus, elles disent où aller chercher.

## Périmètre

Le MVP est complet : authentification et permissions par boutique, catalogue, produits et
leur cycle de vie, dépôt-vente avec relevés et alertes d'échéance, statistiques et export
CSV.

Le travail porte désormais sur l'usage quotidien :
comptoir de vente multi-articles, achat en lot, saisie d'un contrat avec ses articles en
une passe, références générées, tri et filtres de la liste, découpage fin des droits sur
les chiffres, et un menu repliable avec navigation mobile.

Hors périmètre, inchangé : pas d'encaissement en ligne, pas de scan de code-barres (le
champ `sku` existe mais dort), pas d'OAuth, une seule photo par produit, et pas
d'historique de mouvement entre boutiques.
