# Fripstock — instructions Codex

Avant toute intervention, lis **`CLAUDE.md` en entier** à la racine : c'est la
source commune des règles métier et conventions, conservée pour Claude et Codex.
Il ne s'agit pas d'une importation automatique : ouvre réellement le fichier.

Lis ensuite `.claude/memoire/ou-chercher.md`, puis les notes `outillage.md` et
`code-reperes.md` selon la tâche. Ces notes versionnées sont partagées entre les
agents ; mets-les à jour à leur emplacement actuel, sans créer de copie divergente.
Pour le frontend, applique aussi `apps/web/AGENTS.md` et la documentation Next locale.

## Outils et précautions du projet

- Les trois skills de `.agents/skills/` sont invoqués explicitement :
  `$nouveau-modele-prisma`, `$nouveau-module-nest`, `$verifier-stack`.
- Les rôles `revue-fripstock` et `revue-schema-prisma` sont définis dans
  `.codex/config.toml`. Ne délègue une revue que si l'utilisateur le demande.
- Le code et ses identifiants sont en anglais. Certaines anciennes notes Claude
  utilisent encore des noms français : vérifie les noms actuels dans le schéma,
  notamment `companyId`, `shopId`, `appliedCommission` et les flags de `Status`.
- Ne modifie pas les fichiers `.env*`, les métadonnées `.git`, ni les migrations
  existantes. Utilise Git pour ses métadonnées et crée une nouvelle migration pour
  toute évolution de base. Cette consigne vaut aussi pour les écritures par shell.
- Après des éditions de fichiers formatables, utilise Prettier via
  `./scripts/node-run.sh . npx --no -- prettier --write <fichiers>` depuis la racine.
  Le hook traite les éditions `apply_patch` ; les écritures shell nécessitent ce geste.
- Avant de terminer, lance `make check` ; avant une PR, cette vérification est requise.
  Les commandes Node passent par les conteneurs, comme expliqué dans les notes.
- Push, release, suppression de tags, réinitialisation Prisma, suppression de volumes
  et seed destructif nécessitent une autorisation explicite couvrant l'action.
  Une autorisation déjà donnée pour cette action reste valable.

La correspondance avec Claude et l'activation sont décrites dans
`docs/CODEX.md`. Les réglages personnels hors du dépôt ne sont pas modifiés.
