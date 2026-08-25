Lis CLAUDE.md à la racine pour le contexte métier complet avant de commencer. Cette
étape suit la mise en place de la qualité et de la CI (`prompts/01-qualite-ci.md`).

Objectif : le schéma Prisma complet, la migration initiale, et un seed exploitable.

1. Écris `apps/api/prisma/schema.prisma` avec tous les modèles suivants (adapte les noms
   de champs aux conventions décrites dans CLAUDE.md — français, camelCase, `@@map` en
   snake_case) :

   - `Entreprise` (id, nom, createdAt)
   - `Boutique` (id, entrepriseId, nom, adresse nullable, createdAt)
   - `User` (id, entrepriseId, email unique, motDePasseHash, prenom, nom, estGerant
     boolean, createdAt)
   - `AccesBoutique` (id, userId, boutiqueId, permissions Json, createdAt) — unique sur
     (userId, boutiqueId)
   - `Categorie` (id, entrepriseId, parentId nullable auto-relation, nom, createdAt)
   - `AttributTemplate` (id, nom, type) — table globale, pas de entrepriseId, en lecture
     seule, alimentée par seed uniquement
   - `AttributTemplateOption` (id, attributTemplateId, valeur, ordre) — les options par
     défaut d'un template SELECT/MULTISELECT (Taille → S, M, L, XL...), copiées dans des
     `AttributOption` au moment du clonage. Sans cette table, cloner "Taille" produirait
     un select vide et la bibliothèque de templates ne servirait à rien.
   - `AttributDefinition` (id, entrepriseId, nom, type — enum TEXT/NUMBER/SELECT/
     MULTISELECT/BOOLEAN, clonedFromTemplateId nullable, createdAt)
   - `AttributOption` (id, attributDefinitionId, valeur, ordre)
   - `CategorieAttribut` (table de jointure categorieId <-> attributDefinitionId)
   - `Statut` (id, entrepriseId, nom, couleur, ordre, estDefaut boolean, estVente
     boolean, bloqueVente boolean, sortStock boolean, createdAt) — voir la section
     "Statuts" de CLAUDE.md pour la sémantique exacte des trois flags. `estDefaut`
     désigne le statut attribué automatiquement à un produit à sa création : garantis
     qu'il y en a exactement un par entreprise (index unique partiel, ou contrôle au
     niveau service — documente le choix).
   - `Client` (déposant : id, entrepriseId, nom, prenom nullable, email nullable,
     telephone nullable, adresse nullable, iban nullable, commissionDefaut Decimal,
     createdAt)
   - `ContratDepot` (id, clientId, dateDebut, dateFin, commission Decimal,
     notifyBeforeDays Int, statut — enum ACTIF/EXPIRE/CLOS, notifieLe DateTime nullable,
     createdAt). Attention : ce modèle n'a pas de `entrepriseId`, son cloisonnement passe
     par `Client` — voir la règle de scoping via relation parente dans CLAUDE.md.
     `notifieLe` sert au job d'alerte de l'étape 6 pour ne pas renotifier en boucle.
   - `Produit` (id, entrepriseId, boutiqueId nullable, categorieId, statutId,
     reference nullable, nom, description nullable, commentaire nullable, photoUrl
     nullable, sku nullable, prixAchat Decimal nullable, prixVente Decimal nullable,
     prixVendu Decimal nullable, quantite Int default 1, typeVente — enum
     ACHAT_REVENTE/DEPOT_VENTE, contratDepotId nullable, commissionAppliquee Decimal
     nullable, deposantPaye Boolean nullable, dateVente nullable, createdAt, updatedAt).
     `commissionAppliquee` est la copie figée de la commission du contrat au moment de la
     vente (voir CLAUDE.md, section Dépôt-vente) — c'est elle que lisent le relevé,
     l'export et les stats, jamais celle du contrat.
   - `ValeurAttribut` (id, produitId, attributDefinitionId, valeurTexte nullable,
     valeurNombre nullable, valeurBooleenne nullable)
   - `ProduitAttributOption` (jointure produitId <-> attributOptionId, pour SELECT et
     MULTISELECT — une ligne pour un select, plusieurs pour un multiselect)
   - `HistoriqueStatut` (id, produitId, statutId, changedByUserId, changedAt, note
     nullable)
   - `Notification` (id, entrepriseId, type, contratDepotId nullable, message, isRead
     boolean, createdAt)

   Ajoute les index utiles (au minimum sur toutes les FK et sur `Produit.entrepriseId`,
   `Produit.boutiqueId`, `Produit.statutId`). Mets les `onDelete` cohérents (cascade sur
   les enfants d'une Entreprise supprimée, restrict là où une suppression accidentelle
   serait dangereuse comme un `Statut` encore utilisé par des produits).

2. Génère la migration initiale (`prisma migrate dev`).

3. Écris `apps/api/prisma/seed.ts` qui insère :
   - Les `AttributTemplate` de base, **avec leurs `AttributTemplateOption`** : Taille
     (SELECT — XS, S, M, L, XL, XXL), Couleur (SELECT — Noir, Blanc, Gris, Bleu, Rouge,
     Vert, Beige, Multicolore), Matière (SELECT — Coton, Laine, Cuir, Jean, Lin,
     Synthétique), Marque (TEXT, sans options).
   - Une entreprise de démo avec un gérant (email/mot de passe simples, affichés dans
     la console à la fin du seed), une boutique, quelques catégories (Robe, Haut, Sac,
     Chaussures, Chemise) avec les attributs pertinents rattachés à chaque catégorie
     (Sac n'a pas Taille, par exemple), les six statuts de base avec exactement les flags
     du tableau de CLAUDE.md ("En stock" en `estDefaut=true`, "Vendu" en `estVente=true,
sortStock=true`, "Rendu au client" et "Retiré" en `bloqueVente=true,
sortStock=true`), un client déposant de démo, et
     3-4 produits d'exemple variés (achat-revente et dépôt-vente) pour pouvoir tester
     l'UI dès l'étape suivante.
   - Ajoute un script npm `db:seed` et branche-le dans le `package.json` Prisma
     (`prisma.seed`).

4. Ajoute une commande au Makefile : `migrate` (lance les migrations dans le conteneur
   api) et `seed` (lance le seed dans le conteneur api).

Critère de validation : `make migrate && make seed` tourne sans erreur, `apps/api` peut
requêter les données seedées via Prisma Studio (`npx prisma studio` dans le conteneur,
ajoute une commande Makefile `studio` si simple à exposer).
