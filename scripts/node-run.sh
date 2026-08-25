#!/usr/bin/env sh
# Exécute une commande Node depuis un dossier du dépôt.
#
# Cette machine n'a pas Node installé, la CI si. Le script choisit donc :
#
#   1. Node local s'il existe (cas de la CI) — chemin direct, rapide.
#   2. Sinon, le conteneur du service concerné pour apps/api et apps/web.
#      C'est important : ces conteneurs isolent déjà `dist/` et `.next/` dans
#      des volumes anonymes. Un `docker run` générique écrirait dedans depuis
#      l'hôte, où ces dossiers appartiennent à root, et échouerait en EACCES.
#   3. Sinon, un conteneur jetable sous l'UID de l'hôte pour l'outillage de la
#      racine (prettier, commitlint), qui ne touche que des fichiers versionnés.
#
# Usage : scripts/node-run.sh <dossier-relatif> <commande...>
set -e

NODE_IMAGE=node:24-alpine

ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
DIR=${1:-.}
shift

# 1. Node disponible localement (CI, ou machine de dev équipée).
if command -v npm >/dev/null 2>&1; then
  cd "$ROOT/$DIR"
  exec "$@"
fi

# 2. Commande visant une app : on passe par son propre conteneur.
case "$DIR" in
  apps/api) exec docker compose -f "$ROOT/docker-compose.yml" run --rm --no-deps -T api "$@" ;;
  apps/web) exec docker compose -f "$ROOT/docker-compose.yml" run --rm --no-deps -T web "$@" ;;
esac

# 3. Outillage de la racine.
exec docker run --rm -i \
  -e HOME=/tmp \
  -u "$(id -u):$(id -g)" \
  -v "$ROOT":/repo \
  -w "/repo/$DIR" \
  "$NODE_IMAGE" "$@"
