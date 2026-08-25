# apps/web — Front Fripstock

Front Next.js (App Router, TypeScript, Tailwind).

Ne lance rien depuis ce dossier : toute la stack se démarre depuis la racine du dépôt
avec `make up`, et le code est rechargé à chaud dans le conteneur. Pour une commande
ponctuelle, passe par `make sh-web`.

Voir le `README.md` de la racine pour le démarrage, et `CLAUDE.md` pour les règles
métier et les conventions de code.

`AGENTS.md` (et le `CLAUDE.md` local qui l'inclut) sont régénérés par `next dev` : ils
signalent que cette version de Next diffère des données d'entraînement des assistants et
pointent vers `node_modules/next/dist/docs/`. Les garder versionnés évite de les voir
réapparaître en modification non commitée à chaque lancement.
