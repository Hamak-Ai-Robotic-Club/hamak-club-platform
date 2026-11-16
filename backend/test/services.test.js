const assert = require("node:assert/strict");
const test = require("node:test");
const { writeAuditLog } = require("../src/audit");
const { recordInventoryMovement } = require("../src/inventory");
const { saveHackathonSummary } = require("../src/hackathon-summaries");
const { submitRequest } = require("../src/requests");

test("inventory movement service validates fields and persists the signed delta", async () => {
  let receivedArguments;
  const expected = { id: 7n };
  const prisma = {
    inventoryMovement: {
      create: async (args) => {
        receivedArguments = args;
        return expected;
      },
    },
  };

  const result = await recordInventoryMovement(prisma, {
    componentId: 2n,
    actorUserId: 3n,
    movementType: "MANUAL_CORRECTION",
    quantityBucket: "working",
    quantityDelta: -2,
    notes: "Synthetic test",
  });

  assert.equal(result, expected);
  assert.deepEqual(receivedArguments.data, {
    componentId: 2n,
    actorUserId: 3n,
    movementType: "MANUAL_CORRECTION",
    quantityBucket: "working",
    quantityDelta: -2,
    notes: "Synthetic test",
  });
});

test("inventory movement service rejects invalid buckets and zero or unsafe deltas", async () => {
  const prisma = {
    inventoryMovement: { create: async () => assert.fail("create must not run") },
  };
  const base = {
    componentId: 1n,
    movementType: "ADJUST",
    quantityBucket: "working",
    quantityDelta: 1,
  };

  await assert.rejects(
    recordInventoryMovement(prisma, { ...base, quantityBucket: "reserved" }),
    /quantityBucket/,
  );
  await assert.rejects(
    recordInventoryMovement(prisma, { ...base, quantityDelta: 0 }),
    /quantityDelta/,
  );
  await assert.rejects(
    recordInventoryMovement(prisma, {
      ...base,
      quantityDelta: Number.MAX_SAFE_INTEGER + 1,
    }),
    /quantityDelta/,
  );
});

test("audit service rejects missing identifying fields and stores valid entries", async () => {
  const calls = [];
  const prisma = {
    auditLog: {
      create: async (args) => {
        calls.push(args);
        return { id: 10n };
      },
    },
  };

  await assert.rejects(
    writeAuditLog(prisma, { entityType: "", entityId: "1", action: "UPDATE" }),
    /entityType/,
  );
  await assert.rejects(
    writeAuditLog(prisma, {
      entityType: "user",
      entityId: "2",
      action: "UPDATE",
      afterData: { nested: { token_hash: "do-not-log" } },
    }),
    /sensitive field/,
  );
  const entry = await writeAuditLog(prisma, {
    actorUserId: 4n,
    entityType: "component",
    entityId: "2",
    action: "UPDATE",
    beforeData: { workingQuantity: 2 },
    afterData: { workingQuantity: 3 },
    metadata: { synthetic: true },
  });

  assert.equal(entry.id, 10n);
  assert.deepEqual(calls[0].data, {
    actorUserId: 4n,
    entityType: "component",
    entityId: "2",
    action: "UPDATE",
    beforeData: { workingQuantity: 2 },
    afterData: { workingQuantity: 3 },
    metadata: { synthetic: true },
  });
});

test("summary service requires a JSON object and saves an independent snapshot", async () => {
  let receivedArguments;
  const prisma = {
    hackathonSummary: {
      create: async (args) => {
        receivedArguments = args;
        return { id: 11n };
      },
    },
  };

  await assert.rejects(
    saveHackathonSummary(prisma, { summaryData: [] }),
    /summaryData must be a JSON object/,
  );
  const result = await saveHackathonSummary(prisma, {
    createdByUserId: 2n,
    title: "Synthetic snapshot",
    summaryData: { synthetic: true, totals: { requests: 3 } },
  });

  assert.equal(result.id, 11n);
  assert.deepEqual(receivedArguments.data, {
    createdByUserId: 2n,
    title: "Synthetic snapshot",
    summaryData: { synthetic: true, totals: { requests: 3 } },
  });
});

test("request submission creates immutable request items and submits atomically", async () => {
  const calls = [];
  const prisma = {
    $transaction: async (callback) =>
      callback({
        request: {
          create: async (args) => {
            calls.push(["create", args]);
            return { id: 8n };
          },
          update: async (args) => {
            calls.push(["submit", args]);
            return { id: 8n, submittedAt: args.data.submittedAt, items: [] };
          },
        },
      }),
  };

  const request = await submitRequest(prisma, {
    teamId: 3n,
    submittedByUserId: 4n,
    projectName: "Synthetic request",
    items: [{ componentId: 5n, requestedQuantity: 2 }],
  });

  assert.equal(request.id, 8n);
  assert.equal(calls[0][1].data.submittedAt, null);
  assert.equal(calls[0][1].data.status, "PENDING");
  assert.deepEqual(calls[0][1].data.items.create, [
    { componentId: 5n, requestedQuantity: 2, approvedQuantity: 0 },
  ]);
  assert.equal(calls[1][1].data.submittedAt instanceof Date, true);
  assert.deepEqual(calls[1][1].include, { items: true });
});

test("request submission rejects missing items and invalid requested quantities", async () => {
  const prisma = {
    $transaction: async () => assert.fail("transaction must not run"),
  };

  await assert.rejects(submitRequest(prisma, { items: [] }), /at least one item/);
  await assert.rejects(
    submitRequest(prisma, {
      items: [{ componentId: 1n, requestedQuantity: 0 }],
    }),
    /positive safe integer/,
  );
  await assert.rejects(
    submitRequest(prisma, {
      items: [{ componentId: 1n, requestedQuantity: 1, approvedQuantity: 1 }],
    }),
    /zero approved quantity/,
  );
});
