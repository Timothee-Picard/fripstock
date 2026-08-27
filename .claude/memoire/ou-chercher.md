# Où chercher la doc

> Carte de la doc Fripstock — quel fichier fait foi sur quoi, avant de fouiller le code.

Où lire avant de coder, par ordre d'autorité :

- **`CLAUDE.md`** — **fait foi** sur les règles métier et les conventions. Chargé
  automatiquement à chaque session. En cas de contradiction avec le code, c'est
  lui qui a raison et le code qui est à corriger. Contient notamment : hiérarchie
  Company / Shop / User, sens de la commission (part **boutique**), flags de
  `Status`, liste des permissions, découpage du tableau de bord, format CSV,
  conventions de commit.
- **`README.md`** — comment l'appli fonctionne **et pourquoi** chaque choix a été
  fait. C'est là que sont les explications longues : auth et cookie httpOnly,
  catalogue, références générées, achat en lot, comptoir, dépôt-vente, statuts et
  tracé du flux, export CSV, navigation, outillage.
- **`prompts/`** et **`docs/KIT.md`** — archive : les prompts qui ont servi à
  construire l'application, et la doc du kit de démarrage. Utiles pour retrouver
  l'intention d'origine d'une fonctionnalité, périmés sur l'état actuel du code.

- **`.claude/memoire/`** — ces notes-ci, écrites pour Claude : elles ne
  redisent pas ce qui est déjà dans `CLAUDE.md` ou le `README.md`, elles disent
  **où** aller le chercher et ce qui ne s'y trouve pas.

Deux subagents existent dans `.claude/agents/` : `revue-fripstock` (règles
métier, scoping multi-tenant, permissions) et `revue-schema-prisma` (relations,
`onDelete`, index). Ne les lancer que si l'utilisateur le demande.

Voir aussi [outillage](outillage.md) et [code-reperes](code-reperes.md).
