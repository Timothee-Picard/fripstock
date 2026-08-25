Lis CLAUDE.md pour le contexte métier, en particulier les sections "Produits" et
"Statuts". Cette étape suit le catalogue (`prompts/04-catalogue.md`) — c'est le cœur
fonctionnel de l'application.

## Backend (apps/api)

1. Module `uploads` : intégration MinIO (client S3 compatible). Endpoint
   `POST /uploads/photo` qui accepte une image, la stocke dans un bucket MinIO
   `produits`, renvoie l'URL exploitable par le front. Valide le type de fichier
   (images uniquement) et une taille max raisonnable.

2. Module `statuts` : CRUD complet des `Statut` de l'entreprise (nom, couleur, ordre,
   `estDefaut`, `estVente`, `bloqueVente`, `sortStock`), **réservé au gérant**
   (`estGerant`), sans clé de permission fine — même traitement que les boutiques.
   Empêche la suppression d'un statut encore utilisé par un produit, et garantis qu'il
   reste toujours exactement un statut `estDefaut` par entreprise. Les trois flags
   comportementaux se fixent à la création et ne sont plus modifiables ensuite (les
   changer sous des produits existants réécrirait leur historique métier).

3. Module `produits` :
   - `POST /produits` : création au niveau entreprise, `boutiqueId` optionnel dès la
     création (peut être assigné plus tard). Accepte les valeurs d'attributs dynamiques
     dans le body (liste de `{ attributDefinitionId, valeur }`), valide que chaque
     attribut fourni est bien applicable à la catégorie choisie du produit, et valide
     le type de la valeur (nombre pour NUMBER, option existante pour SELECT/
     MULTISELECT, etc.).
   - `PUT /produits/:id` : mise à jour des champs et des valeurs d'attributs.
   - `PUT /produits/:id/assigner-boutique` : renseigne/modifie `boutiqueId`.
   - `PUT /produits/:id/statut` : change le statut et écrit une ligne dans
     `HistoriqueStatut`. Règles, toutes basées sur les flags de `Statut` et **jamais sur
     le libellé** (les statuts sont renommables) :
     - Si le statut **actuel** du produit a `bloqueVente = true`, refuser tout passage
       vers un statut `estVente = true` et toute modification de `prixVendu` (403/409
       explicite). C'est ce qui rend définitivement invendable un article rendu au client.
     - Si le statut **cible** a `estVente = true` : accepte (et exige) `prixVendu` dans le
       body, renseigne `dateVente` (celle du body, ou maintenant par défaut), et si le
       produit est en `DEPOT_VENTE`, copie la commission de son `ContratDepot` dans
       `Produit.commissionAppliquee` — c'est le gel de commission décrit dans CLAUDE.md.
     - Si le statut cible n'a pas `estVente`, refuser `prixVendu`/`dateVente` dans le body.
   - `GET /produits` : liste paginée avec filtres (boutiqueId, categorieId, statutId,
     typeVente, recherche texte sur nom/reference/description, plage de dates de
     création ou de vente). Scopée à l'entreprise. Si l'utilisateur n'est pas gérant,
     ne renvoie que les produits des boutiques auxquelles il a accès, **plus les produits
     non assignés** (`boutiqueId = null`) : voir la règle "Produits non assignés" dans
     CLAUDE.md — la permission acquise dans au moins une boutique vaut sur le stock
     central.
   - `GET /produits/:id` : détail complet, y compris historique des statuts.
   - Attention à l'ordre de déclaration des routes dans le controller : NestJS matche dans
     l'ordre, donc toute route littérale (`/produits/export` à l'étape 7, etc.) doit être
     déclarée **avant** `@Get(':id')`, sinon elle est avalée par le paramètre. Laisse un
     commentaire à cet endroit.
   - `DELETE /produits/:id` : suppression (avec confirmation côté front, pas de
     soft-delete demandé pour l'instant sauf si ça te semble trivial à ajouter).
   - Permissions : `produits.voir`, `produits.creer`, `produits.modifier`,
     `produits.supprimer`, `produits.changerStatut` selon l'action. Pour les routes qui
     ciblent un produit par `:id`, le `PermissionsGuard` doit charger le produit pour en
     déduire la boutique (elle n'est ni dans les params ni dans le body) — et appliquer la
     règle du stock central si `boutiqueId` est `null`.

## Frontend (apps/web)

4. Page `/dashboard/produits` : liste avec filtres (boutique, catégorie, statut, type
   de vente, recherche), affichage en tableau avec la photo en miniature, le statut en
   badge coloré, actions rapides (changer le statut directement depuis la liste via un
   menu déroulant).

5. Page `/dashboard/produits/nouveau` : formulaire de création avec upload photo,
   sélection de catégorie qui **charge dynamiquement les bons champs d'attributs**
   (appel à `GET /categories/:id/attributs` dès que la catégorie est choisie, génère
   les inputs adaptés à chaque type : texte, nombre, select, multiselect, checkbox).
   Sélection optionnelle de la boutique d'assignation. Choix du type de vente
   (achat-revente ou dépôt-vente — si dépôt-vente, affiche un sélecteur de contrat de
   dépôt existant ou lien vers "créer un nouveau contrat", même si le module dépôt-vente
   complet arrive à l'étape suivante — un simple sélecteur de client suffit ici si le
   contrat n'existe pas encore, à raccorder ensuite).

6. Page `/dashboard/produits/:id` : fiche produit complète, historique des statuts,
   actions (modifier, changer de statut, assigner à une boutique, supprimer).

Critère de validation : créer une catégorie "Robe" avec attributs Taille/Couleur, créer
un produit dans cette catégorie en remplissant ces attributs, l'assigner à une boutique,
changer son statut vers "Vendu" en renseignant un prix vendu différent du prix affiché,
vérifier que l'historique de statut a bien enregistré le changement, et vérifier qu'on
ne peut pas revendre un produit passé à un statut `bloqueVente`. Vérifie aussi que le
blocage tient après **renommage** du statut "Rendu au client" en autre chose : c'est le
flag qui décide, pas le libellé.
