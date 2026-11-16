const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const express = require("express");
const test = require("node:test");
process.env.DATABASE_URL ||= "******127.0.0.1:5432/hamak";
const { createAuthRouter } = require("../src/routes/auth");
const { hashPassword, verifyPassword } = require("../src/utils/password");

async function withAuthRouter(prisma, run) {
  const originalFrontendUrl = process.env.FRONTEND_URL;
  const app = express();
  app.use(express.json());
  app.use("/api/auth", createAuthRouter(prisma));
  app.use((error, req, res, next) => {
    res.status(error.statusCode || 500).json({ error: error.message });
  });
  const server = app.listen(0);
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    process.env.FRONTEND_URL = origin;
    await run(`${origin}/api/auth`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    if (originalFrontendUrl === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = originalFrontendUrl;
  }
}

test("password hashes are salted and verified without storing plaintext", async () => {
  const firstHash = await hashPassword("test password");
  const secondHash = await hashPassword("test password");
  assert.notEqual(firstHash, secondHash);
  assert.equal(await verifyPassword("test password", firstHash), true);
  assert.equal(await verifyPassword("wrong password", firstHash), false);
  assert.equal(await verifyPassword("test password", "invalid"), false);
});

test("team login creates a hashed database session cookie and logout revokes it", async () => {
  const passwordHash = await hashPassword("correct horse battery staple");
  const user = {
    id: 21n,
    username: "team1",
    passwordHash,
    accountType: "TEAM",
    teamId: 5n,
    team: { id: 5n, name: "Robo Team", isActive: true },
    isActive: true,
  };
  let savedSession;
  const prisma = {
    user: { findUnique: async () => user },
    $transaction: async (callback) =>
      callback({
        $queryRaw: async () => [],
        session: {
          findFirst: async () => null,
          create: async ({ data }) => {
            savedSession = { ...data, id: 7n, revokedAt: null, user };
            return savedSession;
          },
        },
      }),
    session: {
      findUnique: async ({ where }) => {
        assert.equal(
          where.tokenHash,
          createHash("sha256").update(savedSession.token).digest("hex"),
        );
        return savedSession;
      },
      updateMany: async ({ where, data }) => {
        assert.equal(where.id, savedSession.id);
        savedSession.revokedAt = data.revokedAt;
        return { count: 1 };
      },
    },
  };

  await withAuthRouter(prisma, async (baseUrl) => {
    const login = await fetch(`${baseUrl}/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: "team1",
        password: "correct horse battery staple",
      }),
    });
    assert.equal(login.status, 200);
    assert.deepEqual((await login.json()).user, {
      id: "21",
      username: "team1",
      role: "user",
      teamId: "5",
      teamName: "Robo Team",
    });
    const setCookie = login.headers.get("set-cookie");
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Lax/i);
    const cookie = /^(sid=[a-f0-9]{64})/i.exec(setCookie)[1];
    savedSession.token = cookie.slice("sid=".length);
    assert.equal(
      savedSession.tokenHash,
      createHash("sha256").update(savedSession.token).digest("hex"),
    );

    const me = await fetch(`${baseUrl}/me`, { headers: { cookie } });
    assert.equal(me.status, 200);
    assert.equal((await me.json()).user.teamId, "5");

    const blockedLogout = await fetch(`${baseUrl}/logout`, {
      method: "POST",
      headers: { cookie, origin: "https://untrusted.example.test" },
    });
    assert.equal(blockedLogout.status, 403);

    const logout = await fetch(`${baseUrl}/logout`, {
      method: "POST",
      headers: { cookie, origin: new URL(baseUrl).origin },
    });
    assert.equal(logout.status, 200);
    assert.equal(savedSession.revokedAt instanceof Date, true);

    const afterLogout = await fetch(`${baseUrl}/me`, { headers: { cookie } });
    assert.equal(afterLogout.status, 401);
  });
});

test("team accounts cannot open a second active session", async () => {
  const user = {
    id: 21n,
    username: "team1",
    passwordHash: await hashPassword("correct horse battery staple"),
    accountType: "TEAM",
    teamId: 5n,
    team: { id: 5n, name: "Robo Team", isActive: true },
    isActive: true,
  };
  const prisma = {
    user: { findUnique: async () => user },
    $transaction: async (callback) =>
      callback({
        $queryRaw: async () => [],
        session: { findFirst: async () => ({ id: 3n }) },
      }),
    session: { findUnique: async () => null },
  };

  await withAuthRouter(prisma, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "team1", password: "correct horse battery staple" }),
    });
    assert.equal(response.status, 409);
  });
});
