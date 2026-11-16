const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const express = require("express");
const test = require("node:test");
process.env.DATABASE_URL ||= "******127.0.0.1:5432/hamak";
const { createAdminRequestsRouter } = require("../src/routes/requests");

const bearerToken = "synthetic-approval-test-token";
const adminSession = {
  id: 8n,
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
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function createApprovalPrisma({ workingQuantity, reservedQuantity }) {
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
    items: [{
      id: 45n,
      componentId: 3n,
      requestedQuantity: 5,
      approvedQuantity: 0,
      component: { name: "Controller" },
      deliveryItems: [],
    }],
  };
  const updates = [];

  return {
    updates,
    request,
    session: {
      findUnique: async ({ where }) => {
        assert.equal(
          where.tokenHash,
          createHash("sha256").update(bearerToken).digest("hex"),
        );
        return adminSession;
      },
    },
    $transaction: async (callback) =>
      callback({
        $queryRaw: async (strings) => {
          const query = strings.join("");
          if (query.includes("FROM request_items")) {
            return [{ componentId: 3n, reservedQuantity }];
          }
          return [];
        },
        request: {
          findUnique: async () => request,
          update: async ({ data }) => {
            Object.assign(request, data);
            updates.push(["request", data]);
          },
        },
        requestItem: {
          update: async ({ data }) => {
            Object.assign(request.items[0], data);
            updates.push(["item", data]);
          },
        },
        component: {
          findMany: async () => [{ id: 3n, workingQuantity, status: "active" }],
        },
        auditLog: { create: async () => ({}) },
      }),
  };
}

test("admin approval reserves stock and updates approval quantities atomically", async () => {
  const prisma = createApprovalPrisma({ workingQuantity: 8, reservedQuantity: 3 });
  await withRouter(createAdminRequestsRouter(prisma), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/requests/44/approve`, {
      method: "POST",
      headers: { authorization: `Bearer ${bearerToken}` },
    });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.request.status, "Approved");
    assert.equal(result.request.items[0].approvedQuantity, 5);
    assert.equal(prisma.request.status, "APPROVED");
    assert.equal(prisma.request.items[0].approvedQuantity, 5);
    assert.equal(prisma.updates.length, 2);
  });
});

test("admin approval rejects insufficient available stock without partial updates", async () => {
  const prisma = createApprovalPrisma({ workingQuantity: 8, reservedQuantity: 4 });
  await withRouter(createAdminRequestsRouter(prisma), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/requests/44/approve`, {
      method: "POST",
      headers: { authorization: `Bearer ${bearerToken}` },
    });
    assert.equal(response.status, 409);
    assert.match((await response.json()).error, /available 4/);
    assert.equal(prisma.updates.length, 0);
    assert.equal(prisma.request.status, "PENDING");
    assert.equal(prisma.request.items[0].approvedQuantity, 0);
  });
});

test("admin rejection records the reviewer and optional note", async () => {
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
  const prisma = {
    session: { findUnique: async () => adminSession },
    $transaction: async (callback) =>
      callback({
        $queryRaw: async () => [],
        request: {
          findUnique: async () => request,
          update: async ({ data }) => Object.assign(request, data),
        },
        auditLog: { create: async () => ({}) },
      }),
  };

  await withRouter(createAdminRequestsRouter(prisma), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/requests/44/reject`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${bearerToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ note: "Please add a project timeline." }),
    });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.request.status, "Rejected");
    assert.equal(result.request.note, "Please add a project timeline.");
    assert.equal(request.reviewedByUserId, adminSession.user.id);
  });
});
