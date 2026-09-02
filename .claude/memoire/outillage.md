# Outillage et commandes

> Fripstock — aucun Node sur l'hôte, tout passe par les conteneurs ; et comment écrire une migration à la main.

Sur cette machine, **Node n'est pas installé pour ce dépôt** : toute commande
Node passe par `./scripts/node-run.sh <dossier-relatif> <commande...>`, qui
l'exécute dans le conteneur du service. Lancer `npx` ou `npm` depuis l'hôte
échoue sur un `invalid ELF header` — les `node_modules` sont installés par les
images Alpine (musl) et sont illisibles par la glibc de l'hôte.

`./scripts/node-run.sh` est relatif à la **racine du dépôt** : il faut y être.
Après un `cd apps/api` dans une commande précédente, le chemin ne résout plus.

**Ajouter une dépendance npm.** Les `node_modules` vivent dans l'image, pas
dans le volume monté : un `npm install` lancé par `node-run.sh` les écrit dans un
volume anonyme jetable, et le conteneur qui tourne ne les voit jamais. On met
donc à jour le `package.json` et le lock **sans installer**, sous l'UID de
l'hôte pour que les fichiers restent éditables :

```sh
docker run --rm -i -e HOME=/tmp -u "$(id -u):$(id -g)" \
  -v "$PWD":/repo -w /repo/apps/api node:24-alpine \
  npm install --package-lock-only --save <paquet>
make build   # reconstruit l'image et renouvelle le volume node_modules
```

Sans le `make build`, l'API démarre sur l'ancienne image et le `import` du
nouveau paquet échoue — y compris dans les tests, qui passent par le même
conteneur.

**Vérifications** : toujours une cible `make`, jamais les commandes recopiées.
`make check` est le jeu complet, celui de la CI ; `make check-fast` est le même
sans tests ni build (~1 min 30 contre ~3 min), et c'est ce que lance le hook
`pre-push`. Les deux génèrent d'abord le client Prisma. `make format` avant,
sinon `check-format` échoue sur du Prettier.

Avant de déclarer une tâche finie, c'est `make check` qu'il faut : `check-fast`
ne dit rien des tests ni du build.

**Le seed remet les produits à zéro** à chaque passage — et avec eux le
rangement du tableau de bord des deux comptes de démonstration
(`dashboardLayout` remis à `Prisma.DbNull`, comme leur mot de passe) : une
démonstration ne doit pas dépendre de ce que la session précédente avait
déplacé. Le reste fait de l'upsert. C'est délibéré : il sautait auparavant ceux dont la
référence existait déjà, et comme les références se calculent dans l'ordre du
tableau `products`, insérer une entrée au milieu décalait toutes les suivantes
sur des références prises, silencieusement ignorées. La base gardait un mélange
de deux versions du jeu de démonstration que `make seed` ne savait plus
réparer.

**Écrire une migration à la main.** `make migrate` lance `prisma migrate dev`,
qui est interactif et ne crée **rien** quand le schéma n'a pas bougé. Pour une
migration de données pure (reprise de valeurs existantes), il faut écrire le
fichier soi-même — et `apps/api/prisma/migrations/` appartient à root, donc
depuis un conteneur root :

```sh
docker compose run --rm --no-deps -T -u root api sh -c '
  d=prisma/migrations/AAAAMMJJHHMMSS_nom_court
  mkdir -p "$d" && cat > "$d/migration.sql"' < /chemin/vers/migration.sql
make migrate   # applique
```

Sans le conteneur root, l'écriture du fichier est refusée ; sans le SQL écrit à
la main, `migrate dev` ne produit rien du tout. Deux migrations de données ont
été écrites ainsi : la fusion des permissions produit et le repositionnement des
statuts.

Vérifier le résultat directement en base :

```sh
docker compose exec -T postgres psql -U fripstock -d fripstock -c 'SELECT ...'
```

**Images de production** : `make prod-build`, qui construit
`docker-compose.prod.yml` (fichier distinct — le compose par défaut monte le code
en volume et ne produit rien de déployable). Quatre pièges s'y cachent, tous
invisibles en développement :

- **Le point d'entrée compilé est `dist/src/main.js`, pas `dist/main.js`.**
  `prisma.config.ts` et `prisma/seed.ts` vivant hors de `src`, tsc élargit sa
  racine et recrée l'arborescence sous `dist/`. Le `start:prod` livré par le
  CLI Nest pointait sur le mauvais chemin, sans que rien ne s'en aperçoive :
  personne n'avait encore lancé le mode production.
- **`prisma generate` avant `nest build`, jamais l'inverse.** Le client est
  généré en TypeScript dans `src/generated/` et c'est `nest build` qui le
  compile. Et l'étape de construction doit porter une `DATABASE_URL`, même
  bidon : `prisma.config.ts` résout `env('DATABASE_URL')` au chargement et lève
  si elle manque. La génération ne se connecte à rien.
- **Le `node_modules` de l'image finale reste complet.** `prisma` est une
  `devDependency`, et `migrate deploy` en a besoin au démarrage : un
  `npm ci --omit=dev` donne une image plus légère et un conteneur qui ne démarre
  pas.
- **La sonde de l'API vise `127.0.0.1`, jamais `localhost`.** `main.ts` écoute
  sur `0.0.0.0`, donc en IPv4 seulement, tandis que le `wget` de busybox tente
  `::1` en premier — la sonde renvoie « Connection refused » sur une API
  parfaitement démarrée.

**Le piège qui coûte le plus cher : les deux composes partagent le nom de
projet**, celui du dossier, et Compose en déduit les noms d'images. Un
`docker compose -f docker-compose.prod.yml build` nu écrase donc `fripstock-api`
et `fripstock-web` : le conteneur de développement repart ensuite sur l'image de
production, qui tourne en `USER node` et n'a pas la même arborescence. Le
symptôme n'a rien à voir avec la cause — `make format` échoue sur un
`EACCES: permission denied, open '/app/prisma/schema.prisma'`. Les cibles
`prod-*` posent toutes `-p $(PROD_PROJECT)` pour cette raison ; ne jamais
appeler le compose de production à la main sans elle.

Les cibles cloisonnent aussi les volumes, préfixés par le même nom de projet :
`make prod-down` détruit ceux de la stack de production locale et laisse la base
de développement intacte.

```sh
make prod-build   # construit les deux images
make prod-up      # démarre la stack de production en local
make prod-down    # l'arrête et détruit SES volumes
```

`SHOP_TIMEZONE` ne figure dans aucun `.env.example` alors que le code la lit des
deux côtés (défaut `Europe/Paris`). En production, la poser explicitement.

Voir aussi [ou-chercher](ou-chercher.md).
