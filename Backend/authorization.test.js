import "./setup.js";
import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../src/app.js";
import { loginAgent, requestBody, item } from "./helpers.js";

test("unauthenticated call to a protected route gets 401", async () => {
    assert.equal((await request(app).get("/api/requests")).status, 401);
    assert.equal((await request(app).post("/api/admin/requests/1/approve")).status, 401);
});

test("normal user calling an admin API gets 403", async () => {
    const team = await loginAgent("team1");
    assert.equal((await team.post("/api/admin/requests/1/approve")).status, 403);
    assert.equal((await team.post("/api/admin/requests/1/reject").send({})).status, 403);
});

test("admin cannot create or cancel team requests", async () => {
    const admin = await loginAgent("admin1");
    const create = await admin
        .post("/api/requests")
        .send(requestBody([item("component-123", 1)]));
    assert.equal(create.status, 403);
    assert.equal((await admin.post("/api/requests/1/cancel")).status, 403);
});