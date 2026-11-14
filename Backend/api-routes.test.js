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
const { createPublicRouter } = require("../src/routes/public");

const bearerToken = "synthetic-api-test-token";
const session = {
  revokedAt: null,
  expiresAt: new Date(Date.now() + 60_000),
  user: { id: 9n, accountType: "ADMIN", isActive: true },
};

async function withRouter(router, run) {
  const app = express();
  app.use(express.json());
  app.use("/api", router);
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

test("public request submission creates a team request and its items atomically", async () => {
  const calls = [];
  const prisma = {
    $transaction: async (callback) =>
      callback({
        component: {
          findMany: async ({ where }) => {
            assert.deepEqual(where.id.in, [3n]);
            return [{ id: 3n }];
          },
        },
        team: {
          findFirst: async () => null,
          create: async ({ data }) => {
            calls.push(["team", data]);
            return { id: 5n };
          },
        },
        request: {
          findFirst: async () => null,
          create: async ({ data }) => {
            calls.push(["request", data]);
            return { id: 8n };
          },
          update: async ({ where, data }) => ({
            id: where.id,
            status: "PENDING",
            submittedAt: data.submittedAt,
          }),
        },
      }),
  };

  await withRouter(createPublicRouter(prisma), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/requests`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        teamName: "  Robo Team ",
        projectName: " Rescue Bot ",
        note: "Synthetic request",
        items: [{ componentId: "3", requestedQuantity: 2 }],
      }),
    });

    assert.equal(response.status, 201);
    const result = await response.json();
    assert.equal(result.id, "8");
    assert.equal(result.status, "PENDING");
    assert.equal(calls[0][1].name, "Robo Team");
    assert.equal(calls[1][1].projectName, "Rescue Bot");
    assert.equal(calls[1][1].submittedByUserId, undefined);
    assert.deepEqual(calls[1][1].items.create, [
      { componentId: 3n, requestedQuantity: 2, approvedQuantity: 0 },
    ]);
  });
});

test("public request submission rejects invalid input before opening a transaction", async () => {
  const prisma = { $transaction: async () => assert.fail("transaction must not run") };
  await withRouter(createPublicRouter(prisma), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/requests`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ teamName: "R", projectName: "", items: [] }),
    });
    assert.equal(response.status, 400);
  });
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
    assert.equal(result.items[0].availabilityStatus, "IN_USE");
    assert.equal(result.demoData, false);
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
