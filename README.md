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

| Cible                             | Effet                                                       |
| --------------------------------- | ----------------------------------------------------------- |
| `make up`                         | Démarre la stack en arrière-plan                            |
| `make down`                       | Arrête la stack, conserve les données                       |
| `make build`                      | Reconstruit les images (après un changement de dépendances) |
| `make logs`                       | Suit les logs de tous les services                          |
| `make restart`                    | Redémarre les conteneurs sans reconstruire                  |
| `make ps`                         | État des conteneurs                                         |
| `make sh-api` / `make sh-web`     | Shell dans un conteneur                                     |
| `make prod-build`                 | Construit les images de production (voir « Déploiement »)   |
| `make prod-up` / `make prod-down` | Stack de production en local, isolée du dev                 |

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

| Clé                     | Ce qu'elle ouvre                                                    |
| ----------------------- | ------------------------------------------------------------------- |
| `products.view`         | Consulter la liste et les fiches produit                            |
| `products.manage`       | Créer un article, un lot, et corriger une fiche existante           |
| `products.delete`       | Effacer un article définitivement                                   |
| `products.changeStatus` | Encaisser au comptoir, déplacer un article d'un statut à l'autre    |
| `categories.manage`     | Arborescence des catégories                                         |
| `attributes.manage`     | Attributs et leurs options                                          |
| `depositors.manage`     | Créer et modifier les fiches déposants                              |
| `deposits.manage`       | Contrats de dépôt, rattachements, règlements                        |
| `stats.view`            | Chiffre d'affaires, marge, panier moyen, taux de retour             |
| `stock.view`            | Nombre et valeur des articles en boutique, répartition par statut   |
| `online.manage`         | Publier un article sur le site, fixer son prix web, vendre en ligne |

**Cinq droits portent sur l'entreprise, pas sur une boutique** : `categories.manage`,
`attributes.manage`, `depositors.manage`, `deposits.manage` et `online.manage`. Le
catalogue, les déposants et le site sont uniques — il n'y a pas une arborescence de
catégories par boutique, ni un site par boutique. Les cocher sur **une** boutique les
accorde partout, y compris sur un produit rattaché à une autre. La liste fait foi dans
`COMPANY_PERMISSIONS`, et chaque droit exigé par une route est évalué selon **sa propre**
règle : mêler un droit de boutique et un droit d'entreprise sur la même route ne doit pas
rabattre le second sur la boutique visée.

**L'écran des accès le montre tel quel** : les droits d'entreprise se cochent **une fois**,
dans un bloc à part, et les droits de boutique restent dans le cadre de chaque boutique.
Les répéter boutique par boutique laissait croire qu'on pouvait les y limiter, ce qui est
faux. À l'enregistrement, un droit d'entreprise est recopié sur **toutes** les boutiques :
`ShopAccess` n'a pas d'autre endroit où le poser, et c'est ce qui le rend vrai partout —
le garde le cherche « sur au moins une boutique », et le service laisse alors son porteur
travailler sur un article de n'importe laquelle.
| `export.csv` | Télécharger le stock au format tableur |

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

**Supprimer le compte, c'est supprimer l'entreprise.** `DELETE /auth/account` est
réservée au gérant (`@ManagerOnly()`) : un gérant n'a qu'une entreprise, et la lui retirer
sans retirer l'entreprise laisserait ses employés enfermés dans des données que plus
personne ne peut administrer. Un employé, lui, est supprimé par son gérant depuis
`/dashboard/users` — l'écran du profil le lui **écrit**, plutôt que de masquer un bouton
qui passerait pour une panne.

Le mot de passe est réexigé, comme pour un changement d'email, et la confirmation est une
vraie modale (`components/confirm-dialog.tsx`) et non le `window.confirm()` employé
partout ailleurs : ici il n'y a rien à recréer, et la confirmation doit **montrer** ce qui
part. `GET /auth/account` renvoie les chiffres qu'elle affiche — « 3 boutiques,
128 produits, 6 contrats de dépôt » plutôt que « tout ». Ce qui est à zéro ne se dit pas.

Deux pièges de cascade se cachent dans cette suppression, et le service les prend dans
l'ordre : les **produits d'abord**, parce que leur catégorie et leur statut sont en
`onDelete: Restrict` et qu'une cascade partie de l'entreprise buterait dessus ; puis les
**catégories des feuilles vers la racine**, parce que `parentId` est en `Restrict` et que
Postgres le vérifie ligne à ligne — y compris quand l'enfant disparaît dans la même
commande. Le reste tombe en cascade. Côté web, le cookie de session est vidé avant la
redirection vers `/login` : le garder ferait échouer chaque écran sur un 401.

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

