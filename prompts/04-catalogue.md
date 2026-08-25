Lis CLAUDE.md pour le contexte métier, en particulier la section "Catalogue : catégories
& attributs — RÈGLE IMPORTANTE". Cette étape suit l'auth (`prompts/03-auth-organisation.md`).

Objectif : permettre au gérant de configurer ses catégories et ses attributs dynamiques,
au niveau Entreprise.

## Backend (apps/api)

1. Module `categories` :
   - CRUD complet, scopé à `entrepriseId`, permission `categories.gerer` requise en
     écriture (lecture accessible à tout utilisateur ayant accès à au moins une
     boutique de l'entreprise).
   - Les catégories forment un arbre (`parentId`). Prévois un endpoint qui renvoie
     l'arbre complet déjà structuré (pas juste la liste plate) pour simplifier l'affichage
     côté front.
   - Empêche la suppression d'une catégorie qui a des produits ou des sous-catégories
     (renvoie une erreur explicite plutôt qu'une suppression en cascade silencieuse).

2. Module `attributs` :
   - `GET /attributs/templates` : liste les `AttributTemplate` globaux disponibles à
     cloner.
   - `POST /attributs/from-template/:templateId` : clone un template en
     `AttributDefinition` pour l'entreprise courante — copie le nom, le type, et **chaque
     `AttributTemplateOption` en `AttributOption`** (en conservant l'ordre). Le clone est
     ensuite totalement indépendant : le renommer ou modifier ses options n'affecte ni le
     template ni les autres entreprises.
   - CRUD complet sur `AttributDefinition` (créer un attribut sans passer par un
     template aussi), y compris gestion des `AttributOption` (ajouter/modifier/
     réordonner/supprimer une option) pour les types SELECT et MULTISELECT.
   - Endpoints pour lier/délier un attribut à une ou plusieurs catégories
     (`CategorieAttribut`).
   - `GET /categories/:id/attributs` : renvoie les attributs applicables à une
     catégorie donnée (utile pour générer le formulaire produit dynamique à l'étape
     suivante).
   - Permission `attributs.gerer` requise en écriture.

## Frontend (apps/web)

3. Page `/dashboard/categories` : arbre de catégories avec création/renommage/
   suppression, glisser-déposer optionnel (pas indispensable, un simple sélecteur de
   parent dans un formulaire suffit si le drag & drop prend trop de temps).

4. Page `/dashboard/attributs` :
   - Liste des attributs de l'entreprise avec leur type et leurs options.
   - Bouton "ajouter depuis un modèle" qui liste les `AttributTemplate` disponibles.
   - Formulaire de création d'un attribut personnalisé (nom, type, options si
     SELECT/MULTISELECT).
   - Interface pour associer un attribut à une ou plusieurs catégories (ex : cases à
     cocher en face de chaque catégorie).

Critère de validation : le gérant peut créer une arborescence de catégories, cloner
l'attribut "Taille" depuis un template, l'associer à la catégorie "Robe" mais pas à
"Sac", et créer un attribut "Marque" en texte libre associé à toutes les catégories.
