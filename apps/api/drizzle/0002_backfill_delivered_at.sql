-- Pedidos concluídos antes do registro da data/hora de entrega recebem o momento em que foram marcados como entregues.
UPDATE "shipments" AS s
SET "delivered_at" = COALESCE(
  (SELECT max(h."created_at") FROM "order_history" h WHERE h."order_id" = s."order_id" AND h."to_status" = 'entregue'),
  o."updated_at"
)
FROM "orders" o
WHERE o."id" = s."order_id" AND o."status" = 'entregue' AND s."delivered_at" IS NULL;
