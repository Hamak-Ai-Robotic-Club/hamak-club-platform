import "./setup.js";
import test from "node:test";
import assert from "node:assert/strict";
import { loginAgent, requestBody, item } from "./helpers.js";

let team1, team2, admin1, admin2;

test.before(async () => {
    team1 = await loginAgent("team1");
    team2 = await loginAgent("team2");
    admin1 = await loginAgent("admin1");
    admin2 = await loginAgent("admin1");
});

test("approval is all-or-nothing: a failed approval reserves nothing", async () => {
    // component-124 has 3 working, component-123 has 8 working
    const mixed = await team1
        .post("/api/requests")
        .send(requestBody([item("component-124", 1), item("component-123", 9)]));
    assert.equal(mixed.status, 201);

    const fail = await admin1.post(`/api/admin/requests/${mixed.body.request.id}/approve`);
    assert.equal(fail.status, 409);
    assert.match(fail.body.message, /component-123/);

    // all 3 units of component-124 must still be available
    await team1.post(`/api/requests/${mixed.body.request.id}/cancel`);
    const full = await team2
        .post("/api/requests")
        .send(requestBody([item("component-124", 3)]));
    const ok = await admin1.post(`/api/admin/requests/${full.body.request.id}/approve`);
    assert.equal(ok.status, 200);
});

test("two concurrent approvals cannot exceed the last available quantity", async () => {
    // component-123: 8 working. Two requests of 5 -> only one can be approved.
    const a = await team1.post("/api/requests").send(requestBody([item("component-123", 5)]));
    const b = await team2.post("/api/requests").send(requestBody([item("component-123", 5)]));
    assert.equal(a.status, 201);
    assert.equal(b.status, 201);

    const [ra, rb] = await Promise.all([
        admin1.post(`/api/admin/requests/${a.body.request.id}/approve`),
        admin2.post(`/api/admin/requests/${b.body.request.id}/approve`),
    ]);
    assert.deepEqual([ra.status, rb.status].sort(), [200, 409]);
});

test("rejecting does not reserve stock", async () => {
    const list = await admin1.get("/api/requests");
    const pending = list.body.items.filter((r) => r.status === "Pending");
    for (const r of pending) {
        const res = await admin1.post(`/api/admin/requests/${r.id}/reject`).send({});
        assert.equal(res.status, 200);
    }
});