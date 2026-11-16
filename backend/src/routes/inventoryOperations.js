const express = require("express");
const requireAdmin = require("../middleware/requireAdmin");
const { writeAuditLog } = require("../audit");
const httpError = require("../utils/httpError");

function isPositiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function isNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function toId(value, label) {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    throw httpError(400, `${label} must be a positive integer.`);
  }
  return BigInt(value);
}

function createInventoryOperationsRouter(prisma) {
  const router = express.Router();
  const adminOnly = requireAdmin(prisma);

  router.get("/admin/deliveries/outstanding", adminOnly, async (req, res, next) => {
    try {
      const deliveryItems = await prisma.deliveryItem.findMany({
        include: {
          requestItem: {
            include: {
              component: { select: { id: true, name: true, category: true } },
              request: {
                select: {
                  id: true,
                  team: { select: { id: true, name: true } },
                  projectName: true,
                },
              },
            },
          },
          returnItems: {
            select: { workingQuantity: true, brokenQuantity: true },
          },
        },
        orderBy: [{ id: "desc" }],
      });

      const items = deliveryItems.flatMap((deliveryItem) => {
        const returnedWorkingQuantity = deliveryItem.returnItems.reduce(
          (total, item) => total + item.workingQuantity,
          0,
        );
        const returnedBrokenQuantity = deliveryItem.returnItems.reduce(
          (total, item) => total + item.brokenQuantity,
          0,
        );
        const outstandingQuantity =
          deliveryItem.deliveredQuantity - returnedWorkingQuantity - returnedBrokenQuantity;
        if (outstandingQuantity <= 0) return [];

        const { request, component } = deliveryItem.requestItem;
        return [{
          deliveryItemId: deliveryItem.id.toString(),
          requestId: request.id.toString(),
          projectName: request.projectName,
          teamId: request.team.id.toString(),
          teamName: request.team.name,
          componentId: component.id.toString(),
          componentName: component.name,
          category: component.category,
          deliveredQuantity: deliveryItem.deliveredQuantity,
          returnedWorkingQuantity,
          returnedBrokenQuantity,
          outstandingQuantity,
        }];
      });

      res.json({ items });
    } catch (error) {
      next(error);
    }
  });

  router.post("/requests/:requestId/deliveries", adminOnly, async (req, res, next) => {
    try {
      const requestId = toId(req.params.requestId, "Request id");
      const items = req.body?.items;
      if (!Array.isArray(items) || items.length === 0) {
        throw httpError(400, "At least one delivery item is required.");
      }

      const normalizedItems = items.map((item) => {
        if (item === null || typeof item !== "object" || Array.isArray(item)) {
          throw httpError(400, "Each delivery item must be an object.");
        }
        return {
          requestItemId: toId(String(item.requestItemId), "requestItemId"),
          quantity: item.deliveredQuantity,
        };
      });
      if (normalizedItems.some((item) => !isPositiveInteger(item.quantity))) {
        throw httpError(400, "deliveredQuantity must be a positive safe integer.");
      }

      const delivery = await prisma.$transaction(async (transaction) => {
        const request = await transaction.request.findUnique({
          where: { id: requestId },
          include: { items: true },
        });
        if (!request) throw httpError(404, "Request not found.");
        if (!["APPROVED", "PARTIALLY_DELIVERED"].includes(request.status)) {
          throw httpError(409, "Only approved requests can be delivered.");
        }

        const requestItems = new Map(request.items.map((item) => [item.id.toString(), item]));
        const seenRequestItemIds = new Set();
        const deliveryData = [];

        for (const item of normalizedItems) {
          const key = item.requestItemId.toString();
          if (seenRequestItemIds.has(key)) throw httpError(400, "Duplicate requestItemId.");
          seenRequestItemIds.add(key);

          const requestItem = requestItems.get(key);
          if (!requestItem) {
            throw httpError(400, "Request item does not belong to this request.");
          }

          const delivered = await transaction.deliveryItem.aggregate({
            where: { requestItemId: requestItem.id },
            _sum: { deliveredQuantity: true },
          });
          const alreadyDelivered = delivered._sum.deliveredQuantity || 0;
          if (item.quantity > requestItem.approvedQuantity - alreadyDelivered) {
            throw httpError(409, `Delivery exceeds approved quantity for request item ${key}.`);
          }

          const component = await transaction.component.findUnique({
            where: { id: requestItem.componentId },
            select: { workingQuantity: true },
          });
          if (!component || component.workingQuantity < item.quantity) {
            throw httpError(409, `Insufficient working stock for component ${requestItem.componentId}.`);
          }
          deliveryData.push({ requestItem, quantity: item.quantity });
        }

        const createdDelivery = await transaction.delivery.create({
          data: {
            requestId,
            deliveredByUserId: BigInt(req.user.sub),
          },
        });

        for (const item of deliveryData) {
          await transaction.deliveryItem.create({
            data: {
              deliveryId: createdDelivery.id,
              requestId,
              requestItemId: item.requestItem.id,
              deliveredQuantity: item.quantity,
            },
          });
        }

        const allItems = await transaction.requestItem.findMany({ where: { requestId } });
        const fullyDelivered = await Promise.all(
          allItems.map(async (item) => {
            const delivered = await transaction.deliveryItem.aggregate({
              where: { requestItemId: item.id },
              _sum: { deliveredQuantity: true },
            });
            return (delivered._sum.deliveredQuantity || 0) >= item.approvedQuantity;
          }),
        );
        await transaction.request.update({
          where: { id: requestId },
          data: {
            status: fullyDelivered.every(Boolean) ? "DELIVERED" : "PARTIALLY_DELIVERED",
          },
        });
        await writeAuditLog(transaction, {
          actorUserId: BigInt(req.user.sub),
          entityType: "request",
          entityId: requestId.toString(),
          action: "REQUEST_DELIVERED",
          beforeData: { status: request.status },
          afterData: {
            status: fullyDelivered.every(Boolean) ? "DELIVERED" : "PARTIALLY_DELIVERED",
            deliveryId: createdDelivery.id.toString(),
            items: deliveryData.map((item) => ({
              requestItemId: item.requestItem.id.toString(),
              deliveredQuantity: item.quantity,
            })),
          },
        });
        return createdDelivery;
      });

      res.status(201).json({
        id: delivery.id.toString(),
        message: "Delivery recorded successfully.",
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/deliveries/:deliveryItemId/returns", adminOnly, async (req, res, next) => {
    try {
      const deliveryItemId = toId(req.params.deliveryItemId, "Delivery item id");
      const { workingQuantity, brokenQuantity } = req.body || {};
      if (
        !isNonNegativeInteger(workingQuantity) ||
        !isNonNegativeInteger(brokenQuantity) ||
        workingQuantity + brokenQuantity <= 0
      ) {
        throw httpError(
          400,
          "workingQuantity and brokenQuantity must be non-negative safe integers and not both zero.",
        );
      }

      const returned = await prisma.$transaction(async (transaction) => {
        const deliveryItem = await transaction.deliveryItem.findUnique({
          where: { id: deliveryItemId },
        });
        if (!deliveryItem) throw httpError(404, "Delivery item not found.");

        const existingReturns = await transaction.returnItem.aggregate({
          where: { deliveryItemId },
          _sum: { workingQuantity: true, brokenQuantity: true },
        });
        const alreadyReturned =
          (existingReturns._sum.workingQuantity || 0) +
          (existingReturns._sum.brokenQuantity || 0);
        if (alreadyReturned + workingQuantity + brokenQuantity > deliveryItem.deliveredQuantity) {
          throw httpError(409, "Return exceeds delivered quantity.");
        }

        const createdReturn = await transaction.return.create({
          data: {
            receivedByUserId: BigInt(req.user.sub),
            items: {
              create: {
                deliveryItemId,
                workingQuantity,
                brokenQuantity,
              },
            },
          },
        });
        await writeAuditLog(transaction, {
          actorUserId: BigInt(req.user.sub),
          entityType: "delivery_item",
          entityId: deliveryItemId.toString(),
          action: "DELIVERY_RETURNED",
          afterData: {
            returnId: createdReturn.id.toString(),
            workingQuantity,
            brokenQuantity,
          },
        });
        return createdReturn;
      });

      res.status(201).json({
        id: returned.id.toString(),
        message: "Return recorded successfully.",
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { createInventoryOperationsRouter };
