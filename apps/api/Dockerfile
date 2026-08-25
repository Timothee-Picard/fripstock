# Image de développement uniquement : le code est monté en volume et rechargé à
# chaud par `nest start --watch`. Pas de build multi-stage tant qu'on n'a pas de
# cible de production (voir PLAN.md).
FROM node:24-alpine

WORKDIR /app

# Les dépendances sont installées dans l'image, pas dans le volume monté :
# le docker-compose place un volume anonyme sur /app/node_modules pour que le
# dossier de l'hôte ne vienne pas les masquer.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 3001

CMD ["npm", "run", "start:dev"]