### Le catalogue de départ

**Une entreprise neuve arrive avec un catalogue, pas avec un écran vide.** L'inscription
pose, dans la transaction de création, huit attributs (Taille, Couleur, Matière, Marque,
Occasion, Motif, Pointure, Doublé) et neuf catégories — six vêtements sous une racine
« Vêtements », plus « Sac » et « Accessoire » qui n'en sont pas — chacune rattachée aux
attributs qui la concernent. Sans ça, le premier écran utile, créer un produit, exigeait
d'aller d'abord inventer une catégorie puis ses attributs, et le formulaire refusait de
s'ouvrir en attendant.

Rien n'y est figé, contrairement aux statuts : c'est un point de départ à remanier. Le
gérant renomme, supprime, ajoute — et les entreprises existantes gardent le catalogue
qu'elles se sont fait, aucune migration de données ne leur impose celui-ci.

La liste vit à un seul endroit, `apps/api/src/catalog/catalog.defaults.ts`, parce qu'elle
sert **trois** usages : la bibliothèque globale de modèles (seed), le catalogue de
l'entreprise de démonstration (seed), et celui de toute entreprise créée par
l'inscription. Trois copies auraient dérivé. Les clones se rattachent à leur modèle
(`clonedFromTemplateId`) quand la bibliothèque est seedée, et s'en passent sinon : en
production seules les migrations tournent, la bibliothèque est vide, et le catalogue se
pose quand même.

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

**Les statuts sont des rouages internes, et aucun écran ne les expose.** Les sept statuts
et leurs 20 transitions sont posés à la création de l'entreprise et ne bougent plus : ni
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

**« Vendu en ligne » est un statut à part entière, à côté de « Vendu ».** Une vente n'a
qu'un canal, elle tient donc dans un statut — au contraire de la disponibilité, qui vaut
des deux côtés à la fois et reste un drapeau sur le produit. Le statut porte un quatrième
flag, `isOnlineSale`, et **rien d'autre n'a eu à changer** : chiffre d'affaires, marge,
relevé du déposant et commission figée lisent tous `isSale`, jamais le libellé. Une vente
en ligne est donc comptée partout, du seul fait que le statut existe.

Une conséquence à connaître : toute entreprise a désormais **deux** statuts de vente. Le
comptoir filtre donc sur `isSale && !isOnlineSale`, sans quoi chaque encaissement se
heurterait à « plusieurs statuts de vente existent, précisez lequel ».

L'unicité de `isDefault` est tenue par une route dédiée (`PUT /statuses/:id/default`)
qui remet les autres à `false` dans une transaction — un index unique Prisma sur
`[companyId, isDefault]` interdirait aussi deux `false`.

**La pastille de statut ne peint pas la couleur en aplat.** La teinte vient de la base, et
un aplat saturé obligeait à choisir entre texte blanc et texte noir selon sa luminance :
la colonne « Statut » de la liste des produits alternait donc les deux d'une ligne à
l'autre, et le contraste des six couleurs de base tombait entre 4,2 et 4,8 pour 1 — « Rendu
au client » sous le minimum AA, les autres le frôlant. La teinte devient maintenant un fond
très clair, un texte foncé de la même teinte et un liseré intermédiaire : la couleur reste
reconnaissable, le texte est toujours foncé, et l'ensemble atteint 7:1 (AAA).

La lightness du texte n'est pas une constante mais le **résultat d'une recherche** : à
valeur HSL égale un jaune est bien plus lumineux qu'un bleu, donc aucune valeur fixe ne
tient pour toutes les teintes. Le composant assombrit jusqu'à atteindre la cible, ce qui la
garantit pour n'importe quelle couleur — les tests le vérifient sur les six couleurs de
base et sur des teintes extrêmes (jaune pur, cyan, blanc, noir).

Le camembert du tableau de bord garde, lui, les couleurs pleines : ses parts sont de
grandes surfaces sans texte dessus, et des teintes pâles s'y distingueraient mal.

### Vente en ligne

