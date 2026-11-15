import "./setup.js";
import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../src/app.js";
import { PASSWORD } from "./helpers.js";

const login = (agent, username, password = PASSWORD) =>
    agent.post("/api/auth/login").send({ username, password });

test("login succeeds, sets an HttpOnly cookie and hides password_hash", async () => {
    const res = await login(request(app), "admin1");
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.user, { id: 3, username: "admin1", role: "admin" });
    assert.ok(!JSON.stringify(res.body).includes("password_hash"));
    const cookie = res.headers["set-cookie"].join(";");
    assert.match(cookie, /sid=/);
    assert.match(cookie, /HttpOnly/i);
});

test("wrong password and unknown user return the same 401 message", async () => {
    const wrong = await login(request(app), "team1", "wrong-password");
    const unknown = await login(request(app), "nobody");
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(wrong.body.message, unknown.body.message);
});

test("frozen account gets 403", async () => {
    const res = await login(request(app), "frozen1");
    assert.equal(res.status, 403);
});

test("invalid input gets 422", async () => {
    const missing = await request(app).post("/api/auth/login").send({ username: "team1" });
    const empty = await request(app).post("/api/auth/login").send({});
    assert.equal(missing.status, 422);
    assert.equal(empty.status, 422);
});

test("me and logout without a session get 401", async () => {
    assert.equal((await request(app).get("/api/auth/me")).status, 401);
    assert.equal((await request(app).post("/api/auth/logout")).status, 401);
});

test("team account: one active session only; logout frees it", async () => {
    const first = request.agent(app);
    const second = request.agent(app);

    assert.equal((await login(first, "team1")).status, 200);
    assert.equal((await first.get("/api/auth/me")).status, 200);

    assert.equal((await login(second, "team1")).status, 409);

    assert.equal((await first.post("/api/auth/logout")).status, 200);
    assert.equal((await first.get("/api/auth/me")).status, 401);

    assert.equal((await login(second, "team1")).status, 200);
});

test("admin account can hold multiple sessions", async () => {
    const a = request.agent(app);
    const b = request.agent(app);
    assert.equal((await login(a, "admin1")).status, 200);
    assert.equal((await login(b, "admin1")).status, 200);
    assert.equal((await a.get("/api/auth/me")).status, 200);
    assert.equal((await b.get("/api/auth/me")).status, 200);
});