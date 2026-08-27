#!/bin/bash
# Reformate le fichier modifié avec Prettier, si l'outil est installé dans le
# sous-projet concerné (apps/api ou apps/web). Ne fait rien silencieusement si
# Prettier n'est pas installé, ou si le fichier
# n'est pas un type de fichier formatable.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.css|*.md)
    ;;
  *)
    exit 0
    ;;
esac

# Cherche le sous-projet concerné (apps/api ou apps/web) en remontant depuis le
# fichier, pour utiliser son Prettier local plutôt qu'une install globale.
DIR=$(dirname "$FILE_PATH")
PROJECT_ROOT=""
while [ "$DIR" != "/" ] && [ "$DIR" != "." ]; do
  if [ -f "$DIR/node_modules/.bin/prettier" ]; then
    PROJECT_ROOT="$DIR"
    break
  fi
  DIR=$(dirname "$DIR")
done

if [ -n "$PROJECT_ROOT" ]; then
  "$PROJECT_ROOT/node_modules/.bin/prettier" --write "$FILE_PATH" > /dev/null 2>&1
fi

exit 0
