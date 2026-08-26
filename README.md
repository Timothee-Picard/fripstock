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

| Compte  | Identifiants                           | Accès                                                                 |
| ------- | -------------------------------------- | --------------------------------------------------------------------- |
| Gérant  | `gerant@fripstock.test` / `fripstock`  | Tous les droits sur toute l'entreprise                                |
| Employé | `employe@fripstock.test` / `fripstock` | Boutique Centre-ville, `produits.voir` et `produits.creer` uniquement |

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

| Niveau          | Mécanisme                              | Exemple                                |
| --------------- | -------------------------------------- | -------------------------------------- |
| Authentifié     | `JwtAuthGuard` global                  | Toute route non `@Public()`            |
| Gérant          | `@GerantUniquement()`                  | Créer une boutique, inviter un employé |
| Permission fine | `@RequirePermission('produits.creer')` | Actions sur les produits (étape 5)     |

Le gérant contourne entièrement la table des permissions, une seule fois, dans le guard.
Pour un employé, `PermissionsGuard` retrouve la boutique concernée de trois façons :
un `boutiqueId` explicite, une ressource ciblée par l'URL via
`@BoutiqueDepuisRessource`, ou aucune — c'est alors le stock central, et la permission
est accordée si l'employé la détient sur au moins une boutique.

Aucune route n'exige encore de permission fine, les produits arrivant à l'étape 5 : le
guard est donc couvert par ses propres tests (`permissions.guard.spec.ts`).

### Son propre compte

`/dashboard/profil` permet à chacun — gérant comme employé — de modifier son prénom, son
nom, son email et son mot de passe. Les routes correspondantes (`PUT /auth/profil`,
`PUT /auth/mot-de-passe`) ne prennent aucun identifiant dans l'URL : la cible est
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
boutiques — jamais par boutique. Les routes d'écriture n'ont donc pas de `boutiqueId` :
le `PermissionsGuard` applique sa règle du stock central, et la permission
(`categories.gerer`, `attributs.gerer`) est accordée si l'utilisateur la détient sur au
moins une de ses boutiques. La lecture est ouverte à tout utilisateur de l'entreprise.

Deux écrans : `/dashboard/categories` (arbre, avec sélecteur de parent) et
`/dashboard/attributs`.

**L'association se pilote depuis la catégorie**, sur `/dashboard/categories` : chaque
catégorie déclare les attributs qui seront demandés à la création d'un produit. C'est le
sens dans lequel on lit un catalogue — « une robe a une taille et une couleur » — et non
l'inverse.

Attention au contresens que ce nom peut induire : `CategorieAttribut` n'est **pas** une
possession. Les valeurs appartiennent au produit (`ValeurAttribut`,
`ProduitAttributOption`) ; cette table dit seulement quels attributs le formulaire
produit propose, et lesquels l'API accepte, pour un produit de cette catégorie.

L'API expose les deux directions — `PUT /categories/:id/attributs` (utilisée par l'écran)
et `PUT /attributs/:id/categories` — sur la même table et avec la **même permission**
`attributs.gerer` : deux chemins vers la même écriture ne peuvent pas coûter des droits
différents, sinon l'un contourne l'autre.

**L'association attribut ↔ catégorie est directe, sans héritage.** Rattacher « Taille » à
« Vêtements » ne la donne pas à « Robe ». C'est ce que décrit `CLAUDE.md` (« Sac peut ne
pas avoir Taille, Robe l'aura ») et ce que fait le seed. Si l'héritage devient
souhaitable, il ne concerne qu'une requête — mais il faudra d'abord trancher si une
sous-catégorie peut retirer un attribut hérité.

**Les options d'un attribut s'éditent en une seule opération.** `PUT /attributs/:id/options`
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

Trois écrans : la liste filtrée (`/dashboard/produits`), la création
(`/dashboard/produits/nouveau`) et la fiche (`/dashboard/produits/:id`). Les filtres vivent
dans l'URL, donc la vue reste partageable et le retour arrière fonctionne.

