async function getInventoryReport(prisma) {
  const components = await prisma.component.findMany({
    select: {
      id: true,
      name: true,
      category: true,
      status: true,
      workingQuantity: true,
      brokenQuantity: true,
    },
    orderBy: { id: "asc" },
  });

  const items = components.map((component) => ({
    ...component,
    recordedQuantity: component.workingQuantity + component.brokenQuantity,
  }));

  return {
    items,
    totals: items.reduce(
      (totals, item) => ({
        workingQuantity: totals.workingQuantity + item.workingQuantity,
        brokenQuantity: totals.brokenQuantity + item.brokenQuantity,
        recordedQuantity: totals.recordedQuantity + item.recordedQuantity,
      }),
      { workingQuantity: 0, brokenQuantity: 0, recordedQuantity: 0 },
    ),
  };
}

async function getMovementReport(prisma, filters = {}) {
  const where = {};

  const dateRange = createDateRange(filters.from, filters.to);

  if (filters.componentId !== undefined) {
    where.componentId = filters.componentId;
  }

  if (dateRange) {
    where.occurredAt = dateRange;
  }

  return prisma.inventoryMovement.findMany({
    where,
    include: {
      component: {
        select: { id: true, name: true, category: true },
      },
    },
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
  });
}

async function getRequestStatistics(prisma, filters = {}) {
  const dateRange = createDateRange(filters.from, filters.to);
  const where = dateRange
    ? { submittedAt: dateRange }
    : { submittedAt: { not: null } };
  const groups = await prisma.request.groupBy({
    by: ["status"],
    where,
    _count: { _all: true },
  });
  const byStatus = groups
    .map(({ status, _count }) => ({ status, count: _count._all }))
    .sort((left, right) => left.status.localeCompare(right.status));

  return {
    total: byStatus.reduce((total, group) => total + group.count, 0),
    byStatus,
  };
}

async function getMovementStatistics(prisma, filters = {}) {
  const where = {};
  const dateRange = createDateRange(filters.from, filters.to);

  if (filters.componentId !== undefined) {
    where.componentId = filters.componentId;
  }
  if (dateRange) {
    where.occurredAt = dateRange;
  }

  const groups = await prisma.inventoryMovement.groupBy({
    by: ["movementType", "quantityBucket"],
    where,
    _count: { _all: true },
    _sum: { quantityDelta: true },
  });

  return groups
    .map(({ movementType, quantityBucket, _count, _sum }) => ({
      movementType,
      quantityBucket,
      count: _count._all,
      netQuantityDelta: _sum.quantityDelta ?? 0,
    }))
    .sort(
      (left, right) =>
        left.movementType.localeCompare(right.movementType) ||
        left.quantityBucket.localeCompare(right.quantityBucket),
    );
}

async function getCustodyReport(prisma) {
  const deliveryItems = await prisma.deliveryItem.findMany({
    select: {
      id: true,
      deliveredQuantity: true,
      requestItem: {
        select: {
          component: {
            select: { id: true, name: true, category: true },
          },
          request: {
            select: {
              id: true,
              team: { select: { id: true, name: true } },
            },
          },
        },
      },
      returnItems: {
        select: { workingQuantity: true, brokenQuantity: true },
      },
    },
    orderBy: { id: "asc" },
  });

  const items = deliveryItems.map((deliveryItem) => {
    const returnedWorkingQuantity = deliveryItem.returnItems.reduce(
      (total, item) => total + item.workingQuantity,
      0,
    );
    const returnedBrokenQuantity = deliveryItem.returnItems.reduce(
      (total, item) => total + item.brokenQuantity,
      0,
    );

    return {
      deliveryItemId: deliveryItem.id,
      requestId: deliveryItem.requestItem.request.id,
      team: deliveryItem.requestItem.request.team,
      component: deliveryItem.requestItem.component,
      deliveredQuantity: deliveryItem.deliveredQuantity,
      returnedWorkingQuantity,
      returnedBrokenQuantity,
      outstandingQuantity:
        deliveryItem.deliveredQuantity -
        returnedWorkingQuantity -
        returnedBrokenQuantity,
    };
  });

  const totals = items.reduce(
    (current, item) => ({
      deliveredQuantity: current.deliveredQuantity + item.deliveredQuantity,
      returnedWorkingQuantity:
        current.returnedWorkingQuantity + item.returnedWorkingQuantity,
      returnedBrokenQuantity:
        current.returnedBrokenQuantity + item.returnedBrokenQuantity,
      outstandingQuantity:
        current.outstandingQuantity + item.outstandingQuantity,
    }),
    {
      deliveredQuantity: 0,
      returnedWorkingQuantity: 0,
      returnedBrokenQuantity: 0,
      outstandingQuantity: 0,
    },
  );

  return { items: items.filter((item) => item.outstandingQuantity > 0), totals };
}

async function getDashboardStatistics(prisma, filters = {}) {
  const [
    componentCount,
    inventory,
    movementCount,
    movementsByType,
    requests,
    custody,
  ] =
    await Promise.all([
      prisma.component.count(),
      prisma.component.aggregate({
        _sum: { workingQuantity: true, brokenQuantity: true },
      }),
      prisma.inventoryMovement.count(),
      getMovementStatistics(prisma, filters),
      getRequestStatistics(prisma, filters),
      getCustodyReport(prisma),
    ]);

  return {
    componentCount,
    inventory: {
      workingQuantity: inventory._sum.workingQuantity ?? 0,
      brokenQuantity: inventory._sum.brokenQuantity ?? 0,
    },
    movementCount,
    movementsByType,
    requests,
    custody: custody.totals,
  };
}

function createDateRange(from, to) {
  if (from === undefined && to === undefined) {
    return undefined;
  }

  for (const [label, value] of [
    ["from", from],
    ["to", to],
  ]) {
    if (
      value !== undefined &&
      (!(value instanceof Date) || Number.isNaN(value.getTime()))
    ) {
      throw new TypeError(`${label} must be a valid Date.`);
    }
  }

  if (from && to && from > to) {
    throw new RangeError("The from date must not be later than the to date.");
  }

  return {
    ...(from ? { gte: from } : {}),
    ...(to ? { lte: to } : {}),
  };
}

module.exports = {
  getInventoryReport,
  getMovementReport,
  getRequestStatistics,
  getMovementStatistics,
  getCustodyReport,
  getDashboardStatistics,
};
