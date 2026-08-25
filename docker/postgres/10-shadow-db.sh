#!/bin/sh
# Crée la base miroir utilisée par `prisma migrate diff` pour rejouer les
# migrations et détecter une dérive du schéma (make check-db). Prisma 7 ne la
# crée plus lui-même.
#
# Exécuté par l'image postgres au tout premier démarrage d'un volume vide.
set -e
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<SQL
  SELECT 'CREATE DATABASE "${POSTGRES_DB}_shadow"'
   WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${POSTGRES_DB}_shadow')\gexec
SQL
