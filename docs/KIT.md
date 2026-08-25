# Fripstock

Application de gestion de stock pour boutiques de vêtements et objets de seconde main.
Ce dépôt ne contient pas encore de code applicatif : c'est le **kit de démarrage** —
contexte métier, plan de développement, prompts Claude Code et configuration — pour
faire construire l'application étape par étape.

## Le projet

Aujourd'hui, la gestion du stock se fait à la main dans des tableurs (voir l'exemple
qui a servi de référence pour le modèle de données, plus bas). Fripstock doit remplacer
ça par une vraie application, pensée pour deux façons de vendre qui coexistent souvent
dans ce secteur :

- **Achat-revente classique** : la boutique achète l'article, fixe un prix de vente, et
  encaisse la vente.
- **Dépôt-vente** : un client dépose un article pour une durée donnée, avec une
  commission convenue. Si l'article ne se vend pas dans les temps, il est rendu au
  client — et ne doit plus jamais pouvoir être vendu après ça.

### Ce que l'application doit faire

- **Multi-entreprises** : une entreprise gère une ou plusieurs boutiques physiques,
  chacune avec son propre stock. Un gérant peut avoir des employés avec des permissions
  différentes selon la boutique.
- **Catalogue configurable** : chaque entreprise définit ses propres catégories de
  produits (hiérarchiques) et ses propres attributs (taille, couleur, matière, marque,
  ou autre) à partir d'une bibliothèque de modèles courants, personnalisable sans
  affecter les autres entreprises.
- **Fiches produit** : photo, nom, description, commentaire, prix d'achat et prix de
  vente, avec changement de statut simple (en stock, en rayon, réservé, vendu, rendu,
  retiré...) — statuts eux-mêmes personnalisables par le gérant.
- **Suivi du dépôt-vente** : fiches déposants (avec IBAN pour le règlement), contrats
  avec durée et commission, alertes automatiques à l'approche de l'échéance, et suivi
  de ce qui a été payé ou non au déposant.
- **Export et statistiques** : export CSV du stock (complet ou filtré), tableau de bord
  avec chiffre d'affaires, meilleures ventes, taux de retour.

### Stack technique

NextJS (frontend) + NestJS (API) + PostgreSQL via Prisma + MinIO pour les photos, le
tout orchestré avec docker-compose et un Makefile. Voir `CLAUDE.md` pour le détail
complet des choix techniques et des règles métier.

## Contenu du kit

- **`CLAUDE.md`** — le contexte projet complet (règles métier, stack, conventions).
  Placé à la racine du repo de code, il est chargé automatiquement par Claude Code à
  chaque session : pas besoin de répéter les règles métier dans chaque prompt.
- **`PLAN.md`** — la liste des 8 étapes de développement (0 à 7), avec la
  correspondance vers les prompts.
- **`prompts/00-squelette-repo.md`** à **`prompts/07-stats-export.md`** — un prompt
  prêt-à-coller par étape.
- **`.claude/`** — configuration Claude Code prête à l'emploi : permissions, hooks de
  sécurité, skills et subagents adaptés à ce projet (détaillé plus bas).
- **`docs/KIT.md`** — ce fichier. La racine du repo est réservée à la documentation
  applicative : le `README.md` de la racine est écrit à l'étape 0 et explique comment
  démarrer l'application, pas comment se servir du kit.

## Comment procéder

1. Crée ton repo git, copie tout le contenu de ce kit à la racine (`CLAUDE.md`,
   `PLAN.md`, `prompts/`, `.claude/`, `docs/`).
2. Lance Claude Code dans ce dossier.
3. Colle le contenu de `prompts/00-squelette-repo.md` dans une session. Laisse Claude
   Code travailler, relis le résultat, teste avec `make up`.
4. Une fois satisfait, commit, puis passe au prompt suivant (`01-qualite-ci.md`)
   — idéalement dans une nouvelle session pour repartir avec un contexte propre (Claude
   Code relira `CLAUDE.md` automatiquement).
5. Répète pour chaque étape dans l'ordre du `PLAN.md`. Coche la case correspondante une
   fois l'étape validée. Le skill `/verifier-etape` (voir plus bas) automatise une
   partie de cette vérification.

### Si tu veux ajuster une règle métier en cours de route

