const VALID_BUCKETS = new Set(["working", "broken"]);

async function recordInventoryMovement(prisma, movement) {
  if (!VALID_BUCKETS.has(movement.quantityBucket)) {
    throw new TypeError("quantityBucket must be 'working' or 'broken'.");
  }

  if (!Number.isSafeInteger(movement.quantityDelta) || movement.quantityDelta === 0) {
    throw new TypeError("quantityDelta must be a non-zero safe integer.");
  }

  if (typeof movement.movementType !== "string" || movement.movementType.trim() === "") {
    throw new TypeError("movementType must be a non-empty string.");
  }

  return prisma.inventoryMovement.create({
    data: {
      componentId: movement.componentId,
      actorUserId: movement.actorUserId ?? null,
      movementType: movement.movementType,
      quantityBucket: movement.quantityBucket,
      quantityDelta: movement.quantityDelta,
      notes: movement.notes ?? null,
    },
  });
}

module.exports = { recordInventoryMovement };
