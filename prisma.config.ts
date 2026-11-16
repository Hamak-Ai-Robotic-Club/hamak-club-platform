import "dotenv/config";
import { defineConfig } from "prisma/config";

// Root Prisma config used by Vercel builds (prisma generate) and by
// `npm run db:migrate`. Migrations need a direct / session connection
// (DIRECT_URL, Supabase port 5432); the app itself uses DATABASE_URL.
export default defineConfig({
  schema: "backend/prisma/schema.prisma",
  migrations: {
    path: "backend/prisma/migrations",
  },
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || "postgresql://placeholder:placeholder@localhost:5432/placeholder",
  },
});
