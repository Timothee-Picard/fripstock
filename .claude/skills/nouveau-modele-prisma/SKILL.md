---
name: nouveau-modele-prisma
description: Ajoute un nouveau modèle au schéma Prisma de Fripstock en respectant les conventions du projet, génère la migration et rappelle de mettre à jour le seed si nécessaire. Use when adding a new database table.
argument-hint: [nom-du-modele]
disable-model-invocation: true
allowed-tools: Bash(docker compose exec *), Bash(npx prisma *), Bash(make migrate)
---

Ajoute un modèle `$ARGUMENTS` à `apps/api/prisma/schema.prisma`.

## Avant d'écrire le modèle

Relis la section correspondante de `CLAUDE.md` si le modèle touche au catalogue, aux
produits, aux statuts ou au dépôt-vente — les règles métier précises y sont déjà
posées (champs obligatoires, flags de comportement, relations attendues). Ne réinvente
pas une règle qui y est déjà définie.

## Conventions à respecter

- Nom du modèle en français, `PascalCase`.
- Champs en français, `camelCase`.
- `@@map("nom_snake_case")` sur le modèle, `@map("champ_snake_case")` sur les champs
  dont le nom camelCase contient plusieurs mots.
- Une clé primaire `id` en `String @id @default(uuid())` ou `Int @id @default(autoincrement())`
  selon ce qui est déjà utilisé ailleurs dans le schéma — reste cohérent avec
  l'existant plutôt que de mélanger les deux approches.
- Si le modèle appartient à une Entreprise ou une Boutique, ajoute la clé étrangère
  correspondante avec un index (`@@index([entrepriseId])`), pour permettre le scoping
  multi-tenant rapide en lecture.
- Choisis `onDelete: Cascade` pour les données qui n'ont pas de sens sans leur parent
  (ex: une valeur d'attribut sans son produit), `onDelete: Restrict` pour éviter une
  suppression accidentelle qui casserait des données encore référencées (ex: un statut
  encore utilisé par des produits).

## Étapes

1. Ajoute le modèle dans `schema.prisma`.
2. Génère la migration : `npx prisma migrate dev --name $ARGUMENTS` (dans le
   conteneur `api`, via `docker compose exec api ...` ou `make migrate` si le
   Makefile a une cible adaptée).
3. Si le modèle a des données de départ évidentes (un statut par défaut, un template
   d'attribut...), propose une mise à jour de `apps/api/prisma/seed.ts` plutôt que de
   la faire automatiquement — certains modèles n'ont pas besoin de données de seed.
4. Rappelle si une règle de `CLAUDE.md` devrait être mise à jour suite à ce
   changement (par exemple un nouveau flag de comportement à documenter).
