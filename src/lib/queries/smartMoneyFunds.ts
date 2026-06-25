import configuredPatterns from "@/config/smart-money-funds.json";

const SQL_ALIAS_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const SMART_MONEY_FUND_PATTERNS = configuredPatterns.map((pattern) => pattern.trim()).filter(Boolean);
export const SMART_MONEY_FALLBACK_FUND_LIMIT = 40;
export const SMART_MONEY_TOP_FUND_LIMIT = 25;

export type SmartMoneyBackupHoldingRow = {
  filer: string;
  reportDate: string;
};

export function mergeFundPatterns(existingPatterns: string[], generatedPatterns: string[]) {
  const patterns: string[] = [];
  const added: string[] = [];
  const seen = new Set<string>();

  for (const rawPattern of existingPatterns) {
    const pattern = rawPattern.trim();
    const key = pattern.toLowerCase();
    if (!pattern || seen.has(key)) continue;

    patterns.push(pattern);
    seen.add(key);
  }

  for (const rawPattern of generatedPatterns) {
    const pattern = rawPattern.trim();
    const key = pattern.toLowerCase();
    if (!pattern || seen.has(key)) continue;

    patterns.push(pattern);
    added.push(pattern);
    seen.add(key);
  }

  return { patterns, added };
}

export function isTrackedFundFiler(filer: string, patterns = SMART_MONEY_FUND_PATTERNS) {
  const normalizedFiler = filer.toLowerCase();
  return patterns.some((pattern) => {
    const normalizedPattern = pattern.trim().toLowerCase();
    return normalizedPattern.length > 0 && normalizedFiler.includes(normalizedPattern);
  });
}

export function previousQuarterStartDate(now: Date) {
  const month = now.getUTCMonth();
  const currentQuarter = Math.floor(month / 3);
  const previousQuarter = currentQuarter === 0 ? 3 : currentQuarter - 1;
  const year = currentQuarter === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
  const startMonth = previousQuarter * 3;
  return new Date(Date.UTC(year, startMonth, 1)).toISOString().slice(0, 10);
}

export function parseThirteenFBackupInsert(line: string): SmartMoneyBackupHoldingRow | null {
  const match = line.match(/^INSERT INTO "?ThirteenFHolding"? VALUES\((.*)\);$/);
  if (!match) return null;

  const values = parseSqlValues(match[1]);
  const filer = values[1]?.trim();
  const reportDate = values[6]?.trim();
  if (!filer || !reportDate) return null;

  return { filer, reportDate };
}

export function rankTopFilerRowsFromBackup(rows: SmartMoneyBackupHoldingRow[], limit: number) {
  const reportDate = rows.reduce<string | null>(
    (latest, row) => (!latest || row.reportDate > latest ? row.reportDate : latest),
    null,
  );
  if (!reportDate) return { reportDate: null, rows: [] };

  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.reportDate !== reportDate) continue;
    counts.set(row.filer, (counts.get(row.filer) ?? 0) + 1);
  }

  return {
    reportDate,
    rows: [...counts.entries()]
      .map(([filer, rows]) => ({ filer, rows }))
      .sort((a, b) => b.rows - a.rows || (a.filer < b.filer ? -1 : a.filer > b.filer ? 1 : 0))
      .slice(0, limit),
  };
}

export function buildTrackedFundSqlFilter(alias: string) {
  if (!SQL_ALIAS_RE.test(alias)) {
    throw new Error(`Invalid SQL alias for smart-money fund filter: ${alias}`);
  }

  if (!SMART_MONEY_FUND_PATTERNS.length) return "1 = 0";

  return SMART_MONEY_FUND_PATTERNS.map(
    (pattern) => `${alias}."filer" LIKE '%${escapeSqlLikePattern(pattern)}%'`,
  ).join(" OR ");
}

function escapeSqlLikePattern(pattern: string) {
  return pattern.replaceAll("'", "''");
}

function parseSqlValues(valueList: string) {
  const values: string[] = [];
  let value = "";
  let inString = false;

  for (let index = 0; index < valueList.length; index += 1) {
    const char = valueList[index];

    if (inString) {
      if (char === "'") {
        if (valueList[index + 1] === "'") {
          value += "'";
          index += 1;
          continue;
        }

        inString = false;
        continue;
      }

      value += char;
      continue;
    }

    if (char === "'") {
      inString = true;
      continue;
    }

    if (char === ",") {
      values.push(value.trim());
      value = "";
      continue;
    }

    value += char;
  }

  values.push(value.trim());
  return values;
}
