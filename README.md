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

| Cible | Effet |
|---|---|
| `make up` | Démarre la stack en arrière-plan |
| `make down` | Arrête la stack, conserve les données |
| `make build` | Reconstruit les images (après un changement de dépendances) |
| `make logs` | Suit les logs de tous les services |
| `make restart` | Redémarre les conteneurs sans reconstruire |
| `make ps` | État des conteneurs |
| `make sh-api` / `make sh-web` | Shell dans un conteneur |

Le code est monté en volume : une modification dans `apps/api` ou `apps/web` est
rechargée à chaud, sans reconstruire l'image. Seul un changement de dépendances
(`package.json`) impose un `make build`.

## Organisation du dépôt

```
apps/
├── api/       API NestJS (TypeScript strict, Prisma, class-validator)
└── web/       Front Next.js (App Router, TypeScript, Tailwind)
docker-compose.yml   postgres, minio, api, web
Makefile             raccourcis de développement
prompts/             un prompt Claude Code par étape du PLAN.md
docs/KIT.md          documentation du kit de démarrage
```

- **`CLAUDE.md`** — règles métier et conventions de code. C'est le document qui fait foi ;
  il est chargé automatiquement par Claude Code à chaque session.
- **`PLAN.md`** — les 8 étapes de développement (0 à 7) et leur avancement.
- **`docs/KIT.md`** — comment se servir du kit de prompts et de la configuration
  `.claude/` (skills, subagents, hooks).

## État d'avancement

Étape 0 terminée : le squelette tourne. Aucun modèle de données ni authentification pour
l'instant — voir `PLAN.md` pour la suite.
