/**
 * libSQL returns DateTime columns from $queryRaw as raw text in the form
 * "YYYY-MM-DD HH:MM:SS" (no `T`, no `Z`). `new Date("...")` then parses that
 * as LOCAL time — on a non-UTC host this shifts every stored value by the
 * host's offset. Wrap raw libSQL DateTime strings with this helper to force
 * UTC parsing.
 *
 * Examples:
 *   parseSqliteUtc("2026-05-12 09:23:00")   -> 2026-05-12T09:23:00Z
 *   parseSqliteUtc("2026-05-12T09:23:00")   -> 2026-05-12T09:23:00Z
 *   parseSqliteUtc("2026-05-12T09:23:00Z")  -> 2026-05-12T09:23:00Z (no-op)
 *   parseSqliteUtc(null)                    -> null
 */
export function parseSqliteUtc(value: string | null | undefined): Date | null {
  if (!value) return null;
  let s = value.trim();
  if (!s) return null;
  // Already has a timezone marker: trust it.
  if (/[Zz]$|[+-]\d{2}:?\d{2}$/.test(s)) return new Date(s);
  // Convert "YYYY-MM-DD HH:MM:SS" -> ISO and force UTC.
  s = s.replace(" ", "T");
  return new Date(s + "Z");
}
