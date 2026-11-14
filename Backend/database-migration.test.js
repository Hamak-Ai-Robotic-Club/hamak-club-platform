const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");
const { PGlite } = require("@electric-sql/pglite");

const migrationPaths = [
  path.join(
    __dirname,
    "..",
    "prisma",
    "migrations",
    "20261031190000_initial",
    "migration.sql",
  ),
  path.join(
    __dirname,
    "..",
    "prisma",
    "migrations",
    "20261031193000_expand_confirmed_entities",
    "migration.sql",
  ),
  path.join(
    __dirname,
    "..",
    "prisma",
    "migrations",
    "20261111210000_add_component_image_reference",
    "migration.sql",
  ),
  path.join(
    __dirname,
    "..",
    "prisma",
    "migrations",
    "20261114180000_import_kit_inventory",
    "migration.sql",
  ),
];

test("migrations import kit stock and enforce relations, custody, and append-only logs", async () => {
  const database = new PGlite();

  try {
    for (const migrationPath of migrationPaths) {
      await database.exec(await readFile(migrationPath, "utf8"));
    }

    const inventory = await database.query(
      `SELECT
         "category",
         COUNT(*)::INTEGER AS item_count,
         SUM("working_quantity")::INTEGER AS working_quantity,
         SUM("broken_quantity")::INTEGER AS broken_quantity
       FROM "components"
       GROUP BY "category"
       ORDER BY "category"`,
    );
    assert.deepEqual(inventory.rows, [
      {
        category: "Arduino Kit",
        item_count: 23,
        working_quantity: 225,
        broken_quantity: 0,
      },
      {
        category: "ESP32 Kit",
        item_count: 29,
        working_quantity: 1474,
        broken_quantity: 0,
      },
    ]);

    const importedMovements = await database.query(
      `SELECT COUNT(*)::INTEGER AS count,
         SUM("quantity_delta")::INTEGER AS quantity
       FROM "inventory_movements"
       WHERE "movement_type" = 'INITIAL_STOCK_IMPORT'`,
    );
    assert.deepEqual(importedMovements.rows[0], { count: 52, quantity: 1699 });

    const pushButtons = await database.query(
      `SELECT "working_quantity"
       FROM "components"
       WHERE "name" = 'Push button' AND "category" = 'ESP32 Kit'`,
    );
    assert.equal(pushButtons.rows[0].working_quantity, 6);

    const componentResult = await database.query(
      `INSERT INTO "components"
        ("name", "category", "working_quantity", "broken_quantity", "status", "image_reference", "updated_at")
       VALUES ('Test board', 'Test', 10, 2, 'Test', 'https://example.test/board.png', NOW())
       RETURNING "id", "image_reference"`,
    );
    const componentId = componentResult.rows[0].id;
    assert.equal(componentResult.rows[0].image_reference, "https://example.test/board.png");
    const userResult = await database.query(
      `INSERT INTO "users" ("account_type", "display_name", "updated_at")
       VALUES ('TEST', 'Synthetic operator', NOW())
       RETURNING "id"`,
    );
    const userId = userResult.rows[0].id;
    const teamResult = await database.query(
      `INSERT INTO "teams" ("name") VALUES ('Synthetic team') RETURNING "id"`,
    );
    const teamId = teamResult.rows[0].id;

    await assert.rejects(
      database.query(
        `INSERT INTO "requests" ("team_id", "status", "submitted_at")
         VALUES ($1, 'PENDING', NOW())`,
        [teamId],
      ),
      /Create request content first/i,
    );

    await assert.rejects(
      database.query(
        `INSERT INTO "sessions" ("user_id", "token_hash", "expires_at")
         VALUES ($1, 'synthetic-invalid-session', NOW() - INTERVAL '1 minute')`,
        [userId],
      ),
      /sessions_expiry_after_creation/i,
    );

    const pendingRequest = await database.query(
      `INSERT INTO "requests" ("team_id", "status")
       VALUES ($1, 'PENDING') RETURNING "id"`,
      [teamId],
    );
    await database.query(
      `INSERT INTO "request_items"
        ("request_id", "component_id", "requested_quantity", "approved_quantity")
       VALUES ($1, $2, 1, 0)`,
      [pendingRequest.rows[0].id, componentId],
    );
    await database.query(
      `UPDATE "requests" SET "submitted_at" = NOW() WHERE "id" = $1`,
      [pendingRequest.rows[0].id],
    );

    const duplicatePendingRequest = await database.query(
      `INSERT INTO "requests" ("team_id", "status")
       VALUES ($1, 'PENDING') RETURNING "id"`,
      [teamId],
    );
    await database.query(
      `INSERT INTO "request_items"
        ("request_id", "component_id", "requested_quantity", "approved_quantity")
       VALUES ($1, $2, 1, 0)`,
      [duplicatePendingRequest.rows[0].id, componentId],
    );
    await assert.rejects(
      database.query(
        `UPDATE "requests" SET "submitted_at" = NOW() WHERE "id" = $1`,
        [duplicatePendingRequest.rows[0].id],
      ),
      /unique/i,
    );
    const reviewTeam = await database.query(
      `INSERT INTO "teams" ("name") VALUES ('Review synthetic team') RETURNING "id"`,
    );

    const request = await database.query(
      `INSERT INTO "requests" ("team_id", "submitted_by_user_id", "status")
       VALUES ($1, $2, 'PENDING') RETURNING "id"`,
      [reviewTeam.rows[0].id, userId],
    );
    const requestId = request.rows[0].id;
    const requestItem = await database.query(
      `INSERT INTO "request_items"
        ("request_id", "component_id", "requested_quantity", "approved_quantity")
       VALUES ($1, $2, 5, 0) RETURNING "id"`,
      [requestId, componentId],
    );
    const requestItemId = requestItem.rows[0].id;

    await assert.rejects(
      database.query(
        `INSERT INTO "request_items"
          ("request_id", "component_id", "requested_quantity", "approved_quantity")
         VALUES ($1, $2, 1, 2)`,
        [requestId, componentId],
      ),
      /check constraint/i,
    );

    await database.query(
      `UPDATE "requests" SET "submitted_at" = NOW() WHERE "id" = $1`,
      [requestId],
    );
    await database.query(
      `UPDATE "request_items" SET "approved_quantity" = 3 WHERE "id" = $1`,
      [requestItemId],
    );
    await database.query(
      `UPDATE "requests" SET "status" = 'APPROVED' WHERE "id" = $1`,
      [requestId],
    );

    const delivery = await database.query(
      `INSERT INTO "deliveries" ("request_id", "delivered_by_user_id")
       VALUES ($1, $2) RETURNING "id"`,
      [requestId, userId],
    );
    const deliveryId = delivery.rows[0].id;
    const deliveryItem = await database.query(
      `INSERT INTO "delivery_items"
        ("delivery_id", "request_id", "request_item_id", "delivered_quantity")
       VALUES ($1, $2, $3, 2) RETURNING "id"`,
      [deliveryId, requestId, requestItemId],
    );
    const deliveryItemId = deliveryItem.rows[0].id;
    let balances = await getBalances(database, componentId);
    assert.deepEqual(balances, { working: 8, broken: 2 });
    await assert.rejects(
      database.query(
        `INSERT INTO "inventory_movements"
          ("component_id", "delivery_item_id", "movement_type", "quantity_bucket", "quantity_delta")
         VALUES ($1, $2, 'DELIVERY', 'working', -1)`,
        [componentId, deliveryItemId],
      ),
      /source component, bucket, and quantity/i,
    );

    await assert.rejects(
      database.query(
        `INSERT INTO "delivery_items"
          ("delivery_id", "request_id", "request_item_id", "delivered_quantity")
         VALUES ($1, $2, $3, 2)`,
        [deliveryId, requestId, requestItemId],
      ),
      /exceeds the approved quantity/i,
    );
    assert.deepEqual(await getBalances(database, componentId), balances);
    await assert.rejects(
      database.query(
        `INSERT INTO "request_items"
          ("request_id", "component_id", "requested_quantity", "approved_quantity")
         VALUES ($1, $2, 1, 0)`,
        [requestId, componentId],
      ),
      /cannot be added after submission/i,
    );
    await assert.rejects(
      database.query(
        `UPDATE "requests" SET "project_name" = 'Changed' WHERE "id" = $1`,
        [requestId],
      ),
      /content is immutable/i,
    );
    await assert.rejects(
      database.query(
        `UPDATE "request_items" SET "requested_quantity" = 4 WHERE "id" = $1`,
        [requestItemId],
      ),
      /content is immutable/i,
    );
    await assert.rejects(
      database.query(
        `UPDATE "request_items" SET "approved_quantity" = 1 WHERE "id" = $1`,
        [requestItemId],
      ),
      /only change while a submitted request is pending/i,
    );

    const anotherTeam = await database.query(
      `INSERT INTO "teams" ("name") VALUES ('Other synthetic team') RETURNING "id"`,
    );
    const anotherRequest = await database.query(
      `INSERT INTO "requests" ("team_id", "status") VALUES ($1, 'APPROVED') RETURNING "id"`,
      [anotherTeam.rows[0].id],
    );
    const anotherDelivery = await database.query(
      `INSERT INTO "deliveries" ("request_id") VALUES ($1) RETURNING "id"`,
      [anotherRequest.rows[0].id],
    );
    await assert.rejects(
      database.query(
        `INSERT INTO "delivery_items"
          ("delivery_id", "request_id", "request_item_id", "delivered_quantity")
         VALUES ($1, $2, $3, 1)`,
        [anotherDelivery.rows[0].id, anotherRequest.rows[0].id, requestItemId],
      ),
      /same request|foreign key/i,
    );

    const returnRecord = await database.query(
      `INSERT INTO "returns" ("received_by_user_id") VALUES ($1) RETURNING "id"`,
      [userId],
    );
    const returnId = returnRecord.rows[0].id;
    await database.query(
      `INSERT INTO "return_items"
        ("return_id", "delivery_item_id", "working_quantity", "broken_quantity")
       VALUES ($1, $2, 1, 0)`,
      [returnId, deliveryItemId],
    );
    balances = await getBalances(database, componentId);
    assert.deepEqual(balances, { working: 9, broken: 2 });

    const secondReturn = await database.query(
      `INSERT INTO "returns" DEFAULT VALUES RETURNING "id"`,
    );
    await database.query(
      `INSERT INTO "return_items"
        ("return_id", "delivery_item_id", "working_quantity", "broken_quantity")
       VALUES ($1, $2, 0, 1)`,
      [secondReturn.rows[0].id, deliveryItemId],
    );
    assert.deepEqual(await getBalances(database, componentId), {
      working: 9,
      broken: 3,
    });

    await assert.rejects(
      database.query(
        `INSERT INTO "return_items"
          ("return_id", "delivery_item_id", "working_quantity", "broken_quantity")
         VALUES ($1, $2, 1, 0)`,
        [secondReturn.rows[0].id, deliveryItemId],
      ),
      /exceeds the delivered quantity/i,
    );

    await assert.rejects(
      database.query(
        `INSERT INTO "inventory_movements"
          ("component_id", "movement_type", "quantity_bucket", "quantity_delta")
         VALUES ($1, 'TEST_ADJUSTMENT', 'working', -100)`,
        [componentId],
      ),
      /balance negative/i,
    );
    await assert.rejects(
      database.query(`UPDATE "inventory_movements" SET "notes" = 'changed'`),
      /append-only/i,
    );
    await assert.rejects(
      database.query(`DELETE FROM "inventory_movements"`),
      /append-only/i,
    );
    await assert.rejects(
      database.query(
        `UPDATE "delivery_items" SET "delivered_quantity" = 1 WHERE "id" = $1`,
        [deliveryItemId],
      ),
      /append-only/i,
    );

    await database.query(
      `INSERT INTO "audit_logs" ("actor_user_id", "entity_type", "entity_id", "action", "after_data")
       VALUES ($1, 'request', $2, 'TEST', '{"synthetic": true}'::jsonb)`,
      [userId, requestId.toString()],
    );
    await assert.rejects(
      database.query(`UPDATE "audit_logs" SET "action" = 'CHANGED'`),
      /append-only/i,
    );
    await assert.rejects(
      database.query(`DELETE FROM "audit_logs"`),
      /append-only/i,
    );
    await assert.rejects(
      database.query(`DELETE FROM "requests" WHERE "id" = $1`, [requestId]),
      /instead of deleting/i,
    );

    await database.query(
      `INSERT INTO "hackathon_summaries" ("summary_data")
       VALUES ('{"synthetic": true, "counts": {"requests": 2}}'::jsonb)`,
    );
    const summary = await database.query(
      `SELECT "summary_data" FROM "hackathon_summaries"`,
    );
    assert.deepEqual(summary.rows[0].summary_data, {
      synthetic: true,
      counts: { requests: 2 },
    });
    await assert.rejects(
      database.query(`UPDATE "hackathon_summaries" SET "title" = 'changed'`),
      /append-only/i,
    );

    await database.query(
      `UPDATE "requests" SET "status" = 'CANCELLED' WHERE "id" = $1`,
      [pendingRequest.rows[0].id],
    );
    await database.query(
      `UPDATE "requests" SET "submitted_at" = NOW() WHERE "id" = $1`,
      [duplicatePendingRequest.rows[0].id],
    );
  } finally {
    await database.close();
  }
});

async function getBalances(database, componentId) {
  const result = await database.query(
    `SELECT "working_quantity", "broken_quantity"
     FROM "components" WHERE "id" = $1`,
    [componentId],
  );

  return {
    working: result.rows[0].working_quantity,
    broken: result.rows[0].broken_quantity,
  };
}
