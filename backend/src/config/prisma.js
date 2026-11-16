require("dotenv").config();

const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

const rawConnectionString = process.env.DATABASE_URL;
if (!rawConnectionString) {
  throw new Error("DATABASE_URL must be set before starting the API.");
}

// Builds the node-postgres pool config. Supabase requires TLS; its server
// certificate is signed by Supabase's own CA, which is not in Node's default
// trust store. Provide SUPABASE_CA_CERT (PEM, from Supabase → Database →
// SSL configuration) for full verification, otherwise the connection is
// encrypted without CA verification. Local databases connect without TLS.
function poolConfig(connectionString) {
  const url = new URL(connectionString);
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname) || url.hostname.endsWith(".local");
  const sslMode = url.searchParams.get("sslmode");
  url.searchParams.delete("sslmode");
  url.searchParams.delete("pgbouncer");
  const config = {
    connectionString: url.toString(),
    max: Number(process.env.PG_POOL_MAX || (process.env.VERCEL ? 3 : 10)),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  };
  if (sslMode === "disable" || (local && !sslMode)) return config;
  const ca = process.env.SUPABASE_CA_CERT?.replace(/\\n/g, "\n");
  config.ssl = ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false };
  return config;
}

const adapter = new PrismaPg(poolConfig(rawConnectionString));
const prisma = new PrismaClient({ adapter });

module.exports = prisma;
