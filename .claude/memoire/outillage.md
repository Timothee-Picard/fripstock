# Outillage et commandes

> Fripstock — aucun Node sur l'hôte, tout passe par les conteneurs ; et comment écrire une migration à la main.

Sur cette machine, **Node n'est pas installé pour ce dépôt** : toute commande
Node passe par `./scripts/node-run.sh <dossier-relatif> <commande...>`, qui
l'exécute dans le conteneur du service. Lancer `npx` ou `npm` depuis l'hôte
échoue sur un `invalid ELF header` — les `node_modules` sont installés par les
images Alpine (musl) et sont illisibles par la glibc de l'hôte.

`./scripts/node-run.sh` est relatif à la **racine du dépôt** : il faut y être.
Après un `cd apps/api` dans une commande précédente, le chemin ne résout plus.

**Vérifications** : toujours `make check`, jamais les commandes recopiées — c'est
exactement ce que lance la CI, et la cible génère d'abord le client Prisma.
`make format` avant, sinon `check-format` échoue sur du Prettier.

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

Voir aussi [ou-chercher](ou-chercher.md).
