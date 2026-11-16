const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { stat } = require("node:fs/promises");
const express = require("express");
const test = require("node:test");
process.env.DATABASE_URL ||= "postgresql://test:test@127.0.0.1:5432/hamak";
const { createApp } = require("../src/app");
const { componentUploadDirectory } = require("../src/config/uploadPaths");
const { createComponentsRouter } = require("../src/routes/components");
const { createInventoryOperationsRouter } = require("../src/routes/inventoryOperations");
const { createRequestsRouter } = require("../src/routes/requests");

const bearerToken = "synthetic-api-test-token";
const session = {
  revokedAt: null,
  expiresAt: new Date(Date.now() + 60_000),
  user: { id: 9n, accountType: "ADMIN", isActive: true },
};

async function withRouter(router, run, prefix = "/api") {
  const app = express();
  app.use(express.json());
  app.use(prefix, router);
  app.use((error, req, res, next) => {
    res.status(error.statusCode || 500).json({ error: error.message });
  });
  const server = app.listen(0);
  try {
    const address = server.address();
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function sessionPrisma(overrides = {}) {
  return {
    session: {
      findUnique: async ({ where }) => {
        assert.equal(
          where.tokenHash,
          createHash("sha256").update(bearerToken).digest("hex"),
        );
        return session;
      },
    },
    ...overrides,
  };
}

test("component creation records starting stock through inventory movements", async () => {
  const component = {
    id: 12n,
    name: "Controller",
    category: "Electronics",
    description: null,
    imageReference: null,
    status: "active",
    workingQuantity: 0,
    brokenQuantity: 0,
  };
  const movements = [];
  const prisma = sessionPrisma({
    $transaction: async (callback) =>
      callback({
        component: {
          create: async ({ data }) => Object.assign(component, data),
          findUniqueOrThrow: async () => component,
        },
        auditLog: { create: async () => ({}) },
        inventoryMovement: {
          create: async ({ data }) => {
            movements.push(data);
            component[`${data.quantityBucket}Quantity`] += data.quantityDelta;
          },
        },
      }),
  });

  await withRouter(createComponentsRouter(prisma), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/components`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${bearerToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: " Controller ",
        category: " Electronics ",
        workingQuantity: 8,
        brokenQuantity: 2,
      }),
    });

    assert.equal(response.status, 201);
    const result = await response.json();
    assert.equal(result.item.workingQuantity, 8);
    assert.equal(result.item.brokenQuantity, 2);
    assert.deepEqual(
      movements.map(({ quantityBucket, quantityDelta }) => [quantityBucket, quantityDelta]),
      [
        ["working", 8],
        ["broken", 2],
      ],
    );
    assert.ok(movements.every(({ actorUserId }) => actorUserId === session.user.id));
  });
});

test("delivery route relies on database triggers for inventory movements and balances", async () => {
  const calls = [];
  const request = {
    id: 3n,
    status: "APPROVED",
    items: [{ id: 4n, componentId: 5n, approvedQuantity: 6 }],
  };
  const prisma = sessionPrisma({
    $transaction: async (callback) =>
      callback({
        request: { findUnique: async () => request, update: async () => {} },
        deliveryItem: {
          aggregate: async () => ({ _sum: { deliveredQuantity: 0 } }),
          create: async (args) => {
            calls.push(["deliveryItem.create", args]);
            return { id: 13n };
          },
        },
        component: { findUnique: async () => ({ workingQuantity: 10 }) },
        delivery: { create: async () => ({ id: 12n }) },
        requestItem: { findMany: async () => request.items },
        auditLog: { create: async () => ({}) },
        inventoryMovement: {
          create: async () => calls.push(["inventoryMovement.create"]),
        },
      }),
  });

  await withRouter(createInventoryOperationsRouter(prisma), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/requests/3/deliveries`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${bearerToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        items: [{ requestItemId: "4", deliveredQuantity: 2 }],
      }),
    });

    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), {
      id: "12",
      message: "Delivery recorded successfully.",
    });
    assert.equal(calls.filter(([name]) => name === "deliveryItem.create").length, 1);
    assert.equal(calls.some(([name]) => name === "inventoryMovement.create"), false);
  });
});