Un vêtement en boutique peut être proposé **en même temps** sur le site. C'est pour ça que
la disponibilité en ligne n'est pas un statut : un produit n'en porte qu'un, alors que les
deux vitrines coexistent. `isOnline` est donc un drapeau sur le produit, et `onlinePrice`
un prix distinct — laissé vide, le site reprend le prix boutique, ce qui évite de saisir
deux fois le même montant.

La **vente**, elle, n'a qu'un canal : c'est bien un statut, « Vendu en ligne ».

**Le retrait de l'autre canal est une corvée que l'application suit**, et elle n'est pas
la même dans les deux sens. Le sens ne se stocke pas deux fois : il se déduit de
`isOnlineSale` du statut de vente.

**Vendu au comptoir** (ou rendu, ou retiré) **alors que l'annonce est publiée** : personne
côté site n'est au courant, l'article reste en vente là-bas. `pendingRemoval` se lève et
**l'annonce n'est surtout pas coupée** — la couper effacerait la seule trace de ce qu'il
reste à faire, et plus personne ne saurait quoi retirer. Elle tombe avec le drapeau, quand
quelqu'un clique « Retrait effectué ».

**Vendu par le site** : celui qui enregistre la vente est celui qui tient le site, donc
l'annonce part avec la commande et `isOnline` retombe tout seul — sans quoi un article
vendu resterait affiché parmi les articles en ligne. Il reste le vêtement à aller
décrocher, et seulement s'il est **dans une boutique** : au stock central il n'est sur
aucun portant, inventer une corvée y ferait une ligne que personne ne saurait traiter.

Ces corvées apparaissent sur le **tableau de bord**, en deux listes séparées, chacune pour
la main dont c'est le travail — les annonces à dépublier sous `online.manage`, les
vêtements à décrocher sous `products.manage`. Deux choses les filtrent : le **droit**, qui
dit ce qu'on a le droit de voir, et le **lieu choisi**, qui dit ce qu'on peut y faire. Sur
la boutique en ligne on voit les annonces à retirer, sur une boutique physique les
vêtements à y décrocher, sur « Tout » les deux. Elles ne vivent que là : la liste des produits n'en porte pas
de filtre, seulement un marqueur « à retirer » sur les lignes concernées.

**L'aperçu du tableau de bord n'est pas la liste.** L'écran **Retraits à faire**
(`/dashboard/removals`) en donne la totalité, cherchable et paginée, avec le geste attendu
sur chaque ligne. Le tableau de bord ne montre que les derniers arrivés ; un article vendu
il y a trois semaines n'y figure plus, et il faut pourtant pouvoir aller le décrocher. Le
lien « Voir la liste complète » y mène depuis chaque carte, et l'entrée de menu s'ouvre à
`online.manage` **ou** `products.manage`.

**Le tableau de bord n'en charge que cinq.** L'API borne l'aperçu à cinq lignes et compte
le total à part : ramener la liste entière alourdirait chaque ouverture du tableau de bord
pour des lignes qu'on n'y lit pas. L'aperçu dit ce qu'il montre (« 5 sur 30 ») — un compte
muet se lirait comme « il n'en reste que cinq » — et renvoie à l'écran des retraits pour
le reste.

**Les deux corvées n'ont pas le même périmètre.** Retirer une annonce est un travail de
site : `online.manage` porte sur tous les produits de l'entreprise, quelle que soit la
boutique qui détient l'article — le borner laisserait des annonces vendues sans personne
pour les ôter. Décrocher un vêtement, à l'inverse, demande d'aller dans le rayon : il faut
sur cette boutique-là le droit d'agir sur ses produits **et** celui de les voir. La règle
vit à un seul endroit, `products/removal-scope.ts`, que le tableau de bord et l'écran des
retraits appliquent tous les deux. La recette du jour y échappe : un total ne nomme
personne.

L'écran des retraits passe donc par une route dédiée (`GET /products/removals`) plutôt que
par un filtre de la liste des produits, dont le filtrage générique ne sait pas distinguer
les deux périmètres.

Le périmètre de la **liste des produits** suit la même correction. Il se lisait sur
l'existence d'une ligne `ShopAccess` ; depuis que les droits d'entreprise y sont recopiés,
une ligne existe sur toutes les boutiques dès qu'on gère le catalogue ou le site. Il se lit
maintenant sur `products.view`.

