import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import path from "path";

// Versioned cache key. Bump this whenever the PrismaClient constructor args
// change so the dev server's globalThis-cached client gets replaced after a
// hot reload instead of clinging to the stale instance.
const CACHE_KEY = "__trades_prisma_v3__";

type CachedGlobal = { [CACHE_KEY]?: PrismaClient };

function makeClient(): PrismaClient {
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE !== "false";
  const url = isDemo 
    ? `file:${path.resolve(process.cwd(), "prisma/demo.db")}` 
    : process.env.TURSO_DATABASE_URL;
  const authToken = isDemo ? undefined : process.env.TURSO_AUTH_TOKEN;

  console.log("[Prisma db.ts] isDemo:", isDemo, "url:", url);

  if (!url) throw new Error("TURSO_DATABASE_URL not set and NEXT_PUBLIC_DEMO_MODE is false");

  if (url.startsWith("file:")) {
    console.log("[Prisma] Connecting to SQLite at:", url);
    // Native SQLite driver without adapter
    return new PrismaClient({
      datasources: {
        db: {
          url: url
        }
      }
    });
  }

  const adapter = new PrismaLibSQL({ url, authToken, intMode: "bigint" });
  return new PrismaClient({ adapter });
}

const cached = globalThis as unknown as CachedGlobal;
export const db: PrismaClient = cached[CACHE_KEY] ?? makeClient();
if (process.env.NODE_ENV !== "production") cached[CACHE_KEY] = db;
