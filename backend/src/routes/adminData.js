const express = require("express");
const requireAdmin = require("../middleware/requireAdmin");
const {
  getCustodyReport,
  getDashboardStatistics,
  getInventoryReport,
} = require("../reports");
const httpError = require("../utils/httpError");
const { writeAuditLog } = require("../audit");
const { verifyPassword } = require("../utils/password");

const RESET_CONFIRMATION = "DELETE DATA";

function createAdminDataRouter(prisma) {
  const router = express.Router();
  router.use(...requireAdmin(prisma));

  async function dashboard(req, res, next) {
    try {
      const [statistics, pendingRequests, teams] = await Promise.all([
        getDashboardStatistics(prisma),
        prisma.request.count({
          where: { status: "PENDING", submittedAt: { not: null }, team: { isActive: true } },
        }),
        prisma.team.count({ where: { isActive: true } }),
      ]);
      res.set("Cache-Control", "no-store");
      res.json({ ...statistics, pendingRequests, activeTeams: teams });
    } catch (error) {
      next(error);
    }
  }
  router.get("/reports/dashboard", dashboard);
  router.get("/dashboard", dashboard);

  router.get("/reports/movements", async (req, res, next) => {
    try {
      const limit = Number(req.query.limit ?? 100);
      const offset = Number(req.query.offset ?? 0);
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200 || !Number.isSafeInteger(offset) || offset < 0) {
        throw httpError(400, "limit must be 1-200 and offset must be non-negative.");
      }
      const where = {};
      if (req.query.componentId !== undefined) {
        if (!/^[1-9]\d*$/.test(String(req.query.componentId))) {
          throw httpError(400, "componentId must be a positive integer.");
        }
        where.componentId = BigInt(req.query.componentId);
      }
      const [items, total] = await Promise.all([
        prisma.inventoryMovement.findMany({
          where,
          include: {
            component: { select: { id: true, name: true, category: true } },
            actor: { select: { username: true, displayName: true } },
          },
          orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
          skip: offset,
          take: limit,
        }),
        prisma.inventoryMovement.count({ where }),
      ]);
      res.json({
        items: items.map((item) => ({
          id: item.id.toString(),
          componentId: item.componentId.toString(),
          componentName: item.component.name,
          category: item.component.category,
          movementType: item.movementType,
          quantityBucket: item.quantityBucket,
          quantityDelta: item.quantityDelta,
          occurredAt: item.occurredAt,
          notes: item.notes,
          actor: item.actor ? item.actor.displayName || item.actor.username : null,
        })),
        total,
        limit,
        offset,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/hackathon-summaries", async (req, res, next) => {
    try {
      const items = await prisma.hackathonSummary.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 20,
      });
      res.json({
        items: items.map((item) => ({
          id: item.id.toString(),
          title: item.title,
          summaryData: item.summaryData,
          createdAt: item.createdAt,
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  // Pre-checks shown in the reset screen before the admin confirms.
  async function resetBlockers(client) {
    const [openRequests, custody] = await Promise.all([
      client.request.groupBy({
        by: ["status"],
        where: {
          status: { in: ["PENDING", "APPROVED", "PARTIALLY_DELIVERED"] },
          submittedAt: { not: null },
          team: { isActive: true },
        },
        _count: { _all: true },
      }),
      getCustodyReport(client),
    ]);
    return {
      openRequests: openRequests.map(({ status, _count }) => ({ status, count: _count._all })),
      outstandingQuantity: custody.totals.outstandingQuantity,
    };
  }

  router.get("/reset-hackathon-data/check", async (req, res, next) => {
    try {
      const blockers = await resetBlockers(prisma);
      const teams = await prisma.team.count({ where: { isActive: true } });
      res.json({
        ...blockers,
        activeTeams: teams,
        allowed: blockers.openRequests.length === 0 && blockers.outstandingQuantity === 0,
      });
    } catch (error) {
      next(error);
    }
  });

  // Hackathon reset (spec §13). Requests, deliveries and returns are append-only
  // historical records in the database design (enforced by triggers), so team
  // data is archived instead of physically deleted: team accounts are
  // deactivated and anonymised, their sessions are revoked, and their data is
  // hidden from every screen. Inventory, images, admin accounts and a final
  // per-component summary are kept.
  router.post("/reset-hackathon-data", async (req, res, next) => {
    try {
      const { confirmation, password } = req.body || {};
      if (confirmation !== RESET_CONFIRMATION) {
        throw httpError(422, `Type ${RESET_CONFIRMATION} exactly to confirm.`);
      }
      if (typeof password !== "string" || !password) throw httpError(422, "Password is required.");
      const admin = await prisma.user.findUnique({ where: { id: BigInt(req.user.id) } });
      if (!admin || !(await verifyPassword(password, admin.passwordHash))) {
        throw httpError(403, "Password verification failed.");
      }

      const result = await prisma.$transaction(async (transaction) => {
        await transaction.$executeRaw`LOCK TABLE "requests" IN SHARE ROW EXCLUSIVE MODE`;
        const blockers = await resetBlockers(transaction);
        if (blockers.openRequests.length) {
          throw httpError(409, "Close all pending, approved, and partially delivered requests first.");
        }
        if (blockers.outstandingQuantity > 0) {
          throw httpError(409, `Teams still hold ${blockers.outstandingQuantity} item(s). Record all returns first.`);
        }

        const returned = await transaction.$queryRaw`
          SELECT request_items.component_id AS component_id,
                 COALESCE(SUM(return_items.working_quantity), 0)::INTEGER AS returned_working,
                 COALESCE(SUM(return_items.broken_quantity), 0)::INTEGER AS returned_broken
          FROM return_items
          JOIN delivery_items ON delivery_items.id = return_items.delivery_item_id
          JOIN request_items ON request_items.id = delivery_items.request_item_id
          JOIN requests ON requests.id = request_items.request_id
          JOIN teams ON teams.id = requests.team_id
          WHERE teams.is_active = TRUE
          GROUP BY request_items.component_id
        `;
        const returnedById = new Map(returned.map((row) => [row.component_id.toString(), row]));
        const components = await transaction.component.findMany({ orderBy: { id: "asc" } });
        const teams = await transaction.team.findMany({
          where: { isActive: true },
          include: { leader: { select: { id: true, username: true } } },
        });
        const summaryData = {
          resetAt: new Date().toISOString(),
          archivedTeams: teams.length,
          components: components.map((component) => {
            const row = returnedById.get(component.id.toString());
            return {
              componentId: component.id.toString(),
              name: component.name,
              category: component.category,
              returnedWorking: row ? Number(row.returned_working) : 0,
              returnedBroken: row ? Number(row.returned_broken) : 0,
              finalWorkingQuantity: component.workingQuantity,
              finalBrokenQuantity: component.brokenQuantity,
            };
          }),
        };
        const summary = await transaction.hackathonSummary.create({
          data: {
            createdByUserId: BigInt(req.user.sub),
            title: `Hackathon reset ${summaryData.resetAt.slice(0, 10)}`,
            summaryData,
          },
        });

        for (const team of teams) {
          if (team.leader) {
            const archivedName = `archived-${team.leader.id}-${team.leader.username || "team"}`.slice(0, 64);
            await transaction.session.updateMany({
              where: { userId: team.leader.id, revokedAt: null },
              data: { revokedAt: new Date() },
            });
            await transaction.user.update({
              where: { id: team.leader.id },
              data: { isActive: false, username: archivedName, passwordHash: null },
            });
          }
          await transaction.team.update({ where: { id: team.id }, data: { isActive: false } });
        }

        await writeAuditLog(transaction, {
          actorUserId: BigInt(req.user.sub),
          entityType: "hackathon",
          entityId: summary.id.toString(),
          action: "HACKATHON_DATA_RESET",
          afterData: { archivedTeams: teams.length, summaryId: summary.id.toString() },
        });
        return { summaryId: summary.id.toString(), archivedTeams: teams.length, summaryData };
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get("/reports/inventory", async (req, res, next) => {
    try {
      const report = await getInventoryReport(prisma);
      res.json({
        ...report,
        items: report.items.map((item) => ({ ...item, id: item.id.toString() })),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/reports/custody", async (req, res, next) => {
    try {
      const report = await getCustodyReport(prisma);
      res.json({
        ...report,
        items: report.items.map((item) => ({
          ...item,
          deliveryItemId: item.deliveryItemId.toString(),
          requestId: item.requestId.toString(),
          team: { ...item.team, id: item.team.id.toString() },
          component: { ...item.component, id: item.component.id.toString() },
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/audit-logs", async (req, res, next) => {
    try {
      const requestedLimit = Number(req.query.limit ?? 50);
      const requestedOffset = Number(req.query.offset ?? 0);
      if (
        !Number.isSafeInteger(requestedLimit) ||
        requestedLimit < 1 ||
        requestedLimit > 100 ||
        !Number.isSafeInteger(requestedOffset) ||
        requestedOffset < 0
      ) {
        throw httpError(400, "limit must be 1-100 and offset must be non-negative.");
      }

      const [items, total] = await Promise.all([
        prisma.auditLog.findMany({
          include: {
            actor: { select: { id: true, username: true, displayName: true } },
          },
          orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
          skip: requestedOffset,
          take: requestedLimit,
        }),
        prisma.auditLog.count(),
      ]);
      res.json({
        items: items.map((item) => ({
          id: item.id.toString(),
          actor: item.actor
            ? {
                id: item.actor.id.toString(),
                username: item.actor.username,
                displayName: item.actor.displayName,
              }
            : null,
          entityType: item.entityType,
          entityId: item.entityId,
          action: item.action,
          beforeData: item.beforeData,
          afterData: item.afterData,
          metadata: item.metadata,
          occurredAt: item.occurredAt,
        })),
        total,
        limit: requestedLimit,
        offset: requestedOffset,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { createAdminDataRouter };