**Cet écran range par endroit où aller**, et non par statut : la boutique en ligne d'abord,
puis une section par boutique. C'est la forme d'une tournée — on retire les annonces du
site en une fois, puis on passe au Centre-ville avec sa liste. Mélanger les deux obligerait
à relire chaque ligne pour savoir laquelle est pour soi. Il n'est donc pas paginé : couper
une boutique en deux pages ferait repasser au même endroit. La recherche vise un article
précis quand il y en a trop, et au-delà de 200 la troncature est annoncée.

Chaque section porte son propre bouton **« Tout marquer comme retiré »**, parce que le
geste réel est groupé : on va retirer les douze annonces sur le site, puis on revient dire
que c'est fait. Douze clics pour une seule action, c'est ce qui fait abandonner une liste
de tâches. Une action par endroit et pas une pour tout : on solde la tournée qu'on a faite,
pas les trois. Elle ne porte que les articles listés — un lot arrivé entre l'affichage et
le clic n'est pas soldé sans avoir été vu — et ceux qu'un collègue aurait traités
entre-temps sont simplement ignorés, ce qui n'est pas une erreur mais le travail fait.

**La boutique en ligne est un choix du sélecteur du tableau de bord**, au même rang qu'une
boutique physique. La sélectionner donne ses ventes, son stock annoncé, ses retraits et sa
vente rapide — le même comptoir, qui **ne puise que dans les articles annoncés** (un
article jamais publié n'a pas pu s'y vendre) et enregistre au statut « Vendu en ligne ». Elle n'apparaît qu'à qui y a affaire : la gérer,
ou avoir le droit d'en lire les chiffres.

Deux filtres différents s'y appliquent, et les confondre coûterait cher. Une **vente
passée** se reconnaît au flag de son statut, `isOnlineSale`, qui ne bouge plus. Le **stock
annoncé** est un état courant, `isOnline`. Filtrer l'historique sur `isOnline` ferait
disparaître les ventes d'hier au fil des retraits confirmés, puisque l'annonce tombe à ce
moment-là. Le taux de retour, lui, disparaît dès qu'un canal est choisi : un article rendu
n'a été vendu nulle part.

**`online.manage` est un métier à part, pas un sous-ensemble.** Une personne peut n'avoir
que ce droit. Publier passe donc par une route dédiée (`PUT /products/:id/online`) et non
par la modification du produit, qui exige `products.manage` et ouvrirait le nom, la
description et le prix boutique. Le changement de statut, lui, accepte
`products.changeStatus` **ou** `online.manage`, puis le service vérifie qu'un utilisateur
qui n'a que le second ne vise qu'un statut de vente en ligne — le garde ne peut pas
trancher, le statut visé est dans le corps de la requête.

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

### Le contrat en PDF

`GET /deposit-contracts/:id/pdf` rend le contrat mis en page pour être **imprimé et
signé** : en-tête de l'entreprise, coordonnées complètes du déposant (IBAN compris),
période, commission, la liste des articles avec leur référence et leur prix affiché, les
conditions numérotées, et deux zones de signature. Le bouton est sur la liste des contrats
(une icône par ligne) et sur la fiche.

Un dépôt se conclut sur papier : c'est ce document qui fait foi sur ce qui a été confié, et
il porte les mêmes références que les étiquettes collées aux vêtements. Les articles y sont
donc rangés **par référence** — l'ordre dans lequel le déposant les étale sur le comptoir,
pas celui de leur saisie.

Le rendu est fait côté API (`pdfkit`, `deposit-contracts/contract-pdf.ts`) et non par
l'impression du navigateur : l'IBAN et les coordonnées du déposant ne sont pas chargés par
la fiche d'écran, et une page imprimée ne donne ni nom de fichier ni mise en page
reproductible. Le fichier passe par `/api/deposit-contracts/[id]/pdf` côté Next, pour la
même raison que l'export CSV — un lien de téléchargement ne peut pas porter d'en-tête
`Authorization`, et le jeton vit dans un cookie httpOnly.

Même droit que la fiche, `deposits.manage` : qui peut lire le contrat peut l'imprimer, il
n'y a rien de plus dedans. Le numéro imprimé en tête est la fin de l'identifiant du
contrat — un `cuid` entier ne se recopie pas sur un papier, six caractères suffisent à
retrouver la fiche.

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

