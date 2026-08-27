# Fripstock — raccourcis de développement.
# Toutes les cibles supposent un fichier .env à la racine (cp .env.example .env).

.DEFAULT_GOAL := help
.PHONY: help up down build rebuild logs restart ps sh-api sh-web \
	install hooks format generate migrate seed studio check check-format check-lint check-types check-db \
	check-test check-build check-commits release

help: ## Affiche cette aide
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

up: ## Démarre toute la stack en arrière-plan (postgres, minio, api, web)
	docker compose up -d

down: ## Arrête la stack en conservant les volumes (données de la base gardées)
	docker compose down

build: ## Reconstruit les images et redémarre avec des node_modules à jour
	docker compose build
	@# --renew-anon-volumes est indispensable : sans lui, Compose reporte le
	@# volume anonyme node_modules de l'ancien conteneur sur le nouveau, et les
	@# dépendances fraîchement installées restent invisibles malgré le rebuild.
	docker compose up -d --force-recreate --renew-anon-volumes

rebuild: ## Reconstruit sans cache puis redémarre — quand `build` ne suffit pas
	docker compose build --no-cache
	docker compose up -d --force-recreate --renew-anon-volumes

logs: ## Suit les logs de tous les services (Ctrl-C pour sortir)
	docker compose logs -f

restart: ## Redémarre les conteneurs sans les reconstruire
	docker compose restart

ps: ## Affiche l'état des conteneurs
	docker compose ps

sh-api: ## Ouvre un shell dans le conteneur api
	docker compose exec api sh

sh-web: ## Ouvre un shell dans le conteneur web
	docker compose exec web sh

# --- Base de données ---------------------------------------------------------

migrate: ## Crée et applique les migrations Prisma (dans le conteneur api)
	docker compose exec api npx prisma migrate dev

migrate-deploy: ## Applique les migrations existantes sans en créer de nouvelle
	docker compose exec api npx prisma migrate deploy

seed: ## Injecte le jeu de données de démonstration
	docker compose exec api npm run db:seed

studio: ## Ouvre Prisma Studio sur http://localhost:5555
	docker compose exec api npx prisma studio --port 5555 --hostname 0.0.0.0

# --- Qualité -----------------------------------------------------------------
# Toutes ces cibles passent par scripts/node-run.sh, qui utilise Node en local
# s'il est installé (cas de la CI) et un conteneur jetable sinon (cas de cette
# machine). La CI n'exécute rien d'autre que ces cibles : c'est ce qui garantit
# qu'un `make check` vert en local veut dire quelque chose.

install: ## Installe les dépendances (outillage racine + les deux apps) et pose les hooks git
	./scripts/node-run.sh . npm install
	./scripts/node-run.sh apps/api npm install
	./scripts/node-run.sh apps/web npm install
	$(MAKE) hooks

hooks: ## Active les hooks git du dépôt (à relancer après un clone)
	git config core.hooksPath .githooks
	@echo "hooks git actifs : $$(git config core.hooksPath)"

format: ## Reformate tout le dépôt (Prettier + schéma Prisma)
	./scripts/node-run.sh . npx --no -- prettier --write .
	@# Le schéma Prisma a son propre formateur. Il passe par le conteneur api :
	@# prisma.config.ts résout env('DATABASE_URL') au chargement, donc toute
	@# commande Prisma lancée hors du conteneur échoue. Prisma réécrit le
	@# fichier en place, le propriétaire côté hôte est préservé.
	@if [ -f apps/api/prisma/schema.prisma ]; then \
		./scripts/node-run.sh apps/api npx --no -- prisma format; \
	fi

generate: ## Génère le client Prisma à partir du schéma
	@echo "--> client prisma"
	@# `src/generated/` est ignoré par git : sur un dépôt fraîchement cloné il
	@# n'existe pas, et sans lui chaque type Prisma devient un type d'erreur —
	@# le lint rendait alors un millier de « Unsafe ... of a type that could
	@# not be resolved ». Invisible en local, où le dossier traîne d'une
	@# génération précédente ; fatal en CI.
	@if [ -f apps/api/prisma/schema.prisma ]; then \
		./scripts/node-run.sh apps/api npx --no -- prisma generate; \
	fi

check: generate check-format check-lint check-types check-db check-test check-build ## Lance toutes les vérifications (identique à la CI)
	@echo "==> make check : tout est vert"

check-format: ## Vérifie le formatage Prettier
	@echo "--> format"
	@./scripts/node-run.sh . npx --no -- prettier --check .

check-lint: ## Lance ESLint sur les deux apps
	@echo "--> lint api"
	@./scripts/node-run.sh apps/api npm run lint
	@echo "--> lint web"
	@./scripts/node-run.sh apps/web npm run lint

check-types: ## Vérifie le typage TypeScript sans émettre de fichiers
	@echo "--> types api"
	@./scripts/node-run.sh apps/api npx --no -- tsc --noEmit --incremental false
	@echo "--> types web"
	@# `next typegen` génère les types de routes (LayoutProps, PageProps...) que
	@# tsc ne peut pas connaître autrement — motif documenté par Next pour
	@# vérifier le typage sans build complet. Les deux commandes doivent tourner
	@# dans la MÊME invocation : chaque `docker compose run` repart d'un .next
	@# vide, donc tsc ne verrait pas les types générés par un appel précédent.
	@./scripts/node-run.sh apps/web sh -c 'npx --no -- next typegen && npx --no -- tsc --noEmit --incremental false'

check-db: ## Valide le schéma Prisma et détecte une dérive avec les migrations
	@echo "--> base"
	@./scripts/check-db.sh

check-test: ## Lance les tests des deux apps, couverture comprise
	@echo "--> tests api"
	@./scripts/node-run.sh apps/api npx --no -- jest --coverage --passWithNoTests
	@echo "--> tests web"
	@./scripts/node-run.sh apps/web npx --no -- vitest run --coverage

check-build: ## Vérifie que les deux apps compilent
	@echo "--> build api"
	@./scripts/node-run.sh apps/api npm run build
	@echo "--> build web"
	@./scripts/node-run.sh apps/web npm run build

check-commits: ## Vérifie la convention sur les messages de commit (défaut : tout l'historique)
	@echo "--> messages de commit"
	@./scripts/check-commits.sh $(RANGE)

# --- Release -----------------------------------------------------------------

release: ## Calcule le prochain vX.Y.Z depuis les commits, génère le CHANGELOG et pose le tag
	./scripts/release.sh
