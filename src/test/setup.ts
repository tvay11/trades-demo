import "@testing-library/jest-dom/vitest";
import { beforeEach, afterEach } from "vitest";

if (!process.env.TURSO_DATABASE_URL) {
  process.env.TURSO_DATABASE_URL = "file:./prisma/test.db";
}

// Per-test snapshot/restore of process.env keys that tests mutate. Without
// this, a test that sets INGEST_MIN_DATE and crashes before its finally{}
// leaves the global state polluted for the next test. List of keys to
// guard grows as more tests reach for env.
const SNAPSHOT_KEYS = ["INGEST_MIN_DATE"] as const;
const snapshot: Partial<Record<(typeof SNAPSHOT_KEYS)[number], string | undefined>> = {};

beforeEach(() => {
  for (const k of SNAPSHOT_KEYS) snapshot[k] = process.env[k];
  // Default cutoff for all tests; individual tests override as needed.
  process.env.INGEST_MIN_DATE = "1970-01-01";
});

afterEach(() => {
  for (const k of SNAPSHOT_KEYS) {
    const v = snapshot[k];
    if (v == null) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }
});