`/dashboard` affiche le tableau de bord : le choix de la boutique, la recette du jour, le
comptoir de vente, puis les chiffres de la période — chiffre d'affaires, marge boutique,
panier moyen, stock actif et taux de retour, suivis des **modules graphiques** : courbe des
ventes, répartition du stock par statut, catégories par chiffre d'affaires, meilleures
ventes, temps de rotation, et un classement par valeur d'attribut (la meilleure couleur, la
meilleure marque…). Période et boutique vivent dans l'URL, donc la vue est partageable.

**Aucune permission unique ne gouverne cet écran** : la route `/stats/dashboard` ne porte
pas de `@RequirePermission`. Trois droits y ouvrent des blocs distincts, et le service
n'envoie **que** ceux auxquels l'utilisateur a droit :

| Bloc                                                         | Droit                                       |
| ------------------------------------------------------------ | ------------------------------------------- |
| CA, marge, panier moyen, courbe, classements, taux de retour | `stats.view`                                |
| Temps de rotation, classements par valeur d'attribut         | `stats.view`                                |
| Stock actif et sa valeur, répartition par statut             | `stock.view`                                |
| Recette du jour (sans la marge)                              | `stats.view` **ou** `products.changeStatus` |

Les deux droits sont indépendants : quelqu'un peut gérer le stock sans connaître les
marges, et tenir la caisse sans voir ni l'un ni l'autre. Un bloc absent de la réponse n'est
pas une panne, c'est un droit qui manque — le renvoyer « pour que l'interface le masque »
laisserait la marge dans une réponse HTTP lisible par son destinataire.

Sans boutique précisée, un employé ne voit que les boutiques où il détient le droit
concerné, plus le stock central. Avec `?shopId=`, le droit doit être détenu **sur cette
boutique-là** — le garde de route ne peut plus s'en charger.

**Le comptoir suit la même règle.** Vendre est un droit par boutique : le détenir à la Gare
n'autorise pas à encaisser au Centre-ville. La vente rapide ne s'affiche donc que sur une
boutique où elle aboutira (`hasPermissionOnShop`), et pas dès que le droit existe quelque
part — offrir un formulaire que l'API refusera n'aide personne. Sans boutique choisie la
question redevient « quelque part » : le comptoir cherche alors dans toutes ses boutiques,
et l'API tranche article par article.

**Le sélecteur de boutique appartient à cet écran, et à lui seul.** Il siégeait dans
l'en-tête, où il se donnait pour un filtre global : il n'en était pas un. La liste des
produits a son propre filtre boutique, dans sa barre de filtres, et sur tous les autres
écrans le changer ne produisait rien. Descendu sous le titre, il annonce ce qu'il commande
— recette du jour, comptoir et statistiques — et prend la forme d'un **sélecteur
segmenté** plutôt que d'une liste déroulante : les boutiques d'une entreprise se comptent
sur les doigts d'une main, donc les montrer toutes coûte moins qu'un menu à ouvrir, et la
boutique retenue se lit d'un regard. Il disparaît quand l'utilisateur n'a accès qu'à une
boutique : il n'y a alors rien à choisir.

Le sélecteur de période ne s'affiche pas au-dessus du seul stock : celui-ci est une photo
de l'instant, sa requête ne porte aucune borne de date, et proposer « 7 jours / 3 mois »
promettrait un filtre qui ne filtre rien.

**Toutes les dates affichées le sont dans le fuseau de la boutique**, via
`apps/web/lib/dates.ts`, et jamais dans celui du navigateur. Un `toLocaleDateString` sans
`timeZone` explicite rendait « 14:55 » côté serveur — le conteneur Next tourne en UTC — et
« 16:55 » côté client : React détectait la différence et refusait d'hydrater l'historique
des statuts. Le fuseau de la boutique est aussi la bonne réponse métier, indépendamment du
bug : une vente encaissée à 23 h 30 à Paris appartient à cette soirée-là, y compris relue
depuis un autre fuseau.

La constante `SHOP_TIMEZONE` existe **des deux côtés** — `apps/api/src/stats/today.ts` y
découpe les journées, `apps/web/lib/dates.ts` y formate l'affichage — et les deux doivent
bouger ensemble. Elle est écrite en dur plutôt que lue dans l'environnement : Next fige les
variables `NEXT_PUBLIC_*` à la construction de l'image, donc une valeur posée dans
`docker-compose.yml` ne serait honorée qu'en développement.

Un **jour calendaire** (`AAAA-MM-JJ`, ce que l'API renvoie pour `today.date` et pour la
courbe des ventes) n'est pas un instant : `formatCalendarDay` le lit à midi UTC, ce qui
laisse douze heures de marge de chaque côté et l'empêche de glisser sur la veille ou le
lendemain.