Modifie directement `CLAUDE.md` avant de lancer le prompt de l'étape suivante — comme
c'est chargé automatiquement, la correction s'applique à tout ce qui suit sans que tu
aies besoin de la répéter.

### Si une étape échoue ou part dans une mauvaise direction

Mieux vaut arrêter, corriger le prompt de l'étape et relancer une session fraîche,
plutôt que d'essayer de rattraper le tir dans une session déjà longue et chargée de
contexte périmé.

## Configuration Claude Code incluse (`.claude/`)

Ce kit inclut une configuration Claude Code adaptée à Fripstock, pas seulement le
contexte métier. Tout est optionnel — Claude Code fonctionne très bien avec juste
`CLAUDE.md` — mais ça évite de re-expliquer les mêmes réflexes à chaque session.

```
.claude/
├── settings.json         # permissions (quelles commandes sont pré-autorisées) + hooks
├── hooks/
│   ├── protect-files.sh      # bloque les modifications de fichiers sensibles
│   └── format-after-edit.sh  # reformate automatiquement le code modifié
├── skills/
│   ├── nouveau-module-nest/    # /nouveau-module-nest — scaffold un module NestJS
│   ├── nouveau-modele-prisma/  # /nouveau-modele-prisma — ajoute un modèle + migration
│   └── verifier-etape/         # /verifier-etape — relance la stack et vérifie l'état
└── agents/
    ├── revue-fripstock.md       # subagent de revue de code orienté règles métier
    └── revue-schema-prisma.md   # subagent de revue de schéma de base de données
```

### `settings.json` — permissions et hooks

- **Permissions** : pré-autorise les commandes qu'on utilise sans arrêt sur ce projet
  (`make`, `docker compose`, `npm`, `npx prisma`), pour éviter une confirmation
  manuelle à chaque appel. Les commandes destructrices (`git push`, reset de la base)
  restent en confirmation explicite.
- **Hook `protect-files.sh`** (avant chaque modification de fichier) : bloque toute
  modification des fichiers `.env`, des migrations Prisma déjà appliquées
  (`prisma/migrations/`), et de `.git/` — trois erreurs classiques qui cassent
  silencieusement un projet.
- **Hook `format-after-edit.sh`** (après chaque modification de fichier) : relance
  Prettier sur le fichier modifié si l'outil est installé dans le projet, pour garder
  un style cohérent sans y penser.

### Skills — procédures répétables

Les skills remplacent ce qu'on appelait les "commandes personnalisées" : on les invoque
avec `/nom-du-skill`, ou Claude les déclenche seul quand c'est pertinent.

- **`/nouveau-module-nest <nom>`** : scaffold un module NestJS complet (controller,
  service, module, DTOs) en respectant les conventions du projet — nommage français,
  scoping par entreprise/boutique, guards de permissions. Invocation manuelle
  uniquement (ça crée des fichiers, autant garder la main sur le moment).
- **`/nouveau-modele-prisma <nom>`** : ajoute un modèle au schéma Prisma en respectant
  les conventions (français, camelCase, `@@map` en snake_case), lance la migration, et
  rappelle de mettre à jour le seed si pertinent. Invocation manuelle uniquement.
- **`/verifier-etape`** : relance la stack (`make up`), applique les migrations et le
  seed, vérifie que l'API répond, et résume ce qui fonctionne ou non — un moyen rapide
  de vérifier le critère de validation d'une étape du `PLAN.md`.

### Subagents — revues spécialisées

- **`revue-fripstock`** : relit le code récemment modifié à la lumière des règles
  métier du projet (scoping multi-tenant, permissions par boutique, logique de statut
  bloquant la revente). À utiliser après chaque étape, avant de passer à la suivante :
  _"Utilise le subagent revue-fripstock sur les changements de cette étape."_
- **`revue-schema-prisma`** : relit spécifiquement les changements du schéma Prisma
  (relations, `onDelete`, index sur les clés étrangères, présence du scoping
  multi-tenant sur chaque table qui en a besoin).

Les deux sont en lecture seule (pas d'accès `Edit`/`Write`) : ils rapportent des
problèmes, ils ne les corrigent pas eux-mêmes — pour garder la main sur ce qui change
dans le code.
