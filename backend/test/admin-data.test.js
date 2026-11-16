const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const express = require("express");
const test = require("node:test");
process.env.DATABASE_URL ||= "postgresql://127.0.0.1:5432/hamak";
const { createAdminDataRouter } = require("../src/routes/adminData");

const bearerToken = "synthetic-admin-data-token";
const adminSession = {
  revokedAt: null,
  expiresAt: new Date(Date.now() + 60_000),
  user: { id: 9n, accountType: "ADMIN", isActive: true },
};

async function withRouter(router, run) {
  const app = express();
  app.use("/api/admin", router);
  app.use((error, req, res, next) => {
    res.status(error.statusCode || 500).json({ error: error.message });
  });
  const server = app.listen(0);
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function createPrisma(overrides = {}) {
  return {
    session: {
      findUnique: async ({ where }) => {
        assert.equal(
          where.tokenHash,
          createHash("sha256").update(bearerToken).digest("hex"),
        );
        return adminSession;
      },
    },
    ...overrides,
  };
}

test("admin inventory report serializes component ids for JSON clients", async () => {
  const prisma = createPrisma({
    component: {
      findMany: async () => [{
        id: 3n,
        name: "Controller",
        category: "Electronics",
        status: "active",
        workingQuantity: 4,
        brokenQuantity: 1,
      }],
    },
  });

  await withRouter(createAdminDataRouter(prisma), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/admin/reports/inventory`, {
      headers: { authorization: `Bearer ${bearerToken}` },
    });
    assert.equal(response.status, 200);
    const report = await response.json();
    assert.equal(report.items[0].id, "3");
    assert.deepEqual(report.totals, {
      workingQuantity: 4,
      brokenQuantity: 1,
      recordedQuantity: 5,
    });
  });
});

test("admin audit endpoint returns paginated records with serialized identifiers", async () => {
  const prisma = createPrisma({
    auditLog: {
      findMany: async ({ take, skip }) => {
        assert.equal(take, 20);
        assert.equal(skip, 10);
        return [{
          id: 21n,
          actor: { id: 9n, username: "admin", displayName: "Club Admin" },
          entityType: "component",
          entityId: "3",
          action: "COMPONENT_UPDATED",
          beforeData: null,
          afterData: { status: "active" },
          metadata: null,
          occurredAt: new Date("2026-11-15T12:00:00.000Z"),
        }];
      },
      count: async () => 31,
    },
  });

  await withRouter(createAdminDataRouter(prisma), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/admin/audit-logs?limit=20&offset=10`, {
      headers: { authorization: `Bearer ${bearerToken}` },
    });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.items[0].id, "21");
    assert.equal(result.items[0].actor.id, "9");
    assert.equal(result.total, 31);
    assert.equal(result.limit, 20);
    assert.equal(result.offset, 10);
  });
});

test("admin audit endpoint rejects unbounded pagination", async () => {
  const prisma = createPrisma({
    auditLog: {
      findMany: async () => assert.fail("invalid pagination must not query logs"),
      count: async () => assert.fail("invalid pagination must not count logs"),
    },
  });

  await withRouter(createAdminDataRouter(prisma), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/admin/audit-logs?limit=1000`, {
      headers: { authorization: `Bearer ${bearerToken}` },
    });
    assert.equal(response.status, 400);
  });
});
