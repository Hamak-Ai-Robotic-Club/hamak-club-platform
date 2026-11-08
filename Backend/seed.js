const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL must be set before running the database seed.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const existingDemoComponent = await prisma.component.findFirst({
    where: { name: "Demo: Microcontroller Board", category: "Demo electronics" },
    select: { id: true },
  });

  if (existingDemoComponent) {
    console.info("Synthetic demo fixtures already exist; seed skipped without changes.");
    return;
  }

  await prisma.$transaction(async (transaction) => {
    const user = await transaction.user.create({
      data: { accountType: "DEMO", displayName: "Demo inventory operator" },
    });
    const team = await transaction.team.create({
      data: { name: "Demo Robotics Team" },
    });

    const board = await transaction.component.create({
      data: {
        name: "Demo: Microcontroller Board",
        category: "Demo electronics",
        description: "Synthetic development-only component.",
        workingQuantity: 0,
        brokenQuantity: 0,
        status: "Demo",
      },
    });
    const sensor = await transaction.component.create({
      data: {
        name: "Demo: Distance Sensor",
        category: "Demo sensors",
        description: "Synthetic development-only component.",
        workingQuantity: 0,
        brokenQuantity: 0,
        status: "Demo",
      },
    });

    await transaction.inventoryMovement.createMany({
      data: [
        {
          componentId: board.id,
          actorUserId: user.id,
          movementType: "DEMO_OPENING_BALANCE",
          quantityBucket: "working",
          quantityDelta: 12,
          notes: "Synthetic development seed; not a real stock transaction.",
        },
        {
          componentId: sensor.id,
          actorUserId: user.id,
          movementType: "DEMO_OPENING_BALANCE",
          quantityBucket: "working",
          quantityDelta: 7,
          notes: "Synthetic development seed; not a real stock transaction.",
        },
        {
          componentId: sensor.id,
          actorUserId: user.id,
          movementType: "DEMO_OPENING_BALANCE",
          quantityBucket: "broken",
          quantityDelta: 2,
          notes: "Synthetic development seed; not a real stock transaction.",
        },
      ],
    });

    const pendingRequest = await transaction.request.create({
      data: {
        teamId: team.id,
        submittedByUserId: user.id,
        projectName: "Demo pending request",
        projectDescription: "Synthetic request for development and testing.",
        status: "PENDING",
        items: {
          create: {
            componentId: sensor.id,
            requestedQuantity: 1,
            approvedQuantity: 0,
          },
        },
      },
    });
    await transaction.request.update({
      where: { id: pendingRequest.id },
      data: { submittedAt: new Date() },
    });

    const approvedRequest = await transaction.request.create({
      data: {
        teamId: team.id,
        submittedByUserId: user.id,
        projectName: "Demo delivery request",
        projectDescription: "Synthetic request with a partial delivery and return.",
        status: "PENDING",
        submittedAt: null,
        items: {
          create: {
            componentId: board.id,
            requestedQuantity: 3,
            approvedQuantity: 0,
          },
        },
      },
      include: { items: true },
    });
    await transaction.request.update({
      where: { id: approvedRequest.id },
      data: { submittedAt: new Date() },
    });
    await transaction.requestItem.update({
      where: { id: approvedRequest.items[0].id },
      data: { approvedQuantity: 2 },
    });
    await transaction.request.update({
      where: { id: approvedRequest.id },
      data: {
        status: "APPROVED",
        reviewedByUserId: user.id,
        reviewedAt: new Date(),
      },
    });

    const delivery = await transaction.delivery.create({
      data: {
        requestId: approvedRequest.id,
        deliveredByUserId: user.id,
        items: {
          create: {
            requestId: approvedRequest.id,
            requestItemId: approvedRequest.items[0].id,
            deliveredQuantity: 2,
          },
        },
      },
      include: { items: true },
    });

    await transaction.return.create({
      data: {
        receivedByUserId: user.id,
        items: {
          create: {
            deliveryItemId: delivery.items[0].id,
            workingQuantity: 1,
            brokenQuantity: 0,
          },
        },
      },
    });

    await transaction.auditLog.create({
      data: {
        actorUserId: user.id,
        entityType: "request",
        entityId: approvedRequest.id.toString(),
        action: "DEMO_REVIEW",
        beforeData: { status: "PENDING" },
        afterData: { status: "APPROVED" },
        metadata: { synthetic: true },
      },
    });

    await transaction.hackathonSummary.create({
      data: {
        createdByUserId: user.id,
        title: "Synthetic development summary",
        summaryData: {
          synthetic: true,
          note: "Illustrative snapshot only; not a real hackathon summary.",
          exampleRequestCount: 2,
        },
      },
    });
  });
}

main()
  .catch((error) => {
    console.error("Database seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
