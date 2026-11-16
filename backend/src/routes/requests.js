const express = require("express");
const { requireRoles } = require("../middleware/requireAdmin");
const { writeAuditLog } = require("../audit");
const { requestLimiter } = require("./public");
const httpError = require("../utils/httpError");

function parseId(value, label = "Request id") {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    throw httpError(400, `${label} must be a positive integer.`);
  }
  return BigInt(value);
}

function serializeStatus(status) {
  const statuses = {
    PENDING: "Pending",
    APPROVED: "Approved",
    PARTIALLY_DELIVERED: "Partially Delivered",
    DELIVERED: "Delivered",
    REJECTED: "Rejected",
    CANCELLED: "Cancelled",
  };
  return statuses[status] || status;
}

function sumBy(list, field) {
  return (list || []).reduce((total, entry) => total + (entry[field] || 0), 0);
}

function serializeRequest(request) {
  const items = request.items.map((item) => {
    const deliveryItems = item.deliveryItems || [];
    const deliveredQuantity = sumBy(deliveryItems, "deliveredQuantity");
    const returnItems = deliveryItems.flatMap((delivery) => delivery.returnItems || []);
    const returnedWorkingQuantity = sumBy(returnItems, "workingQuantity");
    const returnedBrokenQuantity = sumBy(returnItems, "brokenQuantity");
    return {
      requestItemId: item.id.toString(),
      componentId: item.componentId.toString(),
      componentName: item.component?.name || null,
      componentCategory: item.component?.category || null,
      componentImageUrl: item.component?.imageReference || null,
      requestedQuantity: item.requestedQuantity,
      approvedQuantity: item.approvedQuantity,
      deliveredQuantity,
      remainingToDeliver: Math.max(0, item.approvedQuantity - deliveredQuantity),
      returnedWorkingQuantity,
      returnedBrokenQuantity,
      outstandingQuantity: deliveredQuantity - returnedWorkingQuantity - returnedBrokenQuantity,
      deliveryItems: deliveryItems.map((delivery) => {
        const working = sumBy(delivery.returnItems, "workingQuantity");
        const broken = sumBy(delivery.returnItems, "brokenQuantity");
        return {
          deliveryItemId: delivery.id?.toString() || null,
          deliveredQuantity: delivery.deliveredQuantity,
          returnedWorkingQuantity: working,
          returnedBrokenQuantity: broken,
          outstandingQuantity: delivery.deliveredQuantity - working - broken,
        };
      }),
    };
  });
  const delivered = sumBy(items, "deliveredQuantity");
  const returned = items.reduce(
    (total, item) => total + item.returnedWorkingQuantity + item.returnedBrokenQuantity,
    0,
  );
  // Return status is kept separate from the request status (spec §04).
  const returnStatus =
    delivered === 0 ? null : returned === 0 ? "Not Returned" : returned < delivered ? "Partially Returned" : "Returned";
  return {
    id: request.id.toString(),
    teamUserId: request.submittedByUserId?.toString() || null,
    teamId: request.teamId.toString(),
    teamName: request.team?.name || null,
    projectName: request.projectName,
    projectDescription: request.projectDescription,
    note: request.reviewNote || null,
    status: serializeStatus(request.status),
    returnStatus,
    custodyClosed: delivered > 0 && returned >= delivered,
    reviewedBy: request.reviewedByUserId?.toString() || null,
    reviewedAt: request.reviewedAt,
    createdAt: request.submittedAt || request.createdAt,
    cancelledAt: request.cancelledAt,
    items,
  };
}

function requestInclude() {
  return {
    team: { select: { name: true, isActive: true } },
    items: {
      include: {
        component: { select: { name: true, category: true, imageReference: true } },
        deliveryItems: {
          select: {
            id: true,
            deliveredQuantity: true,
            returnItems: { select: { workingQuantity: true, brokenQuantity: true } },
          },
        },
      },
    },
  };
}

function parseRequestItems(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 30) {
    throw httpError(422, "At least one request item is required.");
  }

  const seen = new Set();
  return items.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw httpError(422, "Each request item must be an object.");
    }
    const componentId = String(item.componentId ?? "");
    const quantity = item.requestedQuantity ?? item.quantity;
    if (!/^[1-9]\d*$/.test(componentId)) {
      throw httpError(422, "componentId must be a positive integer.");
    }
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000) {
      throw httpError(422, "quantity must be a positive integer no greater than 1000.");
    }
    if (seen.has(componentId)) throw httpError(422, "Duplicate components in items.");
    seen.add(componentId);
    return { componentId: BigInt(componentId), requestedQuantity: quantity };
  });
}

