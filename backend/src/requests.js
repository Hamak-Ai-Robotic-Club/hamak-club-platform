async function submitRequest(prisma, input) {
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new TypeError("A submitted request must contain at least one item.");
  }

  for (const [index, item] of input.items.entries()) {
    if (!Number.isSafeInteger(item.requestedQuantity) || item.requestedQuantity <= 0) {
      throw new TypeError(
        `items[${index}].requestedQuantity must be a positive safe integer.`,
      );
    }

    if (item.approvedQuantity !== undefined && item.approvedQuantity !== 0) {
      throw new TypeError("Newly submitted requests must start with zero approved quantity.");
    }
  }

  return prisma.$transaction(async (transaction) => {
    const request = await transaction.request.create({
      data: {
        teamId: input.teamId,
        submittedByUserId: input.submittedByUserId ?? null,
        projectName: input.projectName ?? null,
        projectDescription: input.projectDescription ?? null,
        status: "PENDING",
        submittedAt: null,
        items: {
          create: input.items.map((item) => ({
            componentId: item.componentId,
            requestedQuantity: item.requestedQuantity,
            approvedQuantity: 0,
          })),
        },
      },
    });

    return transaction.request.update({
      where: { id: request.id },
      data: { submittedAt: new Date() },
      include: { items: true },
    });
  });
}

module.exports = { submitRequest };