### Temps de rotation et meilleures valeurs

**Le temps de rotation** dit combien de temps un article reste en stock avant de partir :
de son entrée en stock à sa vente, en moyenne pour toute la boutique. Il ne se calcule que
sur les articles **vendus** — un invendu n'a pas encore de durée, et le compter à zéro
ferait baisser la moyenne à chaque nouvelle saisie. La **médiane** est affichée à côté de
la moyenne, parce qu'elles se contredisent utilement : un manteau resté un an suffit à
fausser la seconde, et l'histogramme des tranches (≤ 7 j, 7 à 14 j… 90 j et +) montre
laquelle des deux raconte la vérité du rayon.

**Le classement par valeur d'attribut** répond à « quelle couleur se vend le mieux ? »,
« quelle taille part le plus vite ? ». Il se compte en **nombre d'articles vendus** et non
en euros : la question est ce qui part, et un manteau à 120 € mettrait sa couleur devant
dix t-shirts. Le chiffre d'affaires suit dans l'infobulle, et départage deux valeurs à
égalité de quantité.

Il porte sur les attributs à liste (choix unique ou multiple) et sur le texte libre, jamais
sur les nombres ni les oui/non : ranger des pointures ne répond à aucune question qu'on se
pose. Un article en choix multiples compte dans **chacune** de ses valeurs — la carte le
dit, parce que le total des barres dépasse alors le nombre de ventes.

Le classement existe pour **chaque** attribut de l'entreprise, même sans vente sur la
période : sinon la carte qu'on vient d'ajouter disparaîtrait dès qu'on remonte à sept
jours. Elle affiche alors « aucune vente renseignant cet attribut ».

### Ranger ses modules

