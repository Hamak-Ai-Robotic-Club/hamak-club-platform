ALTER TABLE "users"
    ADD COLUMN "username" TEXT,
    ADD COLUMN "password_hash" TEXT,
    ADD COLUMN "team_id" BIGINT;

CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX "users_username_lower_key" ON "users"(lower("username"));
CREATE UNIQUE INDEX "users_team_id_key" ON "users"("team_id");

ALTER TABLE "users"
    ADD CONSTRAINT "users_team_id_fkey"
    FOREIGN KEY ("team_id") REFERENCES "teams"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "users"
    ADD CONSTRAINT "users_username_length"
    CHECK ("username" IS NULL OR char_length(btrim("username")) BETWEEN 3 AND 64);

ALTER TABLE "requests"
    ADD COLUMN "review_note" TEXT;