**Le formulaire s'adapte à la catégorie** : les champs d'attributs sont chargés depuis
`GET /categories/:id/attributs` dès qu'une catégorie est choisie — on ne demande pas la
taille d'un sac. L'API applique la même règle et refuse un attribut inapplicable :
l'affichage n'est qu'un confort, la validation est côté service.

**Toute la logique de vente repose sur les flags de `Statut`, jamais sur le libellé.** Un
statut `estVente` exige un prix vendu et refuse le changement si le statut actuel porte
`bloqueVente` ; un statut ordinaire refuse au contraire prix vendu et date de vente. Le
gérant pouvant renommer ses statuts, un test vérifie que le blocage tient après
renommage.

Au passage à un statut de vente, la commission du contrat est **copiée** dans
`Produit.commissionAppliquee`. Relevé, export et statistiques liront cette copie, jamais
celle du contrat — sinon modifier un contrat réécrirait des relevés déjà réglés.

### Statuts

`/dashboard/statuts` : créer, renommer, recolorer, réordonner, désigner celui par défaut.
Réservé au gérant, sans permission fine — un employé y voit la liste en lecture seule. Les trois flags comportementaux (`estVente`, `bloqueVente`,
`sortStock`) se fixent à la création et **ne sont plus modifiables** : des produits
s'appuient dessus, les basculer sous eux réécrirait leur histoire métier.

L'unicité de `estDefaut` est tenue par une route dédiée (`PUT /statuts/:id/par-defaut`)
qui remet les autres à `false` dans une transaction — un index unique Prisma sur
`[entrepriseId, estDefaut]` interdirait aussi deux `false`.

### Photos

Le bucket MinIO **n'est pas public**. Une balise `<img>` ne peut pas porter d'en-tête
`Authorization`, donc le navigateur passe par `/api/photos/…` côté Next, qui lit le cookie
httpOnly et rattache le jeton. Aucune URL de stockage n'est exposée, et une photo reste
inaccessible sans session.

Le type est vérifié sur les **premiers octets du fichier**, pas sur le `mimetype` déclaré
par le navigateur : n'importe qui peut annoncer `image/png` en envoyant autre chose. La
clé d'objet est préfixée par l'entreprise, ce qui cloisonne aussi le stockage.

## Contribuer

### Convention de commit

Les messages suivent [Conventional Commits](https://www.conventionalcommits.org/),
appliqués par un hook `commit-msg` :

```
feat(produits): bloque la vente d'un produit rendu au client
fix(api): scope les contrats de dépôt via client.entrepriseId
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

Format, lint, typage, dérive du schéma Prisma, tests et build des deux apps —
exactement ce que lance la CI. Le hook `pre-push` l'exécute automatiquement.

| Cible                               | Effet                                        |
| ----------------------------------- | -------------------------------------------- |
| `make check`                        | Toutes les vérifications                     |
| `make check-format` … `check-build` | Une vérification isolée                      |
| `make format`                       | Reformate tout le dépôt                      |
| `make install`                      | Réinstalle les dépendances et pose les hooks |

Les hooks se contournent avec `--no-verify` : ils sont là pour le retour rapide,
**la CI est le seul filet qui ne se contourne pas**. Les deux lancent les mêmes
cibles `make`, jamais des commandes recopiées.

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
prompts/             un prompt Claude Code par étape du PLAN.md
docs/KIT.md          documentation du kit de démarrage
```

- **`CLAUDE.md`** — règles métier et conventions de code. C'est le document qui fait foi ;
  il est chargé automatiquement par Claude Code à chaque session.
- **`PLAN.md`** — les 8 étapes de développement (0 à 7) et leur avancement.
- **`docs/KIT.md`** — comment se servir du kit de prompts et de la configuration
  `.claude/` (skills, subagents, hooks).

## État d'avancement

Étapes 0 et 1 terminées : le squelette tourne et les garde-fous sont en place. Aucun
modèle de données ni authentification pour l'instant — voir `PLAN.md` pour la suite.
