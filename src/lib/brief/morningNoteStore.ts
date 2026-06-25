import { db } from "@/lib/db";
import { parseMorningNote } from "./morningNote";
import type { MorningNote } from "./morningNote";

// ── Table schema ──────────────────────────────────────────────────────────────
// MorningNote(date TEXT PRIMARY KEY, payload TEXT NOT NULL, generatedAt TEXT NOT NULL)

export async function ensureMorningNoteTable(): Promise<void> {
  await db.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS MorningNote (
       date TEXT PRIMARY KEY,
       payload TEXT NOT NULL,
       generatedAt TEXT NOT NULL
     )`,
  );
}

export interface StoredMorningNote {
  note: MorningNote;
  generatedAt: string;
}

/** Retrieve the stored morning note for a given ISO date (YYYY-MM-DD). Returns null if not found or invalid. */
export async function getStoredMorningNote(date: string): Promise<StoredMorningNote | null> {
  try {
    await ensureMorningNoteTable();
    const rows = await db.$queryRawUnsafe<
      { date: string; payload: string; generatedAt: string }[]
    >(
      `SELECT date, payload, generatedAt FROM MorningNote WHERE date = ?`,
      date,
    );
    if (!rows.length) {
      return null;
    }
    const row = rows[0];
    const note = parseMorningNote(row.payload);
    if (!note) {
      return null;
    }
    return { note, generatedAt: row.generatedAt };
  } catch (error) {
    console.warn(`[morningNoteStore] lookup failed date=${date}:`, error);
    return null;
  }
}

/** Upsert the morning note for a given ISO date. Never throws. */
export async function saveMorningNote(date: string, note: MorningNote): Promise<void> {
  try {
    await ensureMorningNoteTable();
    const generatedAt = new Date().toISOString();
    await db.$executeRawUnsafe(
      `INSERT INTO MorningNote (date, payload, generatedAt)
       VALUES (?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET payload = excluded.payload, generatedAt = excluded.generatedAt`,
      date,
      JSON.stringify(note),
      generatedAt,
    );
  } catch (e) {
    console.warn("[morningNoteStore] saveMorningNote failed:", (e as Error).message);
  }
}
