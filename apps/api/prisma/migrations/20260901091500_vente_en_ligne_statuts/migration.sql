-- Pose « Vendu en ligne » dans les entreprises existantes.
--
-- Les statuts sont figés à la création de l'entreprise : sans cette reprise, la
-- vente en ligne fonctionnerait pour une entreprise créée après cette mise à
-- jour et pour aucune autre. `prisma migrate dev` ne génère que la DDL, la
-- reprise de données s'écrit à la main.
--
-- Tout se repère par les **flags**, jamais par le libellé : le statut de vente
-- au comptoir est celui qui porte `is_sale` sans `is_online_sale`. Une
-- entreprise qui n'en aurait pas est simplement ignorée — il n'y aurait nulle
-- part où accrocher le nouveau.

-- 1. Fait de la place : les statuts placés après la vente au comptoir reculent
--    d'un cran, pour que le nouveau se glisse juste derrière elle.
UPDATE "status" s
SET "position" = s."position" + 1
FROM "status" vente
WHERE vente."company_id" = s."company_id"
  AND vente."is_sale" = true
  AND vente."is_online_sale" = false
  AND s."position" > vente."position";

-- 2. Le statut lui-même. L'identifiant est un UUID là où le reste porte des
--    cuid : un identifiant est opaque, seule son unicité compte, et SQL ne
--    sait pas produire de cuid.
INSERT INTO "status" (
  "id", "company_id", "name", "color", "position",
  "is_default", "is_sale", "blocks_sale", "leaves_stock", "is_online_sale",
  "position_x", "position_y", "created_at"
)
SELECT
  gen_random_uuid()::text, vente."company_id", 'Vendu en ligne', '#0ea5e9', vente."position" + 1,
  false, true, false, true, true,
  660, 95, NOW()
FROM "status" vente
WHERE vente."is_sale" = true
  AND vente."is_online_sale" = false
  AND NOT EXISTS (
    SELECT 1 FROM "status" deja
    WHERE deja."company_id" = vente."company_id" AND deja."is_online_sale" = true
  );

-- 3. Les quatre flèches. Sans elles le statut existe mais reste inatteignable :
--    dès qu'un flux est défini, seuls les chemins tracés sont acceptés.
--    Les trois points de départ sont ceux de la vente au comptoir — un article
--    en réserve, en rayon ou réservé — et le retour ramène en rayon.
INSERT INTO "status_transition" ("id", "source_id", "target_id")
SELECT gen_random_uuid()::text, source."id", cible."id"
FROM "status" cible
JOIN "status" source
  ON source."company_id" = cible."company_id"
 AND source."is_sale" = false
 AND source."leaves_stock" = false
WHERE cible."is_online_sale" = true
ON CONFLICT ("source_id", "target_id") DO NOTHING;

INSERT INTO "status_transition" ("id", "source_id", "target_id")
SELECT gen_random_uuid()::text, cible."id", rayon."id"
FROM "status" cible
JOIN "status" comptoir
  ON comptoir."company_id" = cible."company_id"
 AND comptoir."is_sale" = true
 AND comptoir."is_online_sale" = false
JOIN "status_transition" retour ON retour."source_id" = comptoir."id"
JOIN "status" rayon ON rayon."id" = retour."target_id"
WHERE cible."is_online_sale" = true
ON CONFLICT ("source_id", "target_id") DO NOTHING;
