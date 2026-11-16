const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getInventoryReport,
  getMovementReport,
  getMovementStatistics,
  getRequestStatistics,
  getCustodyReport,
  getDashboardStatistics,
} = require("../src/reports");

test("inventory report totals working and broken stock without reservations", async () => {
  const prisma = {
    component: {
      findMany: async () => [
        {
          id: 1n,
          name: "Demo board",
          category: "Demo",
          status: "Demo",
          workingQuantity: 12,
          brokenQuantity: 0,
        },
        {
          id: 2n,
          name: "Demo sensor",
          category: "Demo",
          status: "Demo",
          workingQuantity: 7,
          brokenQuantity: 2,
        },
      ],
    },
  };

  const report = await getInventoryReport(prisma);

  assert.deepEqual(report.totals, {
    workingQuantity: 19,
    brokenQuantity: 2,
    recordedQuantity: 21,
  });
  assert.equal(report.items[1].recordedQuantity, 9);
});

test("movement report applies only the requested component and time filters", async () => {
  const expected = [];
  let receivedArguments;
  const prisma = {
    inventoryMovement: {
      findMany: async (args) => {
        receivedArguments = args;
        return expected;
      },
    },
  };
  const from = new Date("2026-01-01T00:00:00Z");
  const to = new Date("2026-02-01T00:00:00Z");

  const report = await getMovementReport(prisma, {
    componentId: 7n,
    from,
    to,
  });

  assert.equal(report, expected);
  assert.deepEqual(receivedArguments.where, {
    componentId: 7n,
    occurredAt: { gte: from, lte: to },
  });
});

test("movement report works without filters", async () => {
  let receivedArguments;
  const prisma = {
    inventoryMovement: {
      findMany: async (args) => {
        receivedArguments = args;
        return [];
      },
    },
  };

  await getMovementReport(prisma);

  assert.deepEqual(receivedArguments.where, {});
});

test("request statistics return sorted status counts within an optional date range", async () => {
  let receivedArguments;
  const prisma = {
    request: {
      groupBy: async (args) => {
        receivedArguments = args;
        return [
          { status: "REVIEWED", _count: { _all: 2 } },
          { status: "PENDING", _count: { _all: 3 } },
        ];
      },
    },
  };
  const from = new Date("2026-01-01T00:00:00Z");
  const to = new Date("2026-02-01T00:00:00Z");

  const report = await getRequestStatistics(prisma, { from, to });

  assert.equal(report.total, 5);
  assert.deepEqual(report.byStatus, [
    { status: "PENDING", count: 3 },
    { status: "REVIEWED", count: 2 },
  ]);
  assert.deepEqual(receivedArguments.where, {
    submittedAt: { gte: from, lte: to },
  });
});

test("request statistics exclude unsubmitted drafts without date filters", async () => {
  let receivedArguments;
  const prisma = {
    request: {
      groupBy: async (args) => {
        receivedArguments = args;
        return [];
      },
    },
  };

  const report = await getRequestStatistics(prisma);

  assert.deepEqual(report, { total: 0, byStatus: [] });
  assert.deepEqual(receivedArguments.where, { submittedAt: { not: null } });
});

test("movement statistics group by movement type and stock bucket", async () => {
  let receivedArguments;
  const prisma = {
    inventoryMovement: {
      groupBy: async (args) => {
        receivedArguments = args;
        return [
          {
            movementType: "RETURN",
            quantityBucket: "working",
            _count: { _all: 2 },
            _sum: { quantityDelta: 4 },
          },
          {
            movementType: "DELIVERY",
            quantityBucket: "working",
            _count: { _all: 3 },
            _sum: { quantityDelta: -5 },
          },
        ];
      },
    },
  };
  const date = new Date("2026-03-01T00:00:00Z");

  const report = await getMovementStatistics(prisma, {
    componentId: 9n,
    from: date,
  });

  assert.deepEqual(report, [
    {
      movementType: "DELIVERY",
      quantityBucket: "working",
      count: 3,
      netQuantityDelta: -5,
    },
    {
      movementType: "RETURN",
      quantityBucket: "working",
      count: 2,
      netQuantityDelta: 4,
    },
  ]);
  assert.deepEqual(receivedArguments.where, {
    componentId: 9n,
    occurredAt: { gte: date },
  });
});

