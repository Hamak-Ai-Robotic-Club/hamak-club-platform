import "./setup.js";
import test from "node:test";
import assert from "node:assert/strict";
import { loginAgent, requestBody, item } from "./helpers.js";

let team1, team2, admin;
let firstId;

test.before(async () => {
    team1 = await loginAgent("team1");
    team2 = await loginAgent("team2");
    admin = await loginAgent("admin1");
});

test("team creates a request with project name, description and items", async () => {
    const res = await team1
        .post("/api/requests")
        .send(requestBody([item("component-123", 2), item("component-124", 1)], "Smart Greenhouse"));
    assert.equal(res.status, 201);
    assert.equal(res.body.request.status, "Pending");
    assert.equal(res.body.request.projectName, "Smart Greenhouse");
    assert.equal(res.body.request.items.length, 2);
    firstId = res.body.request.id;
});

test("second request while one is Pending is rejected (409)", async () => {
    const res = await team1
        .post("/api/requests")
        .send(requestBody([item("component-123", 1)]));
    assert.equal(res.status, 409);
});

test("editing a submitted request is rejected (409)", async () => {
    const res = await team1.patch(`/api/requests/${firstId}`).send({ projectName: "Changed" });
    assert.equal(res.status, 409);
});

test("invalid payloads get 422", async () => {
    const bad = [
        { projectName: "X", projectDescription: "Y", items: [] },
        requestBody([item("component-123", 0)]),
        requestBody([item("component-123", 1.5)]),
        requestBody([item("component-999", 1)]),
        requestBody([item("component-125", 1)]),
        requestBody([item("component-123", 1), item("component-123", 2)]),
        { projectDescription: "Y", items: [item("component-123", 1)] },
    ];
    for (const body of bad) {
        const res = await team2.post("/api/requests").send(body);
        assert.equal(res.status, 422, JSON.stringify(body));
    }
});

test("ownership: other team gets 403, admin can read, unknown id gets 404", async () => {
    assert.equal((await team2.get(`/api/requests/${firstId}`)).status, 403);
    assert.equal((await team2.post(`/api/requests/${firstId}/cancel`)).status, 403);
    assert.equal((await admin.get(`/api/requests/${firstId}`)).status, 200);
    assert.equal((await team1.get("/api/requests/9999")).status, 404);
    const list = await team2.get("/api/requests");
    assert.equal(list.status, 200);
    assert.equal(list.body.items.length, 0);
});

test("cancelling frees the team to submit a new request", async () => {
    const cancel = await team1.post(`/api/requests/${firstId}/cancel`);
    assert.equal(cancel.status, 200);
    assert.equal(cancel.body.request.status, "Cancelled");

    const list = await team1.get("/api/requests");
    assert.equal(list.body.items.length, 0);

    const again = await team1
        .post("/api/requests")
        .send(requestBody([item("component-123", 1)]));
    assert.equal(again.status, 201);
});

test("approved request cannot be cancelled, but team may submit a new one", async () => {
    const list = await team1.get("/api/requests");
    const pendingId = list.body.items[0].id;

    const approve = await admin.post(`/api/admin/requests/${pendingId}/approve`);
    assert.equal(approve.status, 200);
    assert.equal(approve.body.request.status, "Approved");
    assert.equal(approve.body.request.items[0].approvedQuantity, 1);

    assert.equal((await team1.post(`/api/requests/${pendingId}/cancel`)).status, 409);

    const next = await team1
        .post("/api/requests")
        .send(requestBody([item("component-124", 1)]));
    assert.equal(next.status, 201);
});

test("approve/reject only work on Pending requests", async () => {
    const create = await team2
        .post("/api/requests")
        .send(requestBody([item("component-124", 1)]));
    const id = create.body.request.id;

    const reject = await admin.post(`/api/admin/requests/${id}/reject`).send({ note: "Not needed" });
    assert.equal(reject.status, 200);
    assert.equal(reject.body.request.status, "Rejected");
    assert.equal(reject.body.request.note, "Not needed");

    assert.equal((await admin.post(`/api/admin/requests/${id}/reject`).send({})).status, 409);
    assert.equal((await admin.post(`/api/admin/requests/${id}/approve`)).status, 409);
    assert.equal((await admin.post("/api/admin/requests/9999/approve")).status, 404);
});