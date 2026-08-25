---
name: verifier-etape
description: Relance la stack Fripstock, applique les migrations et le seed, puis vérifie que l'API et le front répondent. Use manually at the end of a PLAN.md step to check its validation criteria.
disable-model-invocation: true
allowed-tools: Bash(make *), Bash(docker compose *), Bash(curl localhost:*), Bash(curl http://localhost:*)
---

## État actuel des conteneurs

!`docker compose ps 2>/dev/null || echo "docker compose n'a pas encore été lancé, ou pas depuis ce dossier"`

## Ta tâche

1. Lance `make up` (ou `docker compose up -d` si le Makefile n'a pas encore cette
   cible) et attends que les conteneurs soient prêts.
2. Applique les migrations et le seed s'ils existent déjà à ce stade du projet
   (`make migrate`, `make seed` — ignore silencieusement si ces cibles n'existent pas
   encore, ça veut dire qu'on n'en est pas encore là dans le `PLAN.md`).
3. Vérifie que l'API répond, par exemple `curl -s http://localhost:3001/health` (adapte
   le port et le chemin à ce qui a été réellement configuré dans le projet — ne
   suppose pas, vérifie dans le `docker-compose.yml` et le code de l'API).
4. Vérifie que le front répond de la même façon si le port a été configuré et exposé.
5. Regarde les logs (`docker compose logs --tail=50 api` et `web`) s'il y a une
   erreur, pour donner un diagnostic utile plutôt qu'un simple "ça ne marche pas".
6. Lance `make check` (format, lint, types, dérive Prisma, tests, build) — la cible
   existe à partir de l'étape 1. Ignore silencieusement si elle n'existe pas encore.
   Une étape n'est pas validée si `make check` est rouge, même si la stack démarre.

## Rapport attendu

Résume clairement, étape par étape du `PLAN.md` en cours :

- Ce qui fonctionne (avec la preuve : sortie de la commande, pas juste une affirmation)
- Ce qui ne fonctionne pas, avec l'erreur exacte et une hypothèse sur la cause
- Si tout fonctionne, rappelle explicitement quel est le critère de validation de
  l'étape en cours (voir `prompts/`) et confirme s'il est rempli ou non
