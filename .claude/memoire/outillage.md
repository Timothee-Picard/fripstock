# Outillage et commandes

> Fripstock — aucun Node sur l'hôte, tout passe par les conteneurs ; et comment écrire une migration à la main.

Sur cette machine, **Node n'est pas installé pour ce dépôt** : toute commande
Node passe par `./scripts/node-run.sh <dossier-relatif> <commande...>`, qui
l'exécute dans le conteneur du service. Lancer `npx` ou `npm` depuis l'hôte
échoue sur un `invalid ELF header` — les `node_modules` sont installés par les
images Alpine (musl) et sont illisibles par la glibc de l'hôte.

`./scripts/node-run.sh` est relatif à la **racine du dépôt** : il faut y être.
Après un `cd apps/api` dans une commande précédente, le chemin ne résout plus.

**Vérifications** : toujours une cible `make`, jamais les commandes recopiées.
`make check` est le jeu complet, celui de la CI ; `make check-fast` est le même
sans tests ni build (~1 min 30 contre ~3 min), et c'est ce que lance le hook
`pre-push`. Les deux génèrent d'abord le client Prisma. `make format` avant,
sinon `check-format` échoue sur du Prettier.

Avant de déclarer une tâche finie, c'est `make check` qu'il faut : `check-fast`
ne dit rien des tests ni du build.

**Le seed remet les produits à zéro** à chaque passage, contrairement au reste
qui fait de l'upsert. C'est délibéré : il sautait auparavant ceux dont la
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

Voir aussi [ou-chercher](ou-chercher.md).
