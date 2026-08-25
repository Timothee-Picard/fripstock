Lis CLAUDE.md à la racine pour le contexte projet. Cette étape suit le squelette
(`prompts/00-squelette-repo.md`) et précède la base de données.

Objectif : poser les garde-fous — convention de commit, hooks git, vérifications
automatisées, CI GitHub Actions, versioning en tags `vX.Y.Z`. **Aucun code métier ici.**
C'est volontairement placé avant l'étape 2 pour que tous les commits du projet, à partir
du premier commit de code, respectent déjà la norme : rattraper un historique de commits
après coup n'est pas faisable.

Prérequis : le monorepo a besoin d'un `package.json` à la racine pour porter les
devDependencies d'outillage (husky, commitlint, lint-staged, prettier). S'il n'existe pas
encore, crée-le — `"private": true`, avec des workspaces npm pointant sur `apps/*` — et
vérifie que `apps/api` et `apps/web` continuent de builder normalement après ce
changement (le hoisting de node_modules peut casser les Dockerfiles de dev de l'étape 0 :
si c'est le cas, corrige les Dockerfiles, ne renonce pas aux workspaces).

## 1. Convention de commit

Norme **Conventional Commits** : `type(scope): sujet`.

- Types autorisés : `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`,
  `ci`, `chore`, `revert`.
- Scopes suggérés pour ce projet : `api`, `web`, `db`, `docker`, `ci`, `deps`, `auth`,
  `catalogue`, `produits`, `depots`, `stats`. Le scope est **facultatif**, et un scope
  hors liste doit produire un avertissement, pas une erreur — sinon la liste devient un
  frein dès qu'un module nouveau apparaît.
- Sujet : une seule ligne, **72 caractères maximum en-tête compris**, en minuscule, à
  l'impératif, sans point final.
- Corps facultatif, après une ligne vide, pour expliquer le *pourquoi* d'un choix non
  évident. C'est le seul endroit du projet où cette information survit.
- Breaking change : `feat!:` / `fix!:`, ou un pied de message `BREAKING CHANGE: ...`.

Installe `@commitlint/cli` et `@commitlint/config-conventional` à la racine, avec un
`commitlint.config.js` qui étend `config-conventional` et surcharge :
`header-max-length` à 72, `subject-full-stop` interdit, `subject-case` interdisant les
casses majuscules, `body-leading-blank` obligatoire, `type-enum` sur la liste ci-dessus,
et `scope-enum` en niveau `warning`.

## 2. Hooks git (husky)

Installe husky (version 9) à la racine et crée trois hooks :

- **`commit-msg`** → `npx --no -- commitlint --edit "$1"`. C'est le hook qui applique la
  section 1.
- **`pre-commit`** → `npx lint-staged`, plus un garde-fou explicite qui **refuse tout
  commit contenant un fichier `.env`** (`git diff --cached --name-only` grepé sur
  `\.env$` / `\.env\.` en excluant `.env.example`). Le hook `protect-files.sh` de
  `.claude/` ne protège que les modifications faites par Claude Code ; celui-ci protège
  aussi les tiennes.
- **`pre-push`** → `make check` (voir section 3). C'est ce qui évite de découvrir une
  erreur de typage trois minutes plus tard dans la CI.

Configure `lint-staged` dans le `package.json` racine : Prettier sur
`*.{ts,tsx,js,jsx,json,md,yml}`, ESLint `--fix` sur `*.{ts,tsx}`.

Documente dans le README qu'un hook se contourne avec `--no-verify` : les hooks sont un
confort de retour rapide, **la CI est le seul filet qui ne se contourne pas**. C'est
pour ça que les deux lancent exactement les mêmes commandes.

## 3. Cible `make check` — la source de vérité unique

Ajoute au Makefile une cible `check` qui enchaîne des sous-cibles individuellement
lançables :

- `check-format` — `prettier --check` sur tout le repo.
- `check-lint` — ESLint sur `apps/api` et `apps/web` (les deux frameworks fournissent
  déjà une config, pars de celle-là plutôt que d'en inventer une).
- `check-types` — `tsc --noEmit` sur les deux apps. Le typage attrape ce que le lint
  laisse passer ; ne saute pas cette cible.
- `check-db` — `prisma validate`, `prisma format --check`, et surtout une **vérification
  de dérive** entre `schema.prisma` et le dossier `migrations/` (`prisma migrate diff`
  entre les deux sources, en échouant s'il y a une différence). À l'étape 1 ces fichiers
  n'existent pas encore : la cible doit passer silencieusement s'il n'y a pas de schéma,
  et devenir active dès l'étape 2. C'est la vérification qui rapporte le plus sur ce
  projet — un schéma modifié sans migration générée ne se voit qu'au déploiement.
- `check-test` — les tests des deux apps avec `--passWithNoTests`. CLAUDE.md n'exige pas
  de tests pour le MVP : la cible doit être verte sur zéro test aujourd'hui, et se mettre
  à mordre toute seule dès qu'un test apparaît.
- `check-build` — `nest build` et `next build`.

Deux contraintes de cet environnement, à respecter en écrivant ces cibles :

- **Il n'y a pas de Node sur la machine hôte.** Chaque cible doit s'exécuter dans un
  conteneur (`docker compose run --rm api ...`), jamais directement sur l'hôte. Les
  conteneurs de dev tournent en root et écrivent `dist/` et `.next/` dans le dossier monté :
  lancer les mêmes commandes depuis un conteneur sous l'UID de l'hôte provoque un `EACCES`
  sur ces dossiers. Reste cohérent, tout en root côté conteneur.
- **N'ajoute pas `npm audit` en barrière bloquante.** `prisma` embarque `@prisma/config`
  → `deepmerge-ts < 8` (GHSA-ggr8-5vv4-36mx, sévérité haute). Le seul « correctif »
  proposé est un retour à `prisma@6`, soit une régression de deux majeures. La faille est
  une saturation de pile sur des graphes d'objets récursifs, atteinte uniquement par le
  fichier de config Prisma que nous écrivons nous-mêmes, dans une dépendance de dev qui ne
  tourne jamais en production. Si tu veux un audit en CI, mets-le en non bloquant ou en
  `--audit-level=critical`, et documente cette exception.

**Règle stricte : la CI n'exécute jamais autre chose que ces cibles.** Aucune commande
recopiée dans le YAML, sinon le Makefile et la CI divergent en quelques semaines et
`make check` ne veut plus rien dire.

## 4. CI GitHub Actions

`.github/workflows/ci.yml`, déclenché sur `push` vers `main` et sur `pull_request` :

- `concurrency` avec `cancel-in-progress` par ref, pour ne pas empiler les runs sur une
  branche qu'on pousse plusieurs fois d'affilée.
- `actions/setup-node` avec le cache npm activé.
- Job **`check`** : `npm ci` puis `make check`.
- Job **`smoke`**, en parallèle : `cp .env.example .env`, `docker compose build`,
  `docker compose up -d`, attente active de `GET /health` (avec timeout et affichage des
  logs en cas d'échec, pas un `sleep` arbitraire), puis `docker compose down -v`. Le
  critère de validation de chaque étape du `PLAN.md` est « `make up` démarre tout » — ce
  job est ce qui empêche cette promesse de pourrir sans qu'on s'en aperçoive.
- Job **`commits`** sur les `pull_request` uniquement : `commitlint` sur la plage de
  commits de la PR, pour rattraper ceux poussés avec `--no-verify`.

## 5. `make release` — les tags `vX.Y.Z`

Écris `scripts/release.sh`, appelé par une cible `make release`. Le script est
interactif, mais il **propose** au lieu de demander à l'aveugle :

1. Refuse de tourner si le working tree est sale, si on n'est pas sur `main`, ou si
   `make check` échoue.
2. Récupère le dernier tag (`git describe --tags --abbrev=0`, `v0.0.0` s'il n'y en a
   aucun).
3. Analyse `git log <dernier-tag>..HEAD` et classe les commits conventionnels :
   `!` ou `BREAKING CHANGE` → **majeur**, `feat` → **mineur**, `fix` et `perf` →
   **patch**, le reste n'influence pas le bump.
4. Affiche le récapitulatif — nombre de features, de correctifs, de breaking changes,
   avec la liste des sujets — puis le **bump calculé et la version résultante**.
5. Demande confirmation : `[M]ajeur / [m]ineur / [p]atch / [q]uitter`, avec le bump
   calculé comme valeur par défaut (Entrée = accepter la proposition). Tu gardes la main,
   mais tu ne peux plus rater un `feat!` qui aurait dû faire un majeur.
6. Cas pré-1.0 : tant que la version majeure est `0`, un breaking change ne bump que le
   mineur (`0.3.2` → `0.4.0`). Le script doit le signaler explicitement au lieu de le
   faire en silence, et proposer `1.0.0` comme alternative.
7. Génère ou complète `CHANGELOG.md` : une section par version, commits groupés par type,
   avec le hash court. Ignore les commits `chore(release):`.
8. Commit `chore(release): vX.Y.Z`, tag **annoté** `vX.Y.Z`, puis demande une dernière
   confirmation avant `git push --follow-tags`.

Ajoute `.github/workflows/release.yml`, déclenché sur `push` de tag `v*`, qui crée la
GitHub Release en reprenant la section correspondante du `CHANGELOG.md`.

## 6. Documentation et configuration

- Complète le `README.md` racine : la convention de commit en trois lignes avec un
  exemple valide et un invalide, `make check` avant de pousser, et `make release`.
- Ajoute aux permissions de `.claude/settings.json` les commandes de cette étape
  (`npx commitlint`, `npx eslint`, `npx prettier`, `npx tsc`, `git tag`), et garde
  `make release` en confirmation explicite — c'est une action qui pousse.

Critère de validation : `git commit -m "wip"` est refusé par le hook, `git commit -m
"feat(api): ajoute l'endpoint health"` passe, un sujet de 90 caractères est refusé,
`make check` est vert sur le squelette de l'étape 0, la CI passe sur une PR de test, et
`make release` sur un dépôt contenant un commit `feat:` propose bien un bump mineur.
