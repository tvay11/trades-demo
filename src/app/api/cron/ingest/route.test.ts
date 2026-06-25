// @vitest-environment node
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { GET } from "./route";

const ORIGINAL_CRON = process.env.CRON_SECRET;
const ORIGINAL_QUIVER = process.env.QUIVER_API_KEY;

beforeEach(() => {
  process.env.CRON_SECRET = "test-cron-secret";
  // Force the QUIVER_API_KEY check to fail with 500 *after* auth passes,
  // so we never actually hit the network in this test file.
  delete process.env.QUIVER_API_KEY;
});

afterAll(() => {
  process.env.CRON_SECRET = ORIGINAL_CRON;
  process.env.QUIVER_API_KEY = ORIGINAL_QUIVER;
});

describe("cron ingest auth", () => {
  it("rejects missing authorization header", async () => {
    const res = await GET(new Request("http://x/api/cron/ingest"));
    expect(res.status).toBe(401);
  });

  it("rejects wrong bearer", async () => {
    const res = await GET(
      new Request("http://x/api/cron/ingest", {
        headers: { authorization: "Bearer wrong-secret" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("rejects 'Bearer undefined' when CRON_SECRET unset", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(
      new Request("http://x/api/cron/ingest", {
        headers: { authorization: "Bearer undefined" },
      }),
    );
    expect(res.status).toBe(500);
  });

  it("accepts correct bearer (passes auth, fails later on missing QUIVER_API_KEY)", async () => {
    const res = await GET(
      new Request("http://x/api/cron/ingest", {
        headers: { authorization: "Bearer test-cron-secret" },
      }),
    );
    // Auth passed; the route then bails on missing QUIVER_API_KEY with 500.
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/QUIVER_API_KEY/);
  });
});
