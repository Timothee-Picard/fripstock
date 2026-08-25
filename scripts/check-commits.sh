#!/usr/bin/env sh
# Vérifie que les messages de commit d'une plage respectent la convention.
#
# On ne passe pas par `commitlint --from/--to` : ces options appellent git
# (merge-base, rev-list), absent de l'image node utilisée localement. Le script
# tourne sur l'hôte, où git existe : il parcourt la plage lui-même et envoie
# chaque message à commitlint sur son entrée standard.
#
# Usage : scripts/check-commits.sh [plage]   (défaut : tout l'historique)
set -e

ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"

range=${1:-}
if [ -z "$range" ]; then
  range=$(git rev-list --max-parents=0 HEAD | tail -1)..HEAD
  first=$(git rev-list --max-parents=0 HEAD | tail -1)
  shas="$first $(git rev-list "$range")"
else
  shas=$(git rev-list "$range")
fi

failed=0
count=0
for sha in $shas; do
  count=$((count + 1))
  subject=$(git log -1 --format=%s "$sha")
  if git log -1 --format=%B "$sha" | ./scripts/node-run.sh . npx --no -- commitlint >/dev/null 2>&1; then
    printf '  ok   %s %s\n' "$(git log -1 --format=%h "$sha")" "$subject"
  else
    printf '  !!   %s %s\n' "$(git log -1 --format=%h "$sha")" "$subject"
    git log -1 --format=%B "$sha" | ./scripts/node-run.sh . npx --no -- commitlint 2>&1 | grep -E '✖|⚠' | sed 's/^/       /'
    failed=1
  fi
done

echo "  ${count} commit(s) vérifié(s)"
exit $failed
