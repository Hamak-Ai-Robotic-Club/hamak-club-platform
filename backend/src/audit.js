async function writeAuditLog(prisma, entry) {
  for (const field of ["entityType", "entityId", "action"]) {
    if (typeof entry[field] !== "string" || entry[field].trim() === "") {
      throw new TypeError(`${field} must be a non-empty string.`);
    }
  }

  for (const field of ["beforeData", "afterData", "metadata"]) {
    if (entry[field] !== undefined) {
      assertSafeAuditData(entry[field], field);
    }
  }

  return prisma.auditLog.create({
    data: {
      actorUserId: entry.actorUserId ?? null,
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      beforeData: entry.beforeData ?? undefined,
      afterData: entry.afterData ?? undefined,
      metadata: entry.metadata ?? undefined,
    },
  });
}

function assertSafeAuditData(value, path, ancestors = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return;
  }

  if (value === undefined) {
    throw new TypeError(`${path} must not contain undefined values.`);
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(`${path} contains a non-finite number.`);
    }
    return;
  }

  if (typeof value !== "object") {
    throw new TypeError(`${path} must contain JSON-compatible data only.`);
  }

  if (ancestors.has(value)) {
    throw new TypeError(`${path} must not contain circular references.`);
  }

  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${path} must contain plain JSON objects only.`);
  }

  ancestors.add(value);
  for (const [key, nestedValue] of Object.entries(value)) {
    if (/(password|passwd|secret|token|authorization|cookie)/i.test(key)) {
      throw new TypeError(`${path}.${key} contains a sensitive field that must not be audited.`);
    }
    assertSafeAuditData(nestedValue, `${path}.${key}`, ancestors);
  }
  ancestors.delete(value);
}

module.exports = { writeAuditLog };