test("protected API routes reject missing sessions", async () => {
  const prisma = {
    session: { findUnique: async () => null },
  };

  await withRouter(createComponentsRouter(prisma), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/components`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Part", category: "Test" }),
    });
    assert.equal(response.status, 401);
  });
});

test("application exposes a database-backed health endpoint", async () => {
  const database = {
    $queryRaw: async () => [{ "?column?": 1 }],
  };
  const app = createApp(database);
  const server = app.listen(0);
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok" });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test("component upload directory is created when the API loads", async () => {
  const directory = await stat(componentUploadDirectory);
  assert.equal(directory.isDirectory(), true);
});

test("application allows CORS only from the configured frontend origin", async () => {
  const originalFrontendUrl = process.env.FRONTEND_URL;
  process.env.FRONTEND_URL = "https://frontend.example.test";
  const app = createApp({
    $queryRaw: async () => [{ eventEndsAt: null }],
  });
  if (originalFrontendUrl === undefined) {
    delete process.env.FRONTEND_URL;
  } else {
    process.env.FRONTEND_URL = originalFrontendUrl;
  }

  const server = app.listen(0);
  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const allowedResponse = await fetch(`${baseUrl}/api/config`, {
      headers: { origin: "https://frontend.example.test" },
    });
    assert.equal(
      allowedResponse.headers.get("access-control-allow-origin"),
      "https://frontend.example.test",
    );
    assert.equal(allowedResponse.headers.get("access-control-allow-credentials"), "true");

    const preflightResponse = await fetch(`${baseUrl}/api/components`, {
      method: "OPTIONS",
      headers: {
        origin: "https://frontend.example.test",
        "access-control-request-method": "POST",
      },
    });
    assert.equal(preflightResponse.status, 204);
    assert.match(
      preflightResponse.headers.get("access-control-allow-headers"),
      /Authorization/i,
    );

    const blockedResponse = await fetch(`${baseUrl}/api/config`, {
      headers: { origin: "https://untrusted.example.test" },
    });
    assert.equal(blockedResponse.headers.get("access-control-allow-origin"), null);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test("team request submission persists the authenticated account and its items atomically", async () => {
  const calls = [];
  const teamSession = {
    ...session,
    user: {
      id: 21n,
      accountType: "TEAM",
      username: "team1",
      teamId: 5n,
      team: { id: 5n, name: "Robo Team", isActive: true },
      isActive: true,
    },
  };
  const createdRequest = {
    id: 8n,
    teamId: 5n,
    submittedByUserId: 21n,
    projectName: "Rescue Bot",
    projectDescription: "Synthetic request",
    reviewNote: null,
    status: "PENDING",
    submittedAt: new Date("2026-11-14T12:00:00.000Z"),
    createdAt: new Date("2026-11-14T12:00:00.000Z"),
    cancelledAt: null,
    reviewedByUserId: null,
    reviewedAt: null,
    team: { name: "Robo Team" },
    items: [{
      id: 2n,
      componentId: 3n,
      requestedQuantity: 2,
      approvedQuantity: 0,
      component: { name: "Controller" },
      deliveryItems: [],
    }],
  };
  const prisma = sessionPrisma({
    session: {
      findUnique: async () => teamSession,
    },
    $transaction: async (callback) =>
      callback({
        component: {
          findMany: async ({ where }) => {
            assert.deepEqual(where.id.in, [3n]);
            return [{ id: 3n }];
          },
        },
        request: {
          findFirst: async () => null,
          create: async ({ data }) => {
            calls.push(["request", data]);
            return { id: createdRequest.id };
          },
          update: async ({ where, data }) => {
            calls.push(["submit", where, data]);
            return createdRequest;
          },
          findUnique: async () => createdRequest,
        },
      }),
  });

  await withRouter(createRequestsRouter(prisma), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/requests`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${bearerToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        projectName: " Rescue Bot ",
        projectDescription: "Synthetic request",
        items: [{ componentId: "3", quantity: 2 }],
      }),
    });

    assert.equal(response.status, 201);
    const result = await response.json();
    assert.equal(result.request.id, "8");
    assert.equal(result.request.status, "Pending");
    assert.equal(result.request.items[0].requestItemId, "2");
    assert.equal(calls[0][1].teamId, 5n);
    assert.equal(calls[0][1].submittedByUserId, 21n);
    assert.equal(calls[0][1].projectName, "Rescue Bot");
    assert.deepEqual(calls[0][1].items.create, [
      { componentId: 3n, requestedQuantity: 2, approvedQuantity: 0 },
    ]);
    assert.equal(calls[1][2].submittedAt instanceof Date, true);
  }, "/api/requests");
});

test("admin outstanding-deliveries endpoint returns only the unreturned custody balance", async () => {
  const deliveryItems = [
    {
      id: 13n,
      deliveredQuantity: 5,
      requestItem: {
        component: { id: 3n, name: "Controller", category: "Electronics" },
        request: {
          id: 8n,
          projectName: "Rescue Bot",
          team: { id: 5n, name: "Robo Team" },
        },
      },
      returnItems: [{ workingQuantity: 2, brokenQuantity: 1 }],
    },
    {
      id: 14n,
      deliveredQuantity: 2,
      requestItem: {
        component: { id: 4n, name: "Sensor", category: "Electronics" },
        request: {
          id: 9n,
          projectName: "Greenhouse",
          team: { id: 6n, name: "Plant Team" },
        },
      },
      returnItems: [{ workingQuantity: 2, brokenQuantity: 0 }],
    },
  ];
  const prisma = sessionPrisma({
    deliveryItem: {
      findMany: async () => deliveryItems,
    },
  });

  await withRouter(createInventoryOperationsRouter(prisma), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/admin/deliveries/outstanding`, {
      headers: { authorization: `Bearer ${bearerToken}` },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      items: [{
        deliveryItemId: "13",
        requestId: "8",
        projectName: "Rescue Bot",
        teamId: "5",
        teamName: "Robo Team",
        componentId: "3",
        componentName: "Controller",
        category: "Electronics",
        deliveredQuantity: 5,
        returnedWorkingQuantity: 2,
        returnedBrokenQuantity: 1,
        outstandingQuantity: 2,
      }],
    });
  });
});

test("team request submission rejects invalid input before opening a transaction", async () => {
  const teamSession = {
    ...session,
    user: {
      id: 21n,
      accountType: "TEAM",
      username: "team1",
      teamId: 5n,
      team: { id: 5n, name: "Robo Team", isActive: true },
      isActive: true,
    },
  };
  const prisma = sessionPrisma({
    session: { findUnique: async () => teamSession },
    $transaction: async () => assert.fail("transaction must not run"),
  });
  await withRouter(createRequestsRouter(prisma), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/requests`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${bearerToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ projectName: "", projectDescription: "", items: [] }),
    });
    assert.equal(response.status, 422);
  }, "/api/requests");
});

