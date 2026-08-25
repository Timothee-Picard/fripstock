---
name: nouveau-module-nest
description: Scaffold un nouveau module NestJS (controller, service, module, DTOs) dans apps/api en respectant les conventions Fripstock — nommage français, scoping entreprise/boutique, guards de permissions. Use when adding a new domain module to the API.
argument-hint: [nom-du-module]
disable-model-invocation: true
---

Crée un nouveau module NestJS nommé `$ARGUMENTS` dans `apps/api/src/`.

## Fichiers à créer

Dans `apps/api/src/$ARGUMENTS/` :

- `$ARGUMENTS.module.ts` — déclare le controller, le service, importe `PrismaModule`.
- `$ARGUMENTS.controller.ts` — routes REST, avec les décorateurs de permission
  (`@RequirePermission('...')`) sur toute route d'écriture, en te basant sur la liste
  de permissions définie dans `CLAUDE.md`.
- `$ARGUMENTS.service.ts` — logique métier, utilise `PrismaService` injecté.
- `dto/` — un DTO par action d'écriture (create, update...), avec `class-validator`
  (`@IsString()`, `@IsNumber()`, `@IsOptional()`, etc. selon les champs).

## Règles à respecter systématiquement

1. **Scoping multi-tenant** : toute requête Prisma sur une ressource métier doit
   filtrer par `entrepriseId` (et `boutiqueId` quand pertinent), déduit du JWT via le
   décorateur `@CurrentUser()` — jamais d'un paramètre fourni par le client. Vérifie
   dans `CLAUDE.md` la règle exacte avant d'écrire la première requête.
2. **Permissions** : chaque route de mutation (POST/PUT/DELETE) doit avoir
   `@RequirePermission('...')` avec la clé de permission adaptée (voir la liste dans
   `CLAUDE.md`). Le gérant bypass ce contrôle automatiquement, ne duplique pas cette
   logique dans le nouveau module.
3. **Nommage** : modèles et champs Prisma en français (voir "Conventions de code" dans
   `CLAUDE.md`). Les noms de fichiers et de classes NestJS suivent les conventions
   NestJS standards (kebab-case pour les fichiers, PascalCase pour les classes).
4. **Enregistrement** : ajoute le nouveau module aux imports de `app.module.ts`.

## Après la création

Résume les endpoints créés (méthode, chemin, permission requise) pour que l'utilisateur
puisse les tester rapidement, par exemple avec `curl` ou `/verifier-etape`.
