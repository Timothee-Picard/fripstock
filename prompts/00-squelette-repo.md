Lis d'abord CLAUDE.md à la racine du repo pour le contexte complet du projet Fripstock.

Objectif de cette étape : poser le squelette du monorepo, rien de métier pour l'instant.

1. Crée la structure de dossiers :

   ```
   fripstock/
   ├── apps/
   │   ├── api/   (NestJS)
   │   └── web/   (Next.js, App Router, TypeScript, Tailwind)
   ├── docker-compose.yml
   ├── Makefile
   ├── .env.example
   └── .gitignore
   ```

2. `apps/api` : initialise un projet NestJS standard (TypeScript strict). Ajoute Prisma
   (`@prisma/client`, `prisma` en dev dependency) et `class-validator` /
   `class-transformer`. Un seul endpoint pour l'instant : `GET /health` qui renvoie
   `{ status: "ok" }`. Dockerfile de dev (hot reload avec le code monté en volume, pas
   de build multi-stage pour la prod pour l'instant).

3. `apps/web` : initialise un projet Next.js (App Router, TypeScript, Tailwind CSS déjà
   configuré). Une seule page d'accueil qui affiche "Fripstock" et fait un fetch vers
   `GET /health` de l'API pour vérifier la connexion (affiche le statut retourné).
   Dockerfile de dev avec hot reload.

4. `docker-compose.yml` à la racine avec les services :
   - `postgres` (image officielle, volume nommé pour la persistance, variables d'env
     depuis `.env`)
   - `minio` (avec la console web exposée, credentials depuis `.env`, volume nommé)
   - `api` (build depuis `apps/api`, dépend de `postgres` et `minio`, variables d'env
     pour la connexion DB et MinIO, port exposé, volume sur le code source pour le hot
     reload)
   - `web` (build depuis `apps/web`, dépend de `api`, port exposé, volume sur le code
     source)

5. `Makefile` à la racine avec au minimum ces cibles : `up` (docker compose up -d),
   `down`, `build`, `logs`, `restart`, `sh-api` (shell dans le conteneur api),
   `sh-web` (shell dans le conteneur web). Documente chaque cible avec un commentaire.

6. `.env.example` avec toutes les variables utilisées par docker-compose (credentials
   postgres, credentials minio, secret JWT, ports), avec des valeurs de dev par défaut
   raisonnables.

7. `.gitignore` adapté (node_modules, .env, dist, .next, volumes locaux éventuels).

8. Un `README.md` court à la racine expliquant comment démarrer (`cp .env.example .env`
   puis `make up`) et où trouver quoi dans le repo. La racine n'a pas encore de README —
   la documentation du kit de démarrage vit dans `docs/KIT.md`, ne la touche pas : ajoute
   simplement un lien vers elle en bas du nouveau README.

Critère de validation : `make up` démarre tout, la page d'accueil de `apps/web` affiche
bien le statut "ok" renvoyé par l'API. Ne commence aucun travail métier (pas de modèles
Prisma, pas d'auth) — ce sera l'étape suivante.
