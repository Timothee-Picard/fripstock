#!/usr/bin/env sh
# Vérifie le schéma Prisma, et surtout qu'il n'a pas dérivé des migrations
# déjà écrites — un schéma modifié sans `prisma migrate dev` ne se voit
# autrement qu'au déploiement.
#
# Le schéma arrive à l'étape 2 : d'ici là, cette cible sort en succès.
set -e

ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
SCHEMA="$ROOT/apps/api/prisma/schema.prisma"

if [ ! -f "$SCHEMA" ]; then
  echo "    pas encore de schéma Prisma (étape 2 du PLAN.md) — ignoré"
  exit 0
fi

"$ROOT/scripts/node-run.sh" apps/api npx --no -- prisma validate
"$ROOT/scripts/node-run.sh" apps/api npx --no -- prisma format --check

if [ ! -d "$ROOT/apps/api/prisma/migrations" ]; then
  echo "    pas encore de migrations — dérive non vérifiable"
  exit 0
fi

# --exit-code renvoie 2 s'il existe une différence entre les migrations
# appliquées et l'état décrit par le schéma.
if ! "$ROOT/scripts/node-run.sh" apps/api npx --no -- prisma migrate diff \
      --from-migrations prisma/migrations \
      --to-schema-datamodel prisma/schema.prisma \
      --shadow-database-url "$SHADOW_DATABASE_URL" \
      --exit-code >/dev/null 2>&1; then
  echo "    !! le schéma Prisma a dérivé des migrations"
  echo "       lance 'make sh-api' puis 'npx prisma migrate dev' pour générer la migration manquante"
  exit 1
fi
echo "    schéma et migrations cohérents"
