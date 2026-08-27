-- Fusionne `products.create` et `products.update` en `products.manage`.
--
-- Les deux droits séparés produisaient un état cassé : un employé pouvait créer
-- un article puis se retrouver incapable d'en corriger la faute de frappe.
-- Sans cette reprise, les clés désormais inconnues seraient simplement ignorées
-- à la lecture, et les employés perdraient l'accès en silence.
UPDATE "shop_access"
SET "permissions" = (
      ("permissions"::jsonb - 'products.create' - 'products.update')
      || jsonb_build_object('products.manage', true)
    )::json
WHERE "permissions"::jsonb ? 'products.create'
   OR "permissions"::jsonb ? 'products.update';