test("custody report calculates outstanding quantities per delivery item", async () => {
  const prisma = {
    deliveryItem: {
      findMany: async () => [
        {
          id: 1n,
          deliveredQuantity: 3,
          requestItem: {
            component: { id: 2n, name: "Sensor", category: "Demo" },
            request: { id: 4n, team: { id: 5n, name: "Team" } },
          },
          returnItems: [
            { workingQuantity: 1, brokenQuantity: 1 },
            { workingQuantity: 0, brokenQuantity: 0 },
          ],
        },
        {
          id: 2n,
          deliveredQuantity: 2,
          requestItem: {
            component: { id: 3n, name: "Board", category: "Demo" },
            request: { id: 6n, team: { id: 7n, name: "Other" } },
          },
          returnItems: [{ workingQuantity: 2, brokenQuantity: 0 }],
        },
      ],
    },
  };

  const report = await getCustodyReport(prisma);

  assert.equal(report.items.length, 1);
  assert.equal(report.items[0].outstandingQuantity, 1);
  assert.equal(report.totals.deliveredQuantity, 5);
  assert.equal(report.totals.returnedWorkingQuantity, 3);
  assert.equal(report.totals.returnedBrokenQuantity, 1);
  assert.equal(report.totals.outstandingQuantity, 1);
});

test("dashboard statistics combine inventory, requests, movements, and custody", async () => {
  const prisma = {
    component: {
      count: async () => 4,
      aggregate: async () => ({
        _sum: { workingQuantity: 10, brokenQuantity: 2 },
      }),
    },
    inventoryMovement: {
      count: async () => 8,
      groupBy: async () => [
        {
          movementType: "DELIVERY",
          quantityBucket: "working",
          _count: { _all: 2 },
          _sum: { quantityDelta: -3 },
        },
      ],
    },
    request: {
      groupBy: async () => [
        { status: "PENDING", _count: { _all: 2 } },
      ],
    },
    deliveryItem: {
      findMany: async () => [
        {
          id: 1n,
          deliveredQuantity: 2,
          requestItem: {
            component: { id: 2n, name: "Sensor", category: "Demo" },
            request: { id: 4n, team: { id: 5n, name: "Team" } },
          },
          returnItems: [{ workingQuantity: 1, brokenQuantity: 0 }],
        },
      ],
    },
  };

  const statistics = await getDashboardStatistics(prisma);

  assert.deepEqual(statistics, {
    componentCount: 4,
    inventory: { workingQuantity: 10, brokenQuantity: 2 },
    movementCount: 8,
    movementsByType: [
      {
        movementType: "DELIVERY",
        quantityBucket: "working",
        count: 2,
        netQuantityDelta: -3,
      },
    ],
    requests: { total: 2, byStatus: [{ status: "PENDING", count: 2 }] },
    custody: {
      deliveredQuantity: 2,
      returnedWorkingQuantity: 1,
      returnedBrokenQuantity: 0,
      outstandingQuantity: 1,
    },
  });
});

test("date filters reject invalid or inverted date ranges", async () => {
  const prisma = {
    inventoryMovement: { findMany: async () => [] },
  };

  await assert.rejects(
    getMovementReport(prisma, { from: new Date("invalid") }),
    /from must be a valid Date/,
  );
  await assert.rejects(
    getMovementReport(prisma, {
      from: new Date("2026-02-01T00:00:00Z"),
      to: new Date("2026-01-01T00:00:00Z"),
    }),
    /from date must not be later/,
  );
});
