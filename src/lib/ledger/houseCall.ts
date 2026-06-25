import type { HouseCall, HouseCallContribution, MacroLean, OptionsLean, Rating, ScorecardRow, StreetRead, ValuationRead } from "./types";

export interface HouseCallInputs {
  scorecard: ScorecardRow[];
  lastClose: number | null;
  sma50: number | null;
  signals: { congressNetFlowLabel: string } | null;
  fundamentals: { revenueYoYPct: number | null } | null;
  macro?: { label: MacroLean; confidence?: "low" | "ok" } | null;
  options?: { lean: OptionsLean } | null;
  valuation?: { read: ValuationRead } | null;
  analyst?: { upsidePct: number | null } | null;
  street?: { read: StreetRead; peadActive: boolean; peadDirection: "up" | "down" | null } | null;
  altFlow?: { darkShortExcessPp: number | null; govContractUsd180d: number | null } | null;
}

export function buildHouseCall(inputs: HouseCallInputs): HouseCall {
  const drivers: string[] = [];
  const contributions: HouseCallContribution[] = [];
  let score = 0;

  const add = (label: string, value: number, driver: string) => {
    score += value;
    contributions.push({ label, value });
    drivers.push(driver);
  };

  for (const row of inputs.scorecard) {
    if (row.signal === "BULL") {
      add(row.label, 1, `${row.label}: bullish`);
    } else if (row.signal === "BEAR") {
      add(row.label, -1, `${row.label}: bearish`);
    }
  }

  if (inputs.signals) {
    if (inputs.signals.congressNetFlowLabel === "Buying") {
      add("Congress flow", 1, "Congress net buying");
    } else if (inputs.signals.congressNetFlowLabel === "Selling") {
      add("Congress flow", -1, "Congress net selling");
    }
  }

  if (inputs.fundamentals?.revenueYoYPct != null) {
    if (inputs.fundamentals.revenueYoYPct > 15) {
      add("Revenue growth", 1, `Revenue +${inputs.fundamentals.revenueYoYPct.toFixed(0)}% YoY`);
    } else if (inputs.fundamentals.revenueYoYPct < 0) {
      add("Revenue growth", -1, `Revenue ${inputs.fundamentals.revenueYoYPct.toFixed(0)}% YoY`);
    }
  }

  if (inputs.options?.lean === "bullish") {
    add("Options lean", 0.5, "Options: bullish lean (low PCR / negative skew)");
  } else if (inputs.options?.lean === "bearish") {
    add("Options lean", -0.5, "Options: bearish lean (high PCR / downside fear)");
  }

  if (inputs.valuation?.read === "expensive") {
    add("Valuation", -0.5, "Valuation: elevated multiples (trailing P/E > 60)");
  }

  if (inputs.analyst?.upsidePct != null) {
    if (inputs.analyst.upsidePct > 15) {
      add("Street View", 0.5, `Analyst consensus: ${inputs.analyst.upsidePct.toFixed(0)}% upside to target`);
    } else if (inputs.analyst.upsidePct < -10) {
      add("Street View", -0.5, `Analyst consensus: ${inputs.analyst.upsidePct.toFixed(0)}% downside to target`);
    }
  }

  if (inputs.street) {
    if (inputs.street.read === "improving") {
      add("Street momentum", 0.5, "Street momentum: estimates being revised up");
    } else if (inputs.street.read === "deteriorating") {
      add("Street momentum", -0.5, "Street momentum: estimates being revised down");
    }
    if (inputs.street.peadActive && inputs.street.peadDirection) {
      const sign = inputs.street.peadDirection === "up" ? 0.5 : -0.5;
      add("Earnings drift", sign, `Post-earnings drift window active (${inputs.street.peadDirection === "up" ? "positive" : "negative"} surprise)`);
    }
  }

  if (inputs.altFlow) {
    if (inputs.altFlow.darkShortExcessPp != null && inputs.altFlow.darkShortExcessPp >= 10) {
      add("Dark short pressure", -0.5, `Off-exchange short volume +${inputs.altFlow.darkShortExcessPp.toFixed(1)}pp vs baseline`);
    }
    if (inputs.altFlow.govContractUsd180d != null && inputs.altFlow.govContractUsd180d >= 10_000_000) {
      add("Gov contracts", 0.25, `$${(inputs.altFlow.govContractUsd180d / 1_000_000).toFixed(0)}M government contracts in 180d`);
    }
  }

  const rating: Rating = score >= 2 ? "BUY" : score <= -2 ? "SELL" : "HOLD";

  const watchPrice = inputs.sma50 ?? inputs.lastClose;
  const watchTrigger =
    watchPrice == null
      ? "Insufficient price history to set a level."
      : `Daily close below $${watchPrice.toFixed(2)} (50-day) tilts bearish; above sustains the bull case.`;

  const lean = score > 0 ? "constructive" : score < 0 ? "cautious" : "balanced";
  const synthesis = `Net read is ${lean} (${rating}). Weigh the signals below together and confirm direction across timeframes before acting.`;

  return { rating, drivers, watchTrigger, synthesis, score, contributions };
}
