# Codex sur Fripstock

La configuration est versionnée dans ce dépôt. Ouvrir Codex à sa racine ; aucune
copie vers le dossier personnel n'est nécessaire. Claude continue de fonctionner.

| Configuration Claude                     | Équivalent Codex                                                      |
| ---------------------------------------- | --------------------------------------------------------------------- |
| `CLAUDE.md`                              | `AGENTS.md` impose sa lecture intégrale comme source commune          |
| `apps/web/CLAUDE.md` importe `AGENTS.md` | `apps/web/AGENTS.md` déjà reconnu par Codex                           |
| `.claude/memoire/`                       | Même mémoire, lue via les instructions racine                         |
| Trois `.claude/skills/`                  | Trois `.agents/skills/`, invocation explicite par `$nom`              |
| Deux `.claude/agents/`                   | Rôles dans `.codex/agents/*.toml`, déclarés dans `.codex/config.toml` |
| `permissions.allow` / `permissions.ask`  | `.codex/rules/fripstock.rules`, sandbox et approbations               |
| `protect-files.sh`                       | Hook `PreToolUse`, adapté aux fichiers et renommages d'un patch       |
| `format-after-edit.sh`                   | Hook `PostToolUse`, Prettier dans le conteneur du projet              |

Exemples : `$nouveau-modele-prisma Supplier`, `$nouveau-module-nest suppliers`,
`$verifier-stack`. Le nom demandé est lu dans le message ; les substitutions
`$ARGUMENTS` et les commandes inline de Claude ont été remplacées par des instructions.
Les trois skills restent manuels comme dans Claude. Les deux agents de revue sont
à demander explicitement ; leur sandbox est en lecture seule et leur modèle hérite
du choix utilisateur.

Les copies Codex corrigent les anciens noms français, les statuts désormais figés,
et les contrôles de permissions. La vérification de stack n'exécute le seed que si
la remise à zéro des données de démonstration est autorisée.

## Activation et limites

La configuration suit les formats de la documentation officielle :
[instructions](https://learn.chatgpt.com/docs/agent-configuration/agents-md),
[skills](https://learn.chatgpt.com/docs/build-skills),
[configuration](https://learn.chatgpt.com/docs/config-file/config-reference),
[règles](https://learn.chatgpt.com/docs/agent-configuration/rules) et
[hooks](https://learn.chatgpt.com/docs/hooks).

Relancer une session pour charger les nouvelles instructions et les rôles. Le projet
doit être reconnu comme fiable pour charger sa couche `.codex/`. Les hooks exigent
une revue de confiance dans Codex : utiliser `/hooks` dans le CLI pour examiner et
activer leurs définitions. Aucune confiance personnelle n'est écrite dans le dépôt.

Les hooks nécessitent Python 3 ; le formatage utilise Docker et
`scripts/node-run.sh`. Ils couvrent `apply_patch`, pas les écritures par shell ou MCP,
comme les hooks Claude ne couvraient que `Edit|Write`. Les consignes d'AGENTS.md
restent applicables à ces autres outils. Le hook protège aussi les destinations de
renommage et les liens symboliques. Comme dans Claude, il bloque tout le répertoire
`prisma/migrations/` ; créer les nouvelles migrations avec l'outillage documenté.

Les règles de commandes utilisent des préfixes d'arguments, pas les glob patterns
Claude : les deux motifs `curl localhost:*` et `curl http://localhost:*` restent soumis
aux permissions normales de Codex. La décision la plus restrictive gagne, y compris
pour `make release` malgré l'autorisation générale de `make`. Les commandes enveloppées
ou les options placées avant le sous-commande peuvent ne pas correspondre : les règles
ne sont pas une protection exhaustive des données. Ne pas contourner les demandes
par une autre forme de commande. Les permissions imposées par l'application ou
l'administrateur restent prioritaires.

La mémoire et les règles métier restent à leur emplacement Claude pour éviter deux
versions divergentes. Lors d'une évolution d'un skill ou d'un agent, mettre à jour
les deux adaptations. Cette migration concerne la configuration du dépôt, sans
modifier les réglages globaux, comptes ou intégrations personnels de Claude/Codex.