Les cartes graphiques se rangent : **« Personnaliser »** ouvre le mode rangement, où chaque
carte se déplace par glisser-déposer (ou avec deux boutons ↑ ↓, pour qui n'a pas de souris)
et se masque d'un clic. Les modules masqués restent listés en dessous, et se réaffichent
**à leur place**, pas à la fin. Le déplacement ne quitte pas la zone des graphiques : la
recette du jour, le comptoir et les retraits à faire sont des actions, ils ne se rangent
pas.

Rien n'est enregistré tant qu'on n'a pas cliqué **« Terminer »** : on essaie un rangement,
on le regarde, on le garde ou on l'abandonne — enregistrer à chaque déplacement figerait
l'essai raté avant qu'on ait pu se raviser.

Le rangement est une **préférence personnelle**, gardée sur le compte (`GET` / `PUT
/stats/layout`, sans permission : ranger une carte n'ouvre pas le bloc qu'elle contient).
Ce n'est pas un réglage d'entreprise : deux employés d'une même boutique n'ont ni les mêmes
droits ni le même travail, et un rangement imposé masquerait à l'un ce que l'autre ne
regarde jamais. Gardé côté serveur et non dans le navigateur, il suit l'utilisateur d'un
poste à l'autre et le tableau de bord — rendu côté serveur — sort déjà rangé, sans que les
cartes sautent de place après coup.

**« Meilleures ventes par attribut » s'ajoute plusieurs fois.** La réserve n'en propose
qu'une entrée — pas une par attribut : les attributs se créent et se suppriment, et une
liste qui les énumérerait se périmerait à la première suppression. On clique, la carte se
pose, et un menu **sur la carte** dit quel attribut elle classe. Une deuxième carte pour la
marque, une troisième pour la taille : autant qu'il reste d'attributs libres, et l'entrée
disparaît de la réserve quand ils sont tous posés. Changer l'attribut d'une carte lui garde
sa place et renvoie l'ancien dans la réserve.

Supprimer un attribut du catalogue emporte sa carte, et rien d'autre : le rangement se
recolle sur les cartes restantes, sans entrée morte ni graphique vide. Même chose pour un
module apparu depuis le dernier rangement — il se pose à la fin plutôt que de disparaître
faute d'être dans une liste écrite avant lui.

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
exporter des sacs ne traîne pas de colonne « Taille » vide. Les trois dernières colonnes
fixes couvrent la vente en ligne — « En ligne », « Prix en ligne », « Retrait à faire ».

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
concernent toute l'application, pas la navigation. Le sélecteur de boutique les y
accompagnait à tort : il ne pilote que le tableau de bord, il y a donc rejoint son écran.
L'en-tête nomme la section courante ; les pages d'index ne le répètent donc plus, et une
sous-page garde son propre titre, plus précis.

**Les contrôles ne renvoient jamais en haut de page.** Filtres, tri, sélecteur de période,
sélecteur de boutique et pagination naviguent en `scroll: false` : ils commandent un
contenu situé **en dessous** d'eux, et remonter à chaque clic obligeait à redescendre pour
lire le résultat.

Sur l'écran des utilisateurs, les permissions de chaque employé sont **repliées** derrière
un `<details>` natif — à cinq employés, cinq formulaires dépliés font défiler la page sur
des mètres. Une ligne de résumé (« 4 permissions sur 2 boutiques ») reste visible replié,
sans quoi la liste ne dirait plus rien de qui fait quoi.

Sous 640 px la colonne de gauche est masquée faute de place : un panneau en superposition
s'ouvre depuis l'en-tête et se referme dès qu'on a choisi, sans quoi il masquerait l'écran
demandé.

Le menu ne propose que ce qui aboutira : une entrée dont la permission manque n'est pas
affichée, et le filtrage se fait **côté serveur** plutôt qu'en masquant une liste complète
envoyée au client.

## Déploiement

Le dépôt porte **deux fichiers Compose**, et ils ne se mélangent jamais :

| Fichier                   | À quoi il sert                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------- |
| `docker-compose.yml`      | Développement seul : code de l'hôte monté en volume, rechargement à chaud, ports publiés en local |
| `docker-compose.prod.yml` | Production : images construites, aucun port publié, migrations appliquées au démarrage            |

Chaque application a de même son `Dockerfile` (développement) et son `Dockerfile.prod`
(construction multi-étapes). `make prod-build` construit les deux images de production
sans rien déployer — c'est le contrôle à passer avant de pousser une modification qui
touche au déploiement. `make prod-up` et `make prod-down` font tourner cette stack en
local pour l'essayer pour de bon.

Ces trois cibles posent toutes un nom de projet Docker distinct, et ce n'est pas
cosmétique : sans lui, les deux composes partagent celui du dossier, Compose en déduit
les mêmes noms d'images, et construire la production écrase celles du développement. Le
conteneur de dev repart alors sur l'image de prod et `make format` échoue sur une erreur
de permissions qui ne dit rien de la cause. Le même préfixe cloisonne les volumes :
`make prod-down` détruit ceux de la stack locale de production, jamais la base de
développement.

### Un seul service exposé

**Le navigateur ne parle jamais à l'API.** `apps/web/lib/api.ts` lit `API_URL` côté
serveur uniquement, et les trois flux qui pourraient faire exception passent eux aussi par
des route handlers Next qui rattachent le jeton depuis le cookie `httpOnly` : les photos
(`/api/photos/…`), le PDF de contrat (`/api/deposit-contracts/[id]/pdf`) et l'export CSV
(`/api/export`).

Conséquence directe : **seul `web` reçoit un domaine**. L'API, PostgreSQL et MinIO restent
sur le réseau interne, en `expose:` et non en `ports:`. Ce n'est pas de la prudence
décorative — publier ces ports offrirait la base et le stockage à Internet, et entrerait en
collision avec les autres applications du serveur. C'est aussi pourquoi `main.ts` n'appelle
pas `enableCors()` : aucune requête ne traverse d'origine. Le jour où l'API recevrait son
propre domaine, il faudrait l'ajouter.

### Déployer sur Coolify

Ressource **Git Repository**, build pack **Docker Compose**.

| Réglage        | Valeur                     |
| -------------- | -------------------------- |
| Branch         | `main`                     |
| Base directory | `/`                        |
| Compose file   | `/docker-compose.prod.yml` |
| Domaine        | sur le service `web` seul  |

Le compose déclare `SERVICE_FQDN_WEB_3000` sur `web` : Coolify y attribue le domaine et
pose les étiquettes de son proxy. Fixer le domaine dans l'interface, service par service,
revient au même.

Variables d'environnement à créer :

| Variable              | Rôle                                                         |
| --------------------- | ------------------------------------------------------------ |
| `POSTGRES_USER`       | Compte PostgreSQL                                            |
| `POSTGRES_PASSWORD`   | Mot de passe PostgreSQL                                      |
| `POSTGRES_DB`         | Nom de la base                                               |
| `MINIO_ROOT_USER`     | Compte MinIO, sert aussi de clé d'accès à l'API              |
| `MINIO_ROOT_PASSWORD` | Mot de passe MinIO, sert aussi de clé secrète                |
| `MINIO_BUCKET`        | Bucket des photos produit, créé tout seul au premier envoi   |
| `JWT_SECRET`          | Signature des jetons. **L'API refuse de démarrer sans**      |
| `SHOP_TIMEZONE`       | Fuseau d'affichage de la boutique, `Europe/Paris` par défaut |

Aucune variable `*_PORT` n'est utile : rien n'est publié sur l'hôte. Les valeurs du
`.env.example` sont celles du développement et n'ont rien à faire ici — `JWT_SECRET`
surtout, qui doit être long et aléatoire.

**`SHOP_TIMEZONE` est le piège discret** : elle ne figure dans aucun `.env.example`, et les
conteneurs tournent en UTC. Sans elle, une vente encaissée à 23 h 30 bascule dans la
recette du lendemain. Elle se pose sur `api` **et** sur `web` — les deux constantes
(`apps/api/src/stats/today.ts`, `apps/web/lib/dates.ts`) doivent toujours porter la même
valeur.

### Migrations

Le conteneur `api` lance `prisma migrate deploy` avant de démarrer Nest. Un déploiement
applique donc les migrations tout seul, et sa sonde `/health` ne passe au vert qu'ensuite —
`web` attend ce vert pour démarrer. Rien à lancer à la main.

Le seed, lui, ne tourne jamais en production : il refuse `NODE_ENV=production`, puisqu'il
crée des comptes de démonstration.

### Si la construction échoue

Un `npm ci` qui s'arrête sur `npm error code ETIMEDOUT` ne dit rien de la configuration :
il dit que le serveur de construction est lent. Compose bâtit les deux services en
parallèle, leurs deux installations se disputent la bande passante, et l'une des deux
finit par dépasser le délai de npm.

Les deux `Dockerfile.prod` gardent pour cette raison le cache npm d'une construction à
l'autre (`--mount=type=cache`), en plus de délais et de tentatives relevés. La
conséquence pratique : **relancer le déploiement suffit**. La reprise ne retélécharge que
ce qui manque — mesuré en local, `npm ci` passe de 48 secondes à 5 sur le même jeu de
paquets, sans un octet de réseau.

Si l'échec se répète malgré tout, le serveur est trop juste pour construire. La sortie est
alors de déporter la construction — un « Build Server » Coolify distinct, ou des images
bâties par GitHub Actions et poussées sur un registre, `docker-compose.prod.yml` passant de
`build:` à `image:`. Le serveur ne ferait plus que tirer des images toutes faites, ce qui
lui éviterait au passage les ~2 Go de RAM que réclame `next build`.

### Premier compte

Une base de production est vide. Le premier gérant se crée par l'écran `/register`, qui
monte l'entreprise, ses statuts, son flux de transitions et son catalogue de départ
(catégories et attributs) dans la même transaction. Les comptes suivants s'invitent depuis
`/dashboard/users`.

### Points de vigilance

- **Une seule réplique de l'API.** Elle porte un job planifié (l'alerte d'échéance des
  contrats de dépôt) ; deux exemplaires enverraient la notification en double.
- **`NODE_ENV=production` doit atteindre le runtime de `web`**, pas seulement son build :
  c'est de là que `lib/session.ts` déduit le drapeau `Secure` du cookie de session. Les
  images de production le posent, mais un `docker run` bricolé à la main pourrait l'oublier.
- **MinIO est appelé en clair** (`useSSL: false`, codé en dur dans `uploads.service.ts`).
  Correct pour un saut entre conteneurs du même réseau ; pointer vers un S3 externe en TLS
  demanderait une modification du code.

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
docker-compose.yml       postgres, minio, api, web — développement
docker-compose.prod.yml  les mêmes en production, sans port publié
Makefile                 raccourcis de développement et vérifications
scripts/                 node-run.sh, check-db.sh, release.sh
.githooks/               commit-msg, pre-commit, pre-push
.github/workflows/       CI et publication des releases
prompts/                 archive des prompts ayant servi à construire l'app
docs/KIT.md              documentation du kit de démarrage
.claude/                 agents, skills, hooks, et memoire/ (notes pour Claude Code)
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
