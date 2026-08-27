-- Réaligne le schéma des statuts : une colonne par étape.
--
-- Les trois statuts qui sortent du stock (vendu, rendu, retiré) partageaient la
-- colonne du milieu avec le parcours actif, et les flèches convergentes se
-- superposaient. Les regrouper dans la dernière colonne rend lisible le chemin
-- qu'un gérant suit tous les jours.
--
-- Seules les positions restées aux valeurs d'origine sont reprises : le jour où
-- l'écran laissera déplacer un statut, une disposition choisie ne doit pas être
-- écrasée par une migration.
UPDATE "status" SET "position_x" = 0,   "position_y" = 150 WHERE "position_x" = 0   AND "position_y" = 120;
UPDATE "status" SET "position_x" = 320, "position_y" = 40  WHERE "position_x" = 260 AND "position_y" = 40;
UPDATE "status" SET "position_x" = 320, "position_y" = 260 WHERE "position_x" = 260 AND "position_y" = 200;
UPDATE "status" SET "position_x" = 660, "position_y" = 20  WHERE "position_x" = 540 AND "position_y" = 40;
UPDATE "status" SET "position_x" = 660, "position_y" = 170 WHERE "position_x" = 540 AND "position_y" = 200;
UPDATE "status" SET "position_x" = 660, "position_y" = 320 WHERE "position_x" = 540 AND "position_y" = 320;
