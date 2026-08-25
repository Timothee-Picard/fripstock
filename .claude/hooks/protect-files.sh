#!/bin/bash
# Bloque les modifications de fichiers sensibles : secrets, migrations déjà
# appliquées, et le dossier .git. Appelé en PreToolUse sur Edit|Write.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Normalise les séparateurs Windows pour que les motifs ci-dessous matchent aussi
FILE_PATH="${FILE_PATH//\\//}"

PROTECTED_PATTERNS=(
  ".env"
  ".git/"
  "prisma/migrations/"
)

for pattern in "${PROTECTED_PATTERNS[@]}"; do
  if [[ "$FILE_PATH" == *"$pattern"* ]]; then
    echo "Bloqué : $FILE_PATH correspond au motif protégé '$pattern'. Si une migration doit changer, crée-en une nouvelle avec 'npx prisma migrate dev' plutôt que d'éditer une migration déjà appliquée. Pour les fichiers .env, demande à l'utilisateur de le modifier lui-même." >&2
    exit 2
  fi
done

exit 0
