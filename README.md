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

Le seed est idempotent et affiche les identifiants de connexion à la fin :
`gerant@fripstock.test` / `fripstock`.

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
