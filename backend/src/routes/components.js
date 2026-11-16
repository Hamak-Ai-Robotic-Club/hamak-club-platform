const express = require("express");
const { saveComponentImage, removeComponentImage } = require("../storage/imageStorage");
const requireAdmin = require("../middleware/requireAdmin");
const uploadComponentImage = require("../middleware/componentUpload");
const { writeAuditLog } = require("../audit");
const httpError = require("../utils/httpError");
const { metaFor } = require("../modules/catalog/catalogMeta");

function isNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function parseId(value, label = "Component id") {
  if (!/^[1-9]\d*$/.test(value)) {
    throw httpError(400, `${label} must be a positive integer.`);
  }
  return BigInt(value);
}

// Built-in catalogue pictures shipped with the frontend (public/components).
const builtInImagePattern = /^\/components\/[a-z0-9-]+\.webp$/;

function parseImageReference(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string" || !builtInImagePattern.test(value)) {
    throw httpError(400, "imageReference must be a built-in catalogue image path.");
  }
  return value;
}

async function reservedQuantityFor(transaction, componentId) {
  const rows = await transaction.$queryRaw`
    SELECT COALESCE(SUM(GREATEST(
      request_items.approved_quantity - COALESCE(delivered.delivered_quantity, 0), 0
    )), 0)::INTEGER AS reserved
    FROM request_items
    JOIN requests ON requests.id = request_items.request_id
    LEFT JOIN (
      SELECT request_item_id, SUM(delivered_quantity)::INTEGER AS delivered_quantity
      FROM delivery_items GROUP BY request_item_id
    ) AS delivered ON delivered.request_item_id = request_items.id
    WHERE requests.status IN ('APPROVED', 'PARTIALLY_DELIVERED')
      AND request_items.component_id = ${componentId}
  `;
  return Number(rows[0]?.reserved || 0);
}

function serializeComponent(component) {
  return {
    id: component.id.toString(),
    name: component.name,
    nameEn: metaFor(component.name)?.en || null,
    category: component.category,
    description: component.description,
    imageUrl: component.imageReference,
    status: component.status,
    workingQuantity: component.workingQuantity,
    brokenQuantity: component.brokenQuantity,
    availableQuantity: component.workingQuantity,
  };
}

