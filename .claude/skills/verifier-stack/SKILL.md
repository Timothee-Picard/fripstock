---
name: verifier-stack
description: Relance la stack Fripstock, applique les migrations et le seed, puis vérifie que l'API et le front répondent. Use manually after a change touching Docker, Prisma or the boot sequence.
disable-model-invocation: true
allowed-tools: Bash(make *), Bash(docker compose *), Bash(curl localhost:*), Bash(curl http://localhost:*)
---

## État actuel des conteneurs

!`docker compose ps 2>/dev/null || echo "docker compose n'a pas encore été lancé, ou pas depuis ce dossier"`

## Ta tâche

1. Lance `make up` et attends que les conteneurs soient prêts.
2. Applique les migrations et le seed : `make migrate`, `make seed`.
3. Vérifie que l'API répond : `curl -s http://localhost:3001/health`. Adapte le port
   et le chemin à ce qui est réellement configuré — ne suppose pas, vérifie dans le
   `docker-compose.yml` et le code de l'API.
4. Vérifie que le front répond de la même façon.
5. Regarde les logs (`docker compose logs --tail=50 api` et `web`) s'il y a une
   erreur, pour donner un diagnostic utile plutôt qu'un simple « ça ne marche pas ».
6. Lance `make check` — format, lint, types, dérive Prisma, tests, build. Rien n'est
   validé si `make check` est rouge, même si la stack démarre.

## Le piège à surveiller

`apps/api/src/generated/` est ignoré par git : sur un clone frais il n'existe pas, et
sans lui l'API ne démarre pas du tout. `make check` et le conteneur `api` le génèrent
eux-mêmes. Si l'API ne répond jamais, c'est la première chose à vérifier dans ses logs.

## Rapport attendu

- Ce qui fonctionne, **avec la preuve** : la sortie de la commande, pas une affirmation.
- Ce qui ne fonctionne pas, avec l'erreur exacte et une hypothèse sur la cause.
