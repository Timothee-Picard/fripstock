Lis CLAUDE.md pour le contexte métier, en particulier la section "Export CSV". Cette
étape suit le dépôt-vente (`prompts/06-depot-vente.md`) et clôt le MVP.

## Backend (apps/api)

1. Module `stats` :
   - `GET /stats/dashboard` (permission `stats.voir`) : renvoie au minimum — chiffre
     d'affaires sur une période donnée (paramètres de dates en query), nombre de
     produits vendus, panier moyen, top catégories/produits par CA, taux de retour,
     répartition du stock actuel par statut.
   - Tous ces agrégats se définissent par les **flags de `Statut`**, jamais par le libellé
     (les statuts sont renommables par le gérant) : "vendu" = statut `estVente = true`
     (avec `prixVendu` et `dateVente` renseignés) ; "stock actif" = statut
     `sortStock = false` ; le taux de retour = produits `DEPOT_VENTE` dont le statut a
     `bloqueVente = true` rapportés au total des produits `DEPOT_VENTE` de la période.
   - Le CA se calcule sur `prixVendu` (l'encaissé), pas `prixVente` (l'étiquette). Pour le
     dépôt-vente, ajoute la marge réelle de la boutique
     (`prixVendu * commissionAppliquee / 100`) à côté du CA brut — c'est la seule qui soit
     comparable à la marge d'un achat-revente.
   - Scope les stats à l'entreprise, et si besoin à une boutique si `boutiqueId` est
     fourni en query.

2. Endpoint d'export : `GET /produits/export` (permission `export.csv`) — **déclare cette
   route avant `@Get(':id')`** dans le controller produits, sinon NestJS la fait matcher
   sur le paramètre et l'export renverra une erreur "produit export introuvable" :
   - Réutilise exactement les mêmes filtres query que `GET /produits` (voir
     prompts/05-produits.md) pour permettre l'export d'un sous-ensemble filtré ou du
     stock complet si aucun filtre n'est passé.
   - Génère un CSV avec séparateur `;`, encodage UTF-8 avec BOM (pour Excel FR).
   - Colonnes fixes dans cet ordre : référence, catégorie, boutique, nom, description,
     commentaire, statut, type de vente, prix d'achat, prix de vente, prix vendu, date
     de vente, déposant (nom du client si dépôt-vente, vide sinon), commission
     appliquée (`Produit.commissionAppliquee`, la valeur figée à la vente — pas celle du
     contrat), déposant payé (oui/non).
   - Colonnes dynamiques ensuite : une colonne par attribut présent parmi les produits
     du résultat exporté (calcule dynamiquement l'ensemble des attributs utilisés dans
     le jeu de résultats, une colonne par attribut, cellule vide si le produit n'a pas
     de valeur pour cet attribut).
   - Renvoie le fichier en téléchargement direct (`Content-Type: text/csv`,
     `Content-Disposition: attachment`), pas de stockage intermédiaire nécessaire pour
     ce volume de données.

## Frontend (apps/web)

3. Page `/dashboard` (remplace la page vide actuelle) : affiche les stats du dashboard
   avec des graphiques simples (CA sur la période, répartition du stock par statut, top
   produits/catégories). Utilise une librairie de graphiques légère (recharts, déjà
   courant avec Next.js) plutôt que de coder des SVG à la main.

4. Sur la page `/dashboard/produits`, ajoute un bouton "exporter en CSV" qui déclenche
   le téléchargement en respectant les filtres actuellement appliqués sur la liste (si
   aucun filtre n'est actif, ça exporte tout le stock).

Critère de validation : filtrer la liste produits sur une catégorie et un statut
précis, cliquer sur exporter, vérifier que le CSV téléchargé ne contient que les
produits correspondant au filtre, s'ouvre correctement dans Excel avec les accents et
les colonnes dynamiques d'attributs bien renseignées, et que le dashboard affiche des
chiffres cohérents avec les données de démo seedées à l'étape 2.
