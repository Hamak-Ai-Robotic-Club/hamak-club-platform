-- AlterTable
ALTER TABLE "inventory_movements" ADD COLUMN     "actor_user_id" BIGINT,
ADD COLUMN     "delivery_item_id" BIGINT,
ADD COLUMN     "return_item_id" BIGINT;

-- CreateTable
CREATE TABLE "users" (
    "id" BIGSERIAL NOT NULL,
    "account_type" TEXT,
    "display_name" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requests" (
    "id" BIGSERIAL NOT NULL,
    "team_id" BIGINT NOT NULL,
    "submitted_by_user_id" BIGINT,
    "reviewed_by_user_id" BIGINT,
    "project_name" TEXT,
    "project_description" TEXT,
    "status" TEXT NOT NULL,
    "submitted_at" TIMESTAMPTZ(6),
    "reviewed_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),

    CONSTRAINT "requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_items" (
    "id" BIGSERIAL NOT NULL,
    "request_id" BIGINT NOT NULL,
    "component_id" BIGINT NOT NULL,
    "requested_quantity" INTEGER NOT NULL,
    "approved_quantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "request_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliveries" (
    "id" BIGSERIAL NOT NULL,
    "request_id" BIGINT NOT NULL,
    "delivered_by_user_id" BIGINT,
    "delivered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_items" (
    "id" BIGSERIAL NOT NULL,
    "delivery_id" BIGINT NOT NULL,
    "request_id" BIGINT NOT NULL,
    "request_item_id" BIGINT NOT NULL,
    "delivered_quantity" INTEGER NOT NULL,

    CONSTRAINT "delivery_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "returns" (
    "id" BIGSERIAL NOT NULL,
    "received_by_user_id" BIGINT,
    "returned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_items" (
    "id" BIGSERIAL NOT NULL,
    "return_id" BIGINT NOT NULL,
    "delivery_item_id" BIGINT NOT NULL,
    "working_quantity" INTEGER NOT NULL,
    "broken_quantity" INTEGER NOT NULL,

    CONSTRAINT "return_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "actor_user_id" BIGINT,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before_data" JSONB,
    "after_data" JSONB,
    "metadata" JSONB,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hackathon_summaries" (
    "id" BIGSERIAL NOT NULL,
    "created_by_user_id" BIGINT,
    "title" TEXT,
    "summary_data" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hackathon_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_expires_at_idx" ON "sessions"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "requests_team_id_submitted_at_idx" ON "requests"("team_id", "submitted_at");

-- CreateIndex
CREATE INDEX "requests_status_submitted_at_idx" ON "requests"("status", "submitted_at");

-- CreateIndex
CREATE INDEX "request_items_request_id_idx" ON "request_items"("request_id");

-- CreateIndex
CREATE INDEX "request_items_component_id_idx" ON "request_items"("component_id");

-- CreateIndex
CREATE UNIQUE INDEX "request_items_id_request_id_key" ON "request_items"("id", "request_id");

-- CreateIndex
CREATE INDEX "deliveries_request_id_delivered_at_idx" ON "deliveries"("request_id", "delivered_at");

-- CreateIndex
CREATE UNIQUE INDEX "deliveries_id_request_id_key" ON "deliveries"("id", "request_id");

-- CreateIndex
CREATE INDEX "delivery_items_delivery_id_idx" ON "delivery_items"("delivery_id");

-- CreateIndex
CREATE INDEX "delivery_items_request_item_id_idx" ON "delivery_items"("request_item_id");

-- CreateIndex
CREATE INDEX "returns_returned_at_idx" ON "returns"("returned_at");

-- CreateIndex
CREATE INDEX "return_items_return_id_idx" ON "return_items"("return_id");

-- CreateIndex
CREATE INDEX "return_items_delivery_item_id_idx" ON "return_items"("delivery_item_id");

-- CreateIndex
CREATE INDEX "audit_logs_occurred_at_idx" ON "audit_logs"("occurred_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_occurred_at_idx" ON "audit_logs"("entity_type", "entity_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_occurred_at_idx" ON "audit_logs"("actor_user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "hackathon_summaries_created_at_idx" ON "hackathon_summaries"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_movements_delivery_item_id_key" ON "inventory_movements"("delivery_item_id");

-- CreateIndex
CREATE INDEX "inventory_movements_actor_user_id_occurred_at_idx" ON "inventory_movements"("actor_user_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_movements_return_item_id_quantity_bucket_key" ON "inventory_movements"("return_item_id", "quantity_bucket");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_submitted_by_user_id_fkey" FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_items" ADD CONSTRAINT "request_items_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_items" ADD CONSTRAINT "request_items_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_delivered_by_user_id_fkey" FOREIGN KEY ("delivered_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_items" ADD CONSTRAINT "delivery_items_delivery_id_request_id_fkey" FOREIGN KEY ("delivery_id", "request_id") REFERENCES "deliveries"("id", "request_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_items" ADD CONSTRAINT "delivery_items_request_item_id_request_id_fkey" FOREIGN KEY ("request_item_id", "request_id") REFERENCES "request_items"("id", "request_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_received_by_user_id_fkey" FOREIGN KEY ("received_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "returns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_delivery_item_id_fkey" FOREIGN KEY ("delivery_item_id") REFERENCES "delivery_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_delivery_item_id_fkey" FOREIGN KEY ("delivery_item_id") REFERENCES "delivery_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_return_item_id_fkey" FOREIGN KEY ("return_item_id") REFERENCES "return_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hackathon_summaries" ADD CONSTRAINT "hackathon_summaries_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Check row-local quantities and session validity.
ALTER TABLE "sessions"
ADD CONSTRAINT "sessions_expiry_after_creation"
CHECK ("expires_at" > "created_at");

ALTER TABLE "request_items"
ADD CONSTRAINT "request_items_quantities_valid"
CHECK (
    "requested_quantity" > 0
    AND "approved_quantity" >= 0
    AND "approved_quantity" <= "requested_quantity"
);

ALTER TABLE "delivery_items"
ADD CONSTRAINT "delivery_items_quantity_positive"
CHECK ("delivered_quantity" > 0);

ALTER TABLE "return_items"
ADD CONSTRAINT "return_items_quantities_valid"
CHECK (
    "working_quantity" >= 0
    AND "broken_quantity" >= 0
    AND "working_quantity" + "broken_quantity" > 0
);

ALTER TABLE "inventory_movements"
ADD CONSTRAINT "inventory_movements_bucket_valid"
CHECK ("quantity_bucket" IN ('working', 'broken'));

ALTER TABLE "inventory_movements"
ADD CONSTRAINT "inventory_movements_delta_nonzero"
CHECK ("quantity_delta" <> 0);

ALTER TABLE "inventory_movements"
ADD CONSTRAINT "inventory_movements_single_source"
CHECK (
    "delivery_item_id" IS NULL
    OR "return_item_id" IS NULL
);

-- One pending request per team; status values other than the confirmed PENDING
-- state remain unconstrained.
CREATE UNIQUE INDEX "requests_one_pending_per_team_key"
ON "requests" ("team_id")
WHERE "status" = 'PENDING' AND "submitted_at" IS NOT NULL;

CREATE FUNCTION prevent_submitted_request_content_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD."submitted_at" IS NOT NULL AND (
        NEW."team_id" IS DISTINCT FROM OLD."team_id"
        OR NEW."submitted_by_user_id" IS DISTINCT FROM OLD."submitted_by_user_id"
        OR NEW."project_name" IS DISTINCT FROM OLD."project_name"
        OR NEW."project_description" IS DISTINCT FROM OLD."project_description"
        OR NEW."submitted_at" IS DISTINCT FROM OLD."submitted_at"
    ) THEN
        RAISE EXCEPTION 'Submitted request content is immutable'
            USING ERRCODE = 'restrict_violation';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "requests_submitted_content_immutable"
BEFORE UPDATE ON "requests"
FOR EACH ROW
EXECUTE FUNCTION prevent_submitted_request_content_changes();

CREATE FUNCTION validate_request_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW."submitted_at" IS NOT NULL THEN
            RAISE EXCEPTION 'Create request content first, then submit it in the same transaction'
                USING ERRCODE = 'restrict_violation';
        END IF;
        RETURN NEW;
    END IF;

    IF OLD."submitted_at" IS NULL AND NEW."submitted_at" IS NOT NULL THEN
        IF NEW."status" <> 'PENDING' THEN
            RAISE EXCEPTION 'A submitted request must enter the confirmed PENDING state'
                USING ERRCODE = 'check_violation';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM "request_items" WHERE "request_id" = NEW."id"
        ) THEN
            RAISE EXCEPTION 'A submitted request must contain at least one item'
                USING ERRCODE = 'check_violation';
        END IF;

        IF EXISTS (
            SELECT 1
            FROM "request_items"
            WHERE "request_id" = NEW."id"
              AND "approved_quantity" <> 0
        ) THEN
            RAISE EXCEPTION 'Newly submitted requests must start with zero approved quantity'
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "requests_submission_guard"
BEFORE INSERT OR UPDATE ON "requests"
FOR EACH ROW
EXECUTE FUNCTION validate_request_submission();

CREATE FUNCTION guard_request_item_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_submitted_at TIMESTAMPTZ(6);
    v_status TEXT;
    v_delivered_quantity BIGINT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT "submitted_at"
        INTO v_submitted_at
        FROM "requests"
        WHERE "id" = NEW.request_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Request item must refer to an existing request'
                USING ERRCODE = 'foreign_key_violation';
        END IF;

        IF v_submitted_at IS NOT NULL THEN
            RAISE EXCEPTION 'Request items cannot be added after submission'
                USING ERRCODE = 'restrict_violation';
        END IF;

        RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' THEN
        SELECT "submitted_at"
        INTO v_submitted_at
        FROM "requests"
        WHERE "id" = OLD.request_id
        FOR UPDATE;

        IF v_submitted_at IS NOT NULL THEN
            RAISE EXCEPTION 'Submitted request items cannot be deleted'
                USING ERRCODE = 'restrict_violation';
        END IF;

        RETURN OLD;
    END IF;

    IF NEW."request_id" IS DISTINCT FROM OLD."request_id"
        OR NEW."component_id" IS DISTINCT FROM OLD."component_id"
        OR NEW."requested_quantity" IS DISTINCT FROM OLD."requested_quantity" THEN
        RAISE EXCEPTION 'Submitted request item content is immutable'
            USING ERRCODE = 'restrict_violation';
    END IF;

    IF NEW."approved_quantity" IS DISTINCT FROM OLD."approved_quantity" THEN
        SELECT "submitted_at", "status"
        INTO v_submitted_at, v_status
        FROM "requests"
        WHERE "id" = OLD.request_id
        FOR UPDATE;

        IF v_submitted_at IS NULL OR v_status <> 'PENDING' THEN
            RAISE EXCEPTION 'Approval quantities can only change while a submitted request is pending'
                USING ERRCODE = 'restrict_violation';
        END IF;

        SELECT COALESCE(SUM("delivered_quantity"), 0)
        INTO v_delivered_quantity
        FROM "delivery_items"
        WHERE "request_item_id" = OLD.id;

        IF NEW."approved_quantity" < v_delivered_quantity THEN
            RAISE EXCEPTION 'Approved quantity cannot be lower than the quantity already delivered'
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "request_items_guard_insert"
BEFORE INSERT ON "request_items"
FOR EACH ROW
EXECUTE FUNCTION guard_request_item_changes();

CREATE TRIGGER "request_items_guard_update"
BEFORE UPDATE ON "request_items"
FOR EACH ROW
EXECUTE FUNCTION guard_request_item_changes();

CREATE TRIGGER "request_items_guard_delete"
BEFORE DELETE ON "request_items"
FOR EACH ROW
EXECUTE FUNCTION guard_request_item_changes();

CREATE FUNCTION apply_inventory_movement_to_component()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    updated_component_id BIGINT;
    v_source_component_id BIGINT;
    v_source_quantity INTEGER;
BEGIN
    IF NEW.delivery_item_id IS NOT NULL THEN
        SELECT "request_items"."component_id", "delivery_items"."delivered_quantity"
        INTO v_source_component_id, v_source_quantity
        FROM "delivery_items"
        JOIN "request_items" ON "request_items"."id" = "delivery_items"."request_item_id"
        WHERE "delivery_items"."id" = NEW.delivery_item_id;

        IF v_source_component_id IS DISTINCT FROM NEW.component_id
            OR NEW.quantity_bucket <> 'working'
            OR NEW.quantity_delta <> -v_source_quantity THEN
            RAISE EXCEPTION 'Delivery movement must match its source component, bucket, and quantity'
                USING ERRCODE = 'check_violation';
        END IF;
    ELSIF NEW.return_item_id IS NOT NULL THEN
        SELECT
            "request_items"."component_id",
            CASE
                WHEN NEW.quantity_bucket = 'working' THEN "return_items"."working_quantity"
                ELSE "return_items"."broken_quantity"
            END
        INTO v_source_component_id, v_source_quantity
        FROM "return_items"
        JOIN "delivery_items" ON "delivery_items"."id" = "return_items"."delivery_item_id"
        JOIN "request_items" ON "request_items"."id" = "delivery_items"."request_item_id"
        WHERE "return_items"."id" = NEW.return_item_id;

        IF v_source_component_id IS DISTINCT FROM NEW.component_id
            OR v_source_quantity IS NULL
            OR v_source_quantity <= 0
            OR NEW.quantity_delta <> v_source_quantity THEN
            RAISE EXCEPTION 'Return movement must match its source component, bucket, and quantity'
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    IF NEW.quantity_bucket = 'working' THEN
        UPDATE "components"
        SET "working_quantity" = "working_quantity" + NEW.quantity_delta
        WHERE "id" = NEW.component_id
          AND "working_quantity" + NEW.quantity_delta >= 0
        RETURNING "id" INTO updated_component_id;
    ELSE
        UPDATE "components"
        SET "broken_quantity" = "broken_quantity" + NEW.quantity_delta
        WHERE "id" = NEW.component_id
          AND "broken_quantity" + NEW.quantity_delta >= 0
        RETURNING "id" INTO updated_component_id;
    END IF;

    IF updated_component_id IS NULL THEN
        RAISE EXCEPTION 'Inventory movement would make the component balance negative or component does not exist'
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "inventory_movements_apply_balance"
BEFORE INSERT ON "inventory_movements"
FOR EACH ROW
EXECUTE FUNCTION apply_inventory_movement_to_component();

CREATE FUNCTION prevent_inventory_movement_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Inventory movements are append-only; record a corrective movement instead'
        USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "inventory_movements_append_only"
BEFORE UPDATE OR DELETE ON "inventory_movements"
FOR EACH ROW
EXECUTE FUNCTION prevent_inventory_movement_mutation();

CREATE FUNCTION validate_delivery_item()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_approved_quantity INTEGER;
    already_delivered BIGINT;
BEGIN
    SELECT "request_items"."approved_quantity"
    INTO v_approved_quantity
    FROM "request_items"
    WHERE "id" = NEW.request_item_id
      AND "request_id" = NEW.request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Delivery item must refer to a request item in the same request'
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    SELECT COALESCE(SUM("delivered_quantity"), 0)
    INTO already_delivered
    FROM "delivery_items"
    WHERE "request_item_id" = NEW.request_item_id;

    IF already_delivered + NEW.delivered_quantity > v_approved_quantity THEN
        RAISE EXCEPTION 'Delivery quantity exceeds the approved quantity for the request item'
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$;

CREATE FUNCTION record_delivery_item_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_component_id BIGINT;
    actor_user_id BIGINT;
BEGIN
    SELECT "request_items"."component_id"
    INTO v_component_id
    FROM "request_items"
    WHERE "request_items"."id" = NEW.request_item_id;

    SELECT "delivered_by_user_id"
    INTO actor_user_id
    FROM "deliveries"
    WHERE "id" = NEW.delivery_id;

    INSERT INTO "inventory_movements" (
        "component_id",
        "actor_user_id",
        "delivery_item_id",
        "movement_type",
        "quantity_bucket",
        "quantity_delta",
        "notes"
    )
    VALUES (
        v_component_id,
        actor_user_id,
        NEW.id,
        'DELIVERY',
        'working',
        -NEW.delivered_quantity,
        'Generated from delivery item'
    );

    RETURN NEW;
END;
$$;

CREATE TRIGGER "delivery_items_validate_quantity"
BEFORE INSERT ON "delivery_items"
FOR EACH ROW
EXECUTE FUNCTION validate_delivery_item();

CREATE TRIGGER "delivery_items_record_movement"
AFTER INSERT ON "delivery_items"
FOR EACH ROW
EXECUTE FUNCTION record_delivery_item_movement();

CREATE FUNCTION validate_return_item()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_delivered_quantity INTEGER;
    already_returned BIGINT;
BEGIN
    SELECT "delivery_items"."delivered_quantity"
    INTO v_delivered_quantity
    FROM "delivery_items"
    WHERE "id" = NEW.delivery_item_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Return item must refer to an existing delivery item'
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    SELECT COALESCE(SUM("working_quantity" + "broken_quantity"), 0)
    INTO already_returned
    FROM "return_items"
    WHERE "delivery_item_id" = NEW.delivery_item_id;

    IF already_returned + NEW.working_quantity + NEW.broken_quantity > v_delivered_quantity THEN
        RAISE EXCEPTION 'Returned quantity exceeds the delivered quantity for the delivery item'
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$;

CREATE FUNCTION record_return_item_movements()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_component_id BIGINT;
    actor_user_id BIGINT;
BEGIN
    SELECT "ri"."component_id"
    INTO v_component_id
    FROM "delivery_items" AS "di"
    JOIN "request_items" AS "ri" ON "ri"."id" = "di"."request_item_id"
    WHERE "di"."id" = NEW.delivery_item_id;

    SELECT "received_by_user_id"
    INTO actor_user_id
    FROM "returns"
    WHERE "id" = NEW.return_id;

    IF NEW.working_quantity > 0 THEN
        INSERT INTO "inventory_movements" (
            "component_id",
            "actor_user_id",
            "return_item_id",
            "movement_type",
            "quantity_bucket",
            "quantity_delta",
            "notes"
        )
        VALUES (
            v_component_id,
            actor_user_id,
            NEW.id,
            'RETURN_WORKING',
            'working',
            NEW.working_quantity,
            'Generated from return item'
        );
    END IF;

    IF NEW.broken_quantity > 0 THEN
        INSERT INTO "inventory_movements" (
            "component_id",
            "actor_user_id",
            "return_item_id",
            "movement_type",
            "quantity_bucket",
            "quantity_delta",
            "notes"
        )
        VALUES (
            v_component_id,
            actor_user_id,
            NEW.id,
            'RETURN_BROKEN',
            'broken',
            NEW.broken_quantity,
            'Generated from return item'
        );
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "return_items_validate_quantity"
BEFORE INSERT ON "return_items"
FOR EACH ROW
EXECUTE FUNCTION validate_return_item();

CREATE TRIGGER "return_items_record_movements"
AFTER INSERT ON "return_items"
FOR EACH ROW
EXECUTE FUNCTION record_return_item_movements();

CREATE FUNCTION prevent_transaction_item_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Delivery and return items are append-only'
        USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "delivery_items_append_only"
BEFORE UPDATE OR DELETE ON "delivery_items"
FOR EACH ROW
EXECUTE FUNCTION prevent_transaction_item_mutation();

CREATE TRIGGER "return_items_append_only"
BEFORE UPDATE OR DELETE ON "return_items"
FOR EACH ROW
EXECUTE FUNCTION prevent_transaction_item_mutation();

CREATE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs and archived summaries are append-only'
        USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "audit_logs_append_only"
BEFORE UPDATE OR DELETE ON "audit_logs"
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_mutation();

CREATE TRIGGER "hackathon_summaries_append_only"
BEFORE UPDATE OR DELETE ON "hackathon_summaries"
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_mutation();

CREATE FUNCTION prevent_request_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Requests are historical records; change their status instead of deleting them'
        USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "requests_no_delete"
BEFORE DELETE ON "requests"
FOR EACH ROW
EXECUTE FUNCTION prevent_request_deletion();

CREATE FUNCTION prevent_delivery_return_header_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Delivery and return records are historical and cannot be changed or deleted'
        USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "deliveries_append_only"
BEFORE UPDATE OR DELETE ON "deliveries"
FOR EACH ROW
EXECUTE FUNCTION prevent_delivery_return_header_mutation();

CREATE TRIGGER "returns_append_only"
BEFORE UPDATE OR DELETE ON "returns"
FOR EACH ROW
EXECUTE FUNCTION prevent_delivery_return_header_mutation();
