const express = require("express");
const { requireRoles } = require("../middleware/requireAdmin");

// GET /api/team/custody — everything delivered to the signed-in team that has
// not been returned yet, aggregated across all of the team's requests.
function createTeamRouter(prisma) {
  const router = express.Router();
  router.use(...requireRoles(prisma, "user"));

  router.get("/custody", async (req, res, next) => {
    try {
      const deliveryItems = await prisma.deliveryItem.findMany({
        where: { requestItem: { request: { teamId: BigInt(req.user.teamId) } } },
        include: {
          returnItems: { select: { workingQuantity: true, brokenQuantity: true } },
          delivery: { select: { deliveredAt: true } },
          requestItem: {
            include: {
              component: {
                select: { id: true, name: true, category: true, imageReference: true },
              },
              request: { select: { id: true, projectName: true } },
            },
          },
        },
        orderBy: { id: "asc" },
      });

      const byComponent = new Map();
      const lines = [];
      for (const deliveryItem of deliveryItems) {
        const returnedWorking = deliveryItem.returnItems.reduce((t, r) => t + r.workingQuantity, 0);
        const returnedBroken = deliveryItem.returnItems.reduce((t, r) => t + r.brokenQuantity, 0);
        const outstanding = deliveryItem.deliveredQuantity - returnedWorking - returnedBroken;
        const { component, request } = deliveryItem.requestItem;
        lines.push({
          deliveryItemId: deliveryItem.id.toString(),
          requestId: request.id.toString(),
          projectName: request.projectName,
          deliveredAt: deliveryItem.delivery?.deliveredAt || null,
          componentId: component.id.toString(),
          componentName: component.name,
          category: component.category,
          imageUrl: component.imageReference,
          deliveredQuantity: deliveryItem.deliveredQuantity,
          returnedWorkingQuantity: returnedWorking,
          returnedBrokenQuantity: returnedBroken,
          outstandingQuantity: outstanding,
        });

        const key = component.id.toString();
        const entry = byComponent.get(key) || {
          componentId: key,
          componentName: component.name,
          category: component.category,
          imageUrl: component.imageReference,
          deliveredQuantity: 0,
          returnedWorkingQuantity: 0,
          returnedBrokenQuantity: 0,
          outstandingQuantity: 0,
        };
        entry.deliveredQuantity += deliveryItem.deliveredQuantity;
        entry.returnedWorkingQuantity += returnedWorking;
        entry.returnedBrokenQuantity += returnedBroken;
        entry.outstandingQuantity += outstanding;
        byComponent.set(key, entry);
      }

      const items = [...byComponent.values()];
      const totals = items.reduce(
        (t, item) => ({
          deliveredQuantity: t.deliveredQuantity + item.deliveredQuantity,
          returnedWorkingQuantity: t.returnedWorkingQuantity + item.returnedWorkingQuantity,
          returnedBrokenQuantity: t.returnedBrokenQuantity + item.returnedBrokenQuantity,
          outstandingQuantity: t.outstandingQuantity + item.outstandingQuantity,
        }),
        { deliveredQuantity: 0, returnedWorkingQuantity: 0, returnedBrokenQuantity: 0, outstandingQuantity: 0 },
      );
      res.set("Cache-Control", "no-store");
      res.json({ items, lines, totals, custodyClosed: totals.outstandingQuantity === 0 });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { createTeamRouter };
