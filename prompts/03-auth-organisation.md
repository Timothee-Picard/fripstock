Lis CLAUDE.md pour le contexte métier. Cette étape suit la mise en place de la base de
données (`prompts/02-base-de-donnees.md`).

Objectif : authentification JWT, gestion des boutiques, des utilisateurs et de leurs
permissions par boutique — le socle sur lequel tout le reste va s'appuyer.

## Backend (apps/api)

1. Module `auth` :
   - `POST /auth/register` : crée une `Entreprise`, un `User` avec `estGerant = true`
     rattaché à cette entreprise (hash du mot de passe avec bcrypt). Ne crée pas de
     boutique automatiquement — ce sera une action séparée.
   - `POST /auth/login` : vérifie email/mot de passe, renvoie un JWT contenant au
     minimum `userId`, `entrepriseId`, `estGerant`.
   - `GET /auth/me` : renvoie les infos de l'utilisateur connecté (déduit du JWT), y
     compris la liste des boutiques auxquelles il a accès et ses permissions par
     boutique (ou "tous droits" si gérant).
   - Stratégie JWT Passport + `JwtAuthGuard` global sauf routes explicitement publiques
     (`register`, `login`, et `GET /health` posé à l'étape 0 — vérifie qu'il répond
     toujours sans token après avoir branché le guard global).

2. Guard de permissions : décorateur `@RequirePermission('produits.creer')` + un
   `PermissionsGuard` qui laisse tout passer si `user.estGerant`, sinon vérifie dans
   `AccesBoutique.permissions` pour la boutique ciblée par la requête. Prévois dès
   maintenant les trois façons dont le guard peut retrouver cette boutique, parce que les
   étapes suivantes s'appuieront dessus :
   - un paramètre de route ou un champ de body `boutiqueId` ;
   - une ressource ciblée par `:id` qu'il faut charger pour en lire la boutique (cas des
     produits à l'étape 5 — la boutique n'est ni dans les params ni dans le body) ;
   - **aucune boutique** (`boutiqueId = null`, le stock central) : dans ce cas la
     permission est accordée si l'utilisateur la possède dans au moins une boutique de son
     entreprise — voir la règle "Produits non assignés" de CLAUDE.md.

   Documente en commentaire, pour chaque route décorée, laquelle des trois s'applique.
   Définis aussi les clés de permission comme une constante TypeScript partagée (dérivée
   de la liste de CLAUDE.md) plutôt qu'en chaînes libres : le JSON `permissions` n'est pas
   typé en base, c'est le seul garde-fou contre une clé mal orthographiée qui accorderait
   silencieusement l'accès.

3. Module `boutiques` : CRUD complet, réservé au gérant (`estGerant` uniquement, pas de
   permission fine ici — créer/supprimer une boutique reste un acte de gérant). Toutes
   les requêtes scopées à `entrepriseId` du JWT.

4. Module `users` :
   - `POST /users/invite` (gérant uniquement) : crée un employé (email, prénom, nom,
     mot de passe temporaire généré ou fourni), rattaché à l'entreprise du gérant.
   - `GET /users` (gérant uniquement) : liste les employés de l'entreprise.
   - `PUT /users/:id/acces` (gérant uniquement) : définit/modifie les
     `AccesBoutique` d'un employé (quelles boutiques, quelles permissions activées
     dans chacune — utilise la liste de permissions listée dans CLAUDE.md).
   - `DELETE /users/:id` (gérant uniquement).

## Frontend (apps/web)

5. Page `/login` et `/register` (formulaire simple : entreprise + gérant en une fois
   pour register).
6. Stocke le JWT côté client (cookie httpOnly si simple à mettre en place avec les
   routes API Next.js en intermédiaire, sinon localStorage en solution de repli — note
   explicitement le choix fait et pourquoi).
7. Layout `/dashboard` avec une sidebar de navigation (Produits, Catégories, Clients
   déposants, Boutiques, Utilisateurs, Paramètres) et un sélecteur de boutique active
   en haut si l'utilisateur a accès à plusieurs boutiques.
8. Page `/dashboard/boutiques` : liste + création (gérant uniquement, cache le bouton
   de création sinon).
9. Page `/dashboard/utilisateurs` : liste des employés, invitation, et une interface
   pour cocher/décocher les permissions par boutique pour chaque employé (gérant
   uniquement).

Pour le design de ces pages, reste simple et fonctionnel (c'est un back-office interne,
pas une landing page) : une palette sobre à 2-3 couleurs, une seule police, des
tableaux et formulaires clairs. Pas besoin de travail créatif poussé à ce stade.

Critère de validation : un gérant peut s'inscrire, se connecter, créer une boutique,
inviter un employé et lui donner accès à cette boutique avec certaines permissions
seulement. Se connecter avec cet employé doit refléter exactement ces permissions
(vérifie qu'un appel API sans la permission requise renvoie bien un 403).
