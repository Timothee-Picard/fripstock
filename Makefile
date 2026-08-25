# Fripstock — raccourcis de développement.
# Toutes les cibles supposent un fichier .env à la racine (cp .env.example .env).

.DEFAULT_GOAL := help
.PHONY: help up down build rebuild logs restart ps sh-api sh-web

help: ## Affiche cette aide
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

up: ## Démarre toute la stack en arrière-plan (postgres, minio, api, web)
	docker compose up -d

down: ## Arrête la stack en conservant les volumes (données de la base gardées)
	docker compose down

build: ## Reconstruit les images api et web (après un changement de dépendances)
	docker compose build

rebuild: ## Reconstruit sans cache puis redémarre — à utiliser quand `build` ne suffit pas
	docker compose build --no-cache
	docker compose up -d

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
