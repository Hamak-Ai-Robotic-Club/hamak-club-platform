import "./setup.js";
import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

process.env.LOGIN_RATE_LIMIT_MAX = "3";
const { default: app } = await import("../src/app.js");

test("successful logins do not count towards the limit", async () => {
    for (let i = 0; i < 5; i++) {
        const res = await request(app)
            .post("/api/auth/login")
            .send({ username: "admin1", password: "Team@12345" });
        assert.equal(res.status, 200);
    }
});

test("too many failed attempts get 429", async () => {
    for (let i = 0; i < 3; i++) {
        const res = await request(app)
            .post("/api/auth/login")
            .send({ username: "team1", password: "wrong" });
        assert.equal(res.status, 401);
    }
    const blocked = await request(app)
        .post("/api/auth/login")
        .send({ username: "team1", password: "wrong" });
    assert.equal(blocked.status, 429);
    assert.equal(blocked.body.message, "Too many login attempts, please try again later");
});