function createRequestsRouter(prisma) {
  const router = express.Router();
  const authenticated = requireRoles(prisma, "user", "admin");
  router.use(...authenticated);

  router.post("/", requestLimiter, async (req, res, next) => {
    try {
      if (req.user.role !== "user") {
        throw httpError(403, "Only team accounts can submit requests.");
      }
      const { projectName, projectDescription, note } = req.body || {};
      const description = projectDescription ?? note;
      if (
        typeof projectName !== "string" ||
        projectName.trim().length < 1 ||
        projectName.trim().length > 100 ||
        typeof description !== "string" ||
        description.trim().length < 1 ||
        description.trim().length > 1000
      ) {
        throw httpError(422, "A project name and description are required.");
      }

      const items = parseRequestItems(req.body.items);
      const request = await prisma.$transaction(async (transaction) => {
        const components = await transaction.component.findMany({
          where: {
            id: { in: items.map((item) => item.componentId) },
            status: { not: "inactive" },
          },
          select: { id: true },
        });
        if (components.length !== items.length) {
          throw httpError(422, "One or more components are unavailable.");
        }

        const pending = await transaction.request.findFirst({
          where: {
            teamId: BigInt(req.user.teamId),
            status: "PENDING",
            submittedAt: { not: null },
          },
          select: { id: true },
        });
        if (pending) throw httpError(409, "Team already has a pending request.");

        const created = await transaction.request.create({
          data: {
            teamId: BigInt(req.user.teamId),
            submittedByUserId: BigInt(req.user.sub),
            projectName: projectName.trim(),
            projectDescription: description.trim(),
            status: "PENDING",
            items: {
              create: items.map((item) => ({
                componentId: item.componentId,
                requestedQuantity: item.requestedQuantity,
                approvedQuantity: 0,
              })),
            },
          },
        });
        await transaction.request.update({
          where: { id: created.id },
          data: { submittedAt: new Date() },
        });
        return transaction.request.findUnique({
          where: { id: created.id },
          include: requestInclude(),
        });
      });

      res.status(201).json({ request: serializeRequest(request) });
    } catch (error) {
      if (error.code === "P2002" || error.code === "23505") {
        next(httpError(409, "Team already has a pending request."));
        return;
      }
      next(error);
    }
  });

  router.get("/", async (req, res, next) => {
    try {
      const includeArchived = req.user.role === "admin" && req.query.archived === "1";
      const where = {
        submittedAt: { not: null },
        status: { not: "CANCELLED" },
        ...(req.user.role === "user"
          ? { teamId: BigInt(req.user.teamId) }
          : includeArchived
            ? {}
            : { team: { isActive: true } }),
      };
      const requests = await prisma.request.findMany({
        where,
        include: requestInclude(),
        orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
      });
      res.json({ items: requests.map(serializeRequest) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id", async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      const request = await prisma.request.findUnique({
        where: { id },
        include: requestInclude(),
      });
      if (!request || !request.submittedAt) throw httpError(404, "Request not found.");
      if (req.user.role === "user" && request.teamId.toString() !== req.user.teamId) {
        throw httpError(403, "Forbidden.");
      }
      res.json({ request: serializeRequest(request) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/:id/cancel", async (req, res, next) => {
    try {
      if (req.user.role !== "user") throw httpError(403, "Only team accounts can cancel requests.");
      const id = parseId(req.params.id);
      const request = await prisma.request.findUnique({
        where: { id },
        include: requestInclude(),
      });
      if (!request || !request.submittedAt) throw httpError(404, "Request not found.");
      if (request.teamId.toString() !== req.user.teamId) throw httpError(403, "Forbidden.");
      if (request.status !== "PENDING") {
        throw httpError(409, "Only pending requests can be cancelled.");
      }

      const changed = await prisma.request.updateMany({
        where: { id, teamId: BigInt(req.user.teamId), status: "PENDING" },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      });
      if (!changed.count) throw httpError(409, "Only pending requests can be cancelled.");
      const cancelled = await prisma.request.findUnique({
        where: { id },
        include: requestInclude(),
      });
      res.json({ request: serializeRequest(cancelled) });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:id", async (req, res, next) => {
    try {
      if (req.user.role !== "user") throw httpError(403, "Only team accounts can edit requests.");
      const request = await prisma.request.findUnique({
        where: { id: parseId(req.params.id) },
        select: { id: true, teamId: true, submittedAt: true },
      });
      if (!request || !request.submittedAt) throw httpError(404, "Request not found.");
      if (request.teamId.toString() !== req.user.teamId) throw httpError(403, "Forbidden.");
      throw httpError(409, "Request cannot be edited after submission.");
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function createAdminRequestsRouter(prisma) {
  const router = express.Router();
  router.use(...requireRoles(prisma, "admin"));

  router.post("/requests/:id/approve", async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      const approved = await prisma.$transaction(async (transaction) => {
        await transaction.$queryRaw`SELECT "id" FROM "requests" WHERE "id" = ${id} FOR UPDATE`;
        const request = await transaction.request.findUnique({
          where: { id },
          include: { items: true },
        });
        if (!request || !request.submittedAt) throw httpError(404, "Request not found.");
        if (request.status !== "PENDING") {
          throw httpError(409, "Only pending requests can be approved.");
        }

        const componentIds = [...new Set(request.items.map((item) => item.componentId.toString()))]
          .map(BigInt)
          .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
        for (const componentId of componentIds) {
          await transaction.$queryRaw`
            SELECT "id" FROM "components" WHERE "id" = ${componentId} FOR UPDATE
          `;
        }

        const components = await transaction.component.findMany({
          where: { id: { in: componentIds }, status: { not: "inactive" } },
          select: { id: true, workingQuantity: true },
        });
        const reservations = await transaction.$queryRaw`
          SELECT
            request_items.component_id AS "componentId",
            SUM(GREATEST(
              request_items.approved_quantity -
              COALESCE(delivered.delivered_quantity, 0),
              0
            ))::INTEGER AS "reservedQuantity"
          FROM request_items
          JOIN requests ON requests.id = request_items.request_id
          LEFT JOIN (
            SELECT request_item_id, SUM(delivered_quantity)::INTEGER AS delivered_quantity
            FROM delivery_items
            GROUP BY request_item_id
          ) AS delivered ON delivered.request_item_id = request_items.id
          WHERE requests.status IN ('APPROVED', 'PARTIALLY_DELIVERED')
          GROUP BY request_items.component_id
        `;
        const componentById = new Map(
          components.map((component) => [component.id.toString(), component]),
        );
        const reservedById = new Map(
          reservations.map((reservation) => [
            reservation.componentId.toString(),
            Number(reservation.reservedQuantity),
          ]),
        );
        const shortages = request.items.flatMap((item) => {
          const component = componentById.get(item.componentId.toString());
          const available = component
            ? component.workingQuantity - (reservedById.get(item.componentId.toString()) || 0)
            : 0;
          return item.requestedQuantity > available
            ? [{ componentId: item.componentId.toString(), requested: item.requestedQuantity, available }]
            : [];
        });
        if (shortages.length) {
          const details = shortages
            .map(({ componentId, requested, available }) =>
              `${componentId} (requested ${requested}, available ${available})`,
            )
            .join(", ");
          throw httpError(409, `Insufficient available quantity: ${details}`);
        }

        for (const item of request.items) {
          await transaction.requestItem.update({
            where: { id: item.id },
            data: { approvedQuantity: item.requestedQuantity },
          });
        }
        await transaction.request.update({
          where: { id },
          data: {
            status: "APPROVED",
            reviewedByUserId: BigInt(req.user.sub),
            reviewedAt: new Date(),
          },
        });
        const approvedRequest = await transaction.request.findUnique({
          where: { id },
          include: requestInclude(),
        });
        await writeAuditLog(transaction, {
          actorUserId: BigInt(req.user.sub),
          entityType: "request",
          entityId: id.toString(),
          action: "REQUEST_APPROVED",
          beforeData: { status: request.status },
          afterData: { status: "APPROVED" },
        });
        return approvedRequest;
      });
      res.json({ request: serializeRequest(approved) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/requests/:id/reject", async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      const note = req.body?.note;
      if (note !== undefined && (typeof note !== "string" || note.trim().length > 500)) {
        throw httpError(422, "note must be a string of at most 500 characters.");
      }
      const rejected = await prisma.$transaction(async (transaction) => {
        await transaction.$queryRaw`SELECT "id" FROM "requests" WHERE "id" = ${id} FOR UPDATE`;
        const request = await transaction.request.findUnique({
          where: { id },
          select: { id: true, submittedAt: true, status: true },
        });
        if (!request || !request.submittedAt) throw httpError(404, "Request not found.");
        if (request.status !== "PENDING") {
          throw httpError(409, "Only pending requests can be rejected.");
        }
        const rejectedRequest = await transaction.request.update({
          where: { id },
          data: {
            status: "REJECTED",
            reviewedByUserId: BigInt(req.user.sub),
            reviewedAt: new Date(),
            reviewNote: note?.trim() || null,
          },
          include: requestInclude(),
        });
        await writeAuditLog(transaction, {
          actorUserId: BigInt(req.user.sub),
          entityType: "request",
          entityId: id.toString(),
          action: "REQUEST_REJECTED",
          beforeData: { status: request.status },
          afterData: { status: "REJECTED", note: note?.trim() || null },
        });
        return rejectedRequest;
      });
      res.json({ request: serializeRequest(rejected) });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { createRequestsRouter, createAdminRequestsRouter };
