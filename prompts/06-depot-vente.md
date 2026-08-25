Lis CLAUDE.md pour le contexte métier, en particulier la section "Dépôt-vente". Cette
étape suit les produits (`prompts/05-produits.md`).

## Backend (apps/api)

1. Module `clients-deposants` :
   - CRUD complet sur `Client` (nom, prénom, contact, IBAN, commission par défaut),
     scopé à l'entreprise, permission `clients.gerer`.
   - `GET /clients-deposants/:id/produits` : liste des produits en dépôt pour ce
     client, avec leur statut de vente et de paiement.
   - `GET /clients-deposants/:id/releve` : calcule et renvoie un relevé — total vendu,
     part due au client, part déjà payée (`deposantPaye = true`) vs restant à payer.
     **La commission est la part de la boutique** : `partDeposant = prixVendu * (1 -
     commissionAppliquee / 100)`. Lis `Produit.commissionAppliquee` (figée à la vente),
     jamais `ContratDepot.commission` — sinon éditer un contrat réécrirait des relevés
     déjà réglés. Un produit compte comme vendu si son statut a `estVente = true`. C'est l'équivalent numérique du
     total "part pot client" qu'on trouve en bas du fichier Excel actuel du client.

2. Module `contrats-depot` :
   - CRUD complet sur `ContratDepot` (client, date de début/fin, commission — pré-
     rempli depuis `commissionDefaut` du client mais modifiable, `notifyBeforeDays`).
   - `POST /contrats-depot/:id/produits` : rattacher un ou plusieurs produits existants
     à ce contrat (ou permettre de créer le produit directement avec `contratDepotId`
     renseigné, à voir avec ce qui existe déjà dans le module produits).
   - `PUT /produits/:id/paiement-deposant` : bascule `deposantPaye` (ajoute cet
     endpoint dans le module `produits` existant plutôt que dans `contrats-depot` si
     c'est plus cohérent avec le reste du code — à toi de juger).
   - Permission `depots.gerer`.

3. Job planifié (utilise `@nestjs/schedule`) qui tourne une fois par jour et, en une
   passe sur les contrats `ACTIF` :
   - crée une `Notification` pour l'entreprise concernée quand
     `dateFin - notifyBeforeDays` est atteint et que `notifieLe` est encore `null`, puis
     renseigne `notifieLe` (c'est ce qui évite de renotifier en boucle) ;
   - fait passer en `EXPIRE` les contrats dont `dateFin` est dépassée — sans cette
     transition, rien ne sort jamais de `ACTIF` et l'enum ne sert à rien. `CLOS` reste
     une action manuelle du gérant.
   Le job doit être scopé correctement malgré l'absence d'`entrepriseId` sur
   `ContratDepot` : remonte l'entreprise via `client.entrepriseId` pour créer la
   notification.

4. Module `notifications` : `GET /notifications` (liste des notifications de
   l'entreprise, triées par date, avec `isRead`), `PUT /notifications/:id/lu` (marque
   comme lue).

## Frontend (apps/web)

5. Page `/dashboard/clients-deposants` : liste, création/édition, et pour chaque
   client un accès à son relevé (produits vendus, part due, ce qui a été payé).

6. Page `/dashboard/contrats-depot` : liste des contrats avec leur statut (actif/
   expire bientôt/expiré/clos), création, association de produits.

7. Un indicateur de notifications non lues dans le layout dashboard (cloche avec badge
   de compteur), qui liste les alertes d'échéance au clic.

8. Sur la fiche produit (étape précédente), si le produit est en dépôt-vente et vendu :
   affiche un bouton pour marquer le paiement du déposant comme effectué.

Critère de validation : créer un client déposant avec 40% de commission (= la boutique
garde 40%, le déposant touche 60%), créer un contrat de dépôt de 30 jours avec alerte 5
jours avant l'échéance, y rattacher un produit, le vendre 100 €, vérifier que le relevé
du client affiche bien 60 € dus, marquer
le paiement effectué, et vérifier qu'une notification apparaît bien si on recule
artificiellement la date de fin du contrat pour simuler une échéance proche.
