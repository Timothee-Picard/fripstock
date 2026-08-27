#!/usr/bin/env sh
# Vérifie le schéma Prisma, et surtout qu'il n'a pas dérivé des migrations déjà
# écrites — un schéma modifié sans `prisma migrate dev` ne se voit autrement
# qu'au déploiement.
#
# Sans schéma Prisma, cette cible sort en succès plutôt qu'en erreur.
set -e

ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

if [ ! -f "$ROOT/apps/api/prisma/schema.prisma" ]; then
  echo "    pas de schéma Prisma — ignoré"
  exit 0
fi

"$ROOT/scripts/node-run.sh" apps/api sh -c '
set -e
npx --no -- prisma validate
npx --no -- prisma format --check

if [ ! -d prisma/migrations ]; then
  echo "    pas encore de migrations — dérive non vérifiable"
  exit 0
fi

if [ -z "${SHADOW_DATABASE_URL:-}" ]; then
  echo "    SHADOW_DATABASE_URL absente — dérive non vérifiable ici"
  echo "    (la CI la fournit : voir le job check de .github/workflows/ci.yml)"
  exit 0
fi

# --exit-code : 0 = pas de différence, 2 = différence, 1 = la commande a
# échoué. Distinguer les trois est indispensable, sinon une erreur de
# connexion se lit comme une dérive.
# set +e le temps de la commande : avec set -e, un code 2 (derive detectee)
# tuerait le shell avant la lecture de $?.
set +e
npx --no -- prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema prisma/schema.prisma \
  --exit-code > /tmp/diff.out 2>&1
code=$?
set -e

case $code in
  0) echo "    schéma et migrations cohérents" ;;
  2) echo "    !! le schéma Prisma a dérivé des migrations"
     echo "       une migration manque : make migrate"
     sed "s/^/       /" /tmp/diff.out
     exit 1 ;;
  *) echo "    !! impossible de vérifier la dérive (code $code)"
     sed "s/^/       /" /tmp/diff.out
     exit 1 ;;
esac
'
