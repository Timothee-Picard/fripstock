# Plan de développement Fripstock

À dérouler dans l'ordre avec Claude Code, un prompt de `prompts` par étape, dans une
session dédiée (ou en continu, mais valide/teste avant de passer à la suivante). Chaque
étape doit se terminer dans un état qui tourne avec `make up`.

- [x] **Étape 0 — Squelette du repo**
      Monorepo, docker-compose, Makefile, apps vides qui démarrent.
- [x] **Étape 1 — Qualité & CI**
      Conventional commits (husky + commitlint), `make check` (format, lint, types,
      dérive Prisma, tests, build), CI GitHub Actions, `make release` pour les tags
      `vX.Y.Z`.
- [x] **Étape 2 — Base de données**
      Schéma Prisma complet, migration initiale, seed (templates d'attributs, statuts
      de base, un jeu de données de démo).
- [x] **Étape 3 — Auth & organisation**
      Inscription (Entreprise + gérant), login JWT, CRUD Boutiques, invitation
      employés + permissions par boutique, guards Nest, pages Next.js de base.
- [x] **Étape 4 — Catalogue**
      Catégories hiérarchiques, attributs dynamiques + options, association
      attributs/catégories, admin dans Next.js.
- [x] **Étape 5 — Produits & stock**
      CRUD produit, assignation à une boutique, upload photo (MinIO), valeurs
      d'attributs dynamiques, statuts personnalisables, changement de statut +
      historique, pages Next.js (liste, création, fiche).
- [x] **Étape 6 — Dépôt-vente & notifications**
      Clients déposants, contrats de dépôt, commission, blocage revente si rendu,
      suivi paiement déposant, job planifié d'alerte d'échéance de contrat, pages
      Next.js.
- [x] **Étape 7 — Stats & export CSV**
      Dashboard (CA, meilleures ventes, taux de rendus), export CSV filtré du stock.

## Pourquoi cet ordre

Qualité et CI en deuxième parce que la convention de commit ne se rattrape pas : un
historique écrit sans elle reste sale, et le versioning `vX.Y.Z` en dépend directement.
Le squelette passe avant, sinon il n'y a rien à linter ni à builder.

Auth avant catalogue avant produits parce que chaque étape suivante a besoin de pouvoir
scoper ses données par entreprise/boutique et donc d'un JWT + de guards fonctionnels.
Dépôt-vente vient après produits parce qu'il s'y accroche (`ContratDepot` référence des
`Produit`) — les notifications d'échéance de contrat sont regroupées dans cette même
étape puisqu'elles portent uniquement sur les contrats de dépôt. Stats/export est mis
en dernier parce que c'est une couche qui lit des données déjà là — rien ne bloque
dessus.

## Correspondance étapes ↔ prompts

| Étape | Fichier prompt                    |
| ----- | --------------------------------- |
| 0     | `prompts/00-squelette-repo.md`    |
| 1     | `prompts/01-qualite-ci.md`        |
| 2     | `prompts/02-base-de-donnees.md`   |
| 3     | `prompts/03-auth-organisation.md` |
| 4     | `prompts/04-catalogue.md`         |
| 5     | `prompts/05-produits.md`          |
| 6     | `prompts/06-depot-vente.md`       |
| 7     | `prompts/07-stats-export.md`      |
