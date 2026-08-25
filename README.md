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

Cette machine n'a pas Node : `scripts/node-run.sh` bascule automatiquement sur les
conteneurs. Sur une machine équipée de Node — et sur la CI — les mêmes cibles
s'exécutent directement, sans Docker.

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
