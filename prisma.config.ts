import { defineConfig } from "prisma/config";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import "dotenv/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  experimental: { adapter: true },
  engine: "js",
  adapter: async () => {
    const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE !== "false";
    const url = isDemo ? "file:./prisma/demo.db" : process.env.TURSO_DATABASE_URL;
    const authToken = isDemo ? undefined : process.env.TURSO_AUTH_TOKEN;

    if (!url) {
      return new PrismaLibSQL({ url: "file:./prisma/demo.db" });
    }
    return new PrismaLibSQL({ url, authToken });
  },
});