test("team requests are scoped to their team and cancellation is limited to pending requests", async () => {
  const teamSession = {
    ...session,
    user: {
      id: 21n,
      accountType: "TEAM",
      username: "team1",
      teamId: 5n,
      team: { id: 5n, name: "Robo Team", isActive: true },
      isActive: true,
    },
  };
  const request = {
    id: 44n,
    teamId: 5n,
    submittedByUserId: 21n,
    projectName: "Greenhouse",
    projectDescription: "Monitor plants",
    reviewNote: null,
    status: "PENDING",
    submittedAt: new Date(),
    createdAt: new Date(),
    cancelledAt: null,
    reviewedByUserId: null,
    reviewedAt: null,
    team: { name: "Robo Team" },
    items: [],
  };
  let listWhere;
  const prisma = sessionPrisma({
    session: { findUnique: async () => teamSession },
    request: {
      findMany: async ({ where }) => {
        listWhere = where;
        return [request];
      },
      findUnique: async ({ where }) => ({
        ...request,
        id: where.id,
        teamId: where.id === 44n ? 5n : 6n,
      }),
      updateMany: async ({ where, data }) => {
        assert.equal(where.teamId, 5n);
        assert.equal(where.status, "PENDING");
        Object.assign(request, data);
        return { count: 1 };
      },
    },
  });

  await withRouter(createRequestsRouter(prisma), async (baseUrl) => {
    const headers = { authorization: `Bearer ${bearerToken}` };
    const list = await fetch(`${baseUrl}/api/requests`, { headers });
    assert.equal(list.status, 200);
    assert.equal(listWhere.teamId, 5n);
    assert.equal((await list.json()).items[0].teamId, "5");

    const otherTeamRequest = await fetch(`${baseUrl}/api/requests/45`, { headers });
    assert.equal(otherTeamRequest.status, 403);

    const cancelled = await fetch(`${baseUrl}/api/requests/44/cancel`, {
      method: "POST",
      headers,
    });
    assert.equal(cancelled.status, 200);
    assert.equal((await cancelled.json()).request.status, "Cancelled");
    assert.equal(request.status, "CANCELLED");
  }, "/api/requests");
});

test("catalog derives current availability and on-loan totals from database records", async () => {
  const prisma = {
    component: {
      findMany: async () => [
        {
          id: 7n,
          name: "Sensor",
          category: "Sensors",
          description: null,
          imageReference: null,
          status: "active",
          workingQuantity: 0,
          brokenQuantity: 0,
        },
      ],
    },
    $queryRaw: async () => [{ component_id: 7n, outstanding_quantity: 4 }],
  };

  await withRouter(createComponentsRouter(prisma), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/components`);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.items[0].onLoanQuantity, 4);
    assert.equal(result.items[0].availableQuantity, 0);
    assert.equal(result.items[0].availabilityStatus, "IN_USE");
    assert.equal(result.demoData, false);
  });
});

test("catalog subtracts approved reservations from available quantity", async () => {
  const prisma = {
    component: {
      findMany: async () => [{
        id: 8n,
        name: "Reserved motor",
        category: "Motors",
        description: null,
        imageReference: null,
        status: "active",
        workingQuantity: 6,
        brokenQuantity: 0,
      }],
    },
    $queryRaw: async (strings) =>
      strings.join("").includes("approved_quantity")
        ? [{ component_id: 8n, reserved_quantity: 4 }]
        : [],
  };

  await withRouter(createComponentsRouter(prisma), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/components`);
    const { items } = await response.json();
    assert.equal(items[0].workingQuantity, 6);
    assert.equal(items[0].reservedQuantity, 4);
    assert.equal(items[0].availableQuantity, 2);
    assert.equal(items[0].availabilityStatus, "LIMITED");
  });
});

test("application returns an API-only 404 for the root route", async () => {
  const database = { $queryRaw: async () => [{ "?column?": 1 }] };
  const server = createApp(database).listen(0);
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/`);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "Route not found." });
    assert.equal(response.headers.get("x-frame-options"), "DENY");
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