async function listCatalog(prisma, { includeInactive = false } = {}) {
  const [components, outstandingItems, reservations] = await Promise.all([
    prisma.component.findMany({
      where: includeInactive ? {} : { status: { not: "inactive" } },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
    prisma.$queryRaw`
      SELECT
        request_items.component_id,
        COALESCE(SUM(
          delivery_items.delivered_quantity -
          COALESCE(returned_items.returned_quantity, 0)
        ), 0)::INTEGER AS outstanding_quantity
      FROM delivery_items
      JOIN request_items ON request_items.id = delivery_items.request_item_id
      LEFT JOIN (
        SELECT
          delivery_item_id,
          SUM(working_quantity + broken_quantity)::INTEGER AS returned_quantity
        FROM return_items
        GROUP BY delivery_item_id
      ) AS returned_items ON returned_items.delivery_item_id = delivery_items.id
      GROUP BY request_items.component_id
    `,
    prisma.$queryRaw`
      SELECT
        request_items.component_id AS component_id,
        SUM(GREATEST(
          request_items.approved_quantity -
          COALESCE(delivered_items.delivered_quantity, 0),
          0
        ))::INTEGER AS reserved_quantity
      FROM request_items
      JOIN requests ON requests.id = request_items.request_id
      LEFT JOIN (
        SELECT request_item_id, SUM(delivered_quantity)::INTEGER AS delivered_quantity
        FROM delivery_items
        GROUP BY request_item_id
      ) AS delivered_items ON delivered_items.request_item_id = request_items.id
      WHERE requests.status IN ('APPROVED', 'PARTIALLY_DELIVERED')
      GROUP BY request_items.component_id
    `,
  ]);
  const outstandingByComponent = new Map(
    outstandingItems.map((item) => [item.component_id.toString(), item.outstanding_quantity]),
  );
  const reservedByComponent = new Map(
    reservations.map((item) => [item.component_id.toString(), item.reserved_quantity]),
  );
  const items = components.map((component) => {
    const onLoanQuantity = outstandingByComponent.get(component.id.toString()) || 0;
    const reservedQuantity = reservedByComponent.get(component.id.toString()) || 0;
    const availableQuantity = Math.max(0, component.workingQuantity - reservedQuantity);
    const availabilityStatus =
      availableQuantity > 3
        ? "AVAILABLE"
        : availableQuantity > 0
          ? "LIMITED"
          : onLoanQuantity > 0
            ? "IN_USE"
            : reservedQuantity > 0
              ? "RESERVED"
              : "UNAVAILABLE";
    return {
      ...serializeComponent(component),
      onLoanQuantity,
      reservedQuantity,
      availableQuantity,
      availabilityStatus,
    };
  });
  return { components, items };
}

function createComponentsRouter(prisma) {
  const router = express.Router();
  const adminOnly = requireAdmin(prisma);

  router.get("/components", async (req, res, next) => {
    try {
      const { components, items } = await listCatalog(prisma);
      res.set("Cache-Control", "no-store");
      res.json({
        items,
        demoData:
          components.length > 0 && components.every((component) => component.status === "Demo"),
      });
    } catch (error) {
      next(error);
    }
  });

  // Admin view of the catalogue: includes disabled components and the full
  // working / broken / reserved / on-loan / available breakdown.
  router.get("/admin/components", adminOnly, async (req, res, next) => {
    try {
      const { items } = await listCatalog(prisma, { includeInactive: true });
      res.set("Cache-Control", "no-store");
      res.json({ items });
    } catch (error) {
      next(error);
    }
  });

  router.post("/components", adminOnly, async (req, res, next) => {
    try {
      const {
        name,
        category,
        description = null,
        status = "active",
        workingQuantity = 0,
        brokenQuantity = 0,
        imageReference,
      } = req.body || {};
      const builtInImage = parseImageReference(imageReference);

      if (
        typeof name !== "string" ||
        !name.trim() ||
        typeof category !== "string" ||
        !category.trim() ||
        (typeof description !== "string" && description !== null) ||
        typeof status !== "string" ||
        !status.trim() ||
        !isNonNegativeInteger(workingQuantity) ||
        !isNonNegativeInteger(brokenQuantity)
      ) {
        throw httpError(400, "name, category, valid quantities, and status are required.");
      }

      const component = await prisma.$transaction(async (transaction) => {
        const created = await transaction.component.create({
          data: {
            name: name.trim(),
            category: category.trim(),
            description: description ? description.trim() : null,
            status: status.trim(),
            imageReference: builtInImage || null,
            workingQuantity: 0,
            brokenQuantity: 0,
          },
        });

        for (const [quantityBucket, quantityDelta] of [
          ["working", workingQuantity],
          ["broken", brokenQuantity],
        ]) {
          if (quantityDelta > 0) {
            await transaction.inventoryMovement.create({
              data: {
                componentId: created.id,
                actorUserId: BigInt(req.user.sub),
                movementType: "INITIAL_STOCK",
                quantityBucket,
                quantityDelta,
                notes: "Initial stock entered when the component was created.",
              },
            });
          }
        }

        const item = await transaction.component.findUniqueOrThrow({ where: { id: created.id } });
        await writeAuditLog(transaction, {
          actorUserId: BigInt(req.user.sub),
          entityType: "component",
          entityId: item.id.toString(),
          action: "COMPONENT_CREATED",
          afterData: {
            name: item.name,
            category: item.category,
            status: item.status,
            workingQuantity: item.workingQuantity,
            brokenQuantity: item.brokenQuantity,
          },
        });
        return item;
      });

      res.status(201).json({ item: serializeComponent(component) });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/components/:id", adminOnly, async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      const allowed = [
        "name",
        "category",
        "description",
        "status",
        "workingQuantity",
        "brokenQuantity",
        "imageReference",
      ];
      const body = req.body || {};
      const unknownFields = Object.keys(body).filter((field) => !allowed.includes(field));
      if (unknownFields.length) {
        throw httpError(400, `Unknown fields: ${unknownFields.join(", ")}`);
      }

      const data = {};
      if (body.name !== undefined) {
        if (typeof body.name !== "string" || !body.name.trim()) {
          throw httpError(400, "name must be a non-empty string.");
        }
        data.name = body.name.trim();
      }
      if (body.category !== undefined) {
        if (typeof body.category !== "string" || !body.category.trim()) {
          throw httpError(400, "category must be a non-empty string.");
        }
        data.category = body.category.trim();
      }
      if (body.description !== undefined) {
        if (
          body.description !== null &&
          (typeof body.description !== "string" || !body.description.trim())
        ) {
          throw httpError(400, "description must be a string or null.");
        }
        data.description = body.description ? body.description.trim() : null;
      }
      if (body.status !== undefined) {
        if (typeof body.status !== "string" || !body.status.trim()) {
          throw httpError(400, "status must be a non-empty string.");
        }
        data.status = body.status.trim();
      }
      if (body.imageReference !== undefined) {
        data.imageReference = parseImageReference(body.imageReference);
      }
      for (const field of ["workingQuantity", "brokenQuantity"]) {
        if (body[field] !== undefined && !isNonNegativeInteger(body[field])) {
          throw httpError(400, `${field} must be a non-negative safe integer.`);
        }
      }
      if (!Object.keys(data).length && body.workingQuantity === undefined &&
          body.brokenQuantity === undefined) {
        throw httpError(400, "At least one field must be provided.");
      }

      const component = await prisma.$transaction(async (transaction) => {
        await transaction.$queryRaw`SELECT "id" FROM "components" WHERE "id" = ${id} FOR UPDATE`;
        const current = await transaction.component.findUnique({ where: { id } });
        if (!current) throw httpError(404, "Component not found.");
        if (body.workingQuantity !== undefined) {
          const reserved = await reservedQuantityFor(transaction, id);
          if (body.workingQuantity < reserved) {
            throw httpError(
              409,
              `Working quantity cannot be lower than the reserved quantity (${reserved}).`,
            );
          }
        }

        for (const [field, quantityBucket] of [
          ["workingQuantity", "working"],
          ["brokenQuantity", "broken"],
        ]) {
          if (body[field] !== undefined) {
            const quantityDelta = body[field] - current[field];
            if (quantityDelta !== 0) {
              await transaction.inventoryMovement.create({
                data: {
                  componentId: id,
                  actorUserId: BigInt(req.user.sub),
                  movementType: "MANUAL_ADJUSTMENT",
                  quantityBucket,
                  quantityDelta,
                  notes: `Component quantity set to ${body[field]}.`,
                },
              });
            }
          }
        }

        if (Object.keys(data).length) {
          await transaction.component.update({ where: { id }, data });
        }
        const updated = await transaction.component.findUniqueOrThrow({ where: { id } });
        await writeAuditLog(transaction, {
          actorUserId: BigInt(req.user.sub),
          entityType: "component",
          entityId: id.toString(),
          action: "COMPONENT_UPDATED",
          beforeData: {
            name: current.name,
            category: current.category,
            status: current.status,
            workingQuantity: current.workingQuantity,
            brokenQuantity: current.brokenQuantity,
          },
          afterData: {
            name: updated.name,
            category: updated.category,
            status: updated.status,
            workingQuantity: updated.workingQuantity,
            brokenQuantity: updated.brokenQuantity,
          },
        });
        return updated;
      });

      res.json({ item: serializeComponent(component) });
    } catch (error) {
      next(error);
    }
  });

  // Hard delete only when the component has no history (no request items and
  // no inventory movements); otherwise it is disabled to keep reports intact.
  router.delete("/components/:id", adminOnly, async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      const result = await prisma.$transaction(async (transaction) => {
        const before = await transaction.component.findUnique({ where: { id } });
        if (!before) throw httpError(404, "Component not found.");
        const [requestItems, movements] = await Promise.all([
          transaction.requestItem.count({ where: { componentId: id } }),
          transaction.inventoryMovement.count({ where: { componentId: id } }),
        ]);
        if (requestItems === 0 && movements === 0) {
          await transaction.component.delete({ where: { id } });
          await writeAuditLog(transaction, {
            actorUserId: BigInt(req.user.sub),
            entityType: "component",
            entityId: id.toString(),
            action: "COMPONENT_DELETED",
            beforeData: { name: before.name, category: before.category, status: before.status },
          });
          return { deleted: true, item: before };
        }
        const updated = await transaction.component.update({
          where: { id },
          data: { status: "inactive" },
        });
        await writeAuditLog(transaction, {
          actorUserId: BigInt(req.user.sub),
          entityType: "component",
          entityId: id.toString(),
          action: "COMPONENT_DISABLED",
          beforeData: { status: before.status },
          afterData: { status: updated.status },
        });
        return { deleted: false, item: updated };
      });
      if (result.deleted) await removeComponentImage(result.item.imageReference);
      res.json({ deleted: result.deleted, disabled: !result.deleted, item: serializeComponent(result.item) });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/components/:id/image",
    adminOnly,
    (req, res, next) => {
      try {
        parseId(req.params.id);
        next();
      } catch (error) {
        next(error);
      }
    },
    uploadComponentImage,
    async (req, res, next) => {
      try {
        if (!req.file) throw httpError(400, "A WEBP image is required in the image field.");

        const id = parseId(req.params.id);
        const exists = await prisma.component.findUnique({ where: { id }, select: { id: true } });
        if (!exists) throw httpError(404, "Component not found.");
        const imageReference = await saveComponentImage(req.file.buffer, req.file.filename);
        let previous;
        let updated;
        try {
          ({ previous, updated } = await prisma.$transaction(async (transaction) => {
            const current = await transaction.component.findUnique({ where: { id } });
            if (!current) throw httpError(404, "Component not found.");
            const saved = await transaction.component.update({
              where: { id },
              data: { imageReference },
            });
            await writeAuditLog(transaction, {
              actorUserId: BigInt(req.user.sub),
              entityType: "component",
              entityId: id.toString(),
              action: "COMPONENT_IMAGE_UPDATED",
              beforeData: { imageReference: current.imageReference },
              afterData: { imageReference },
            });
            return { previous: current, updated: saved };
          }));
        } catch (error) {
          await removeComponentImage(imageReference);
          throw error;
        }
        await removeComponentImage(previous.imageReference);
        res.json({ item: serializeComponent(updated) });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}

module.exports = { createComponentsRouter, listCatalog };
