# Image de développement uniquement : le code est monté en volume et rechargé à
# chaud par `next dev`. Pas de build de production ici (voir PLAN.md).
FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "-H", "0.0.0.0"]
