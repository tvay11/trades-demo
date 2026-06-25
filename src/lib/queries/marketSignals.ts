export type SignalStance = "Long" | "Short" | "Neutral" | "Long Watch" | "Short Watch";
export type SignalConfidence = "Low" | "Medium" | "High";

export type LongShortSignalInput = {
  ticker: string;
  companyName: string | null;
  sector: string | null;
  buyCount: number;
  sellCount: number;
  politicianCount: number;
  estimatedBuyVolume: number;
  estimatedSellVolume: number;
  averageDisclosureLagDays: number;
  latestDisclosureDate: Date | null;
  altDataBreadth: number;
  insiderNetValue: number;
  committeeRelevanceScore: number;
  committeeRelevanceLabel: "High" | "Medium" | "Low";
};

export type LongShortScoreBreakdown = {
  flow: number;
  cluster: number;
  breadth: number;
  insider: number;
  committee: number;
  lagPenalty: number;
};

export type LongShortCandidate = {
  ticker: string;
  companyName: string | null;
  sector: string | null;
  stance: Extract<SignalStance, "Long" | "Short" | "Neutral">;
  confidence: SignalConfidence;
  score: number;
  scoreBreakdown: LongShortScoreBreakdown;
  netFlow: number;
  estimatedBuyVolume: number;
  estimatedSellVolume: number;
  buyPressure: number;
  sellPressure: number;
  buyCount: number;
  sellCount: number;
  politicianCount: number;
  insiderNetValue: number;
  averageDisclosureLagDays: number;
  latestDisclosureDate: Date | null;
  committeeRelevanceScore: number;
  committeeRelevanceLabel: "High" | "Medium" | "Low";
  reasons: string[];
  warnings: string[];
};

/**
 * Minimum off-exchange snapshots required before `latest − average` produces
 * a meaningful "excess" signal. With only 1 row the latest IS the average so
 * every excess is 0 by construction — misleading rather than informative.
 * Quiver's `/live/offexchange` returns a single snapshot per ticker per run,
 * so a real baseline only emerges after the ingest has run on multiple days.
 */
export const MIN_OFF_EXCHANGE_BASELINE_SAMPLES = 5;

export type DarkFlowSignalInput = {
  ticker: string;
  companyName: string | null;
  sector: string | null;
  latestDarkPoolPercent: number | null;
  averageDarkPoolPercent: number | null;
  latestShortVolumePercent: number | null;
  averageShortVolumePercent: number | null;
  latestTotalVolume: number | null;
  averageTotalVolume: number | null;
  /** Number of OffExchangeActivity snapshots feeding the baseline averages. */
  offExchangeSampleSize: number;
  congressNetFlow: number;
  insiderNetValue: number;
  govContractValue: number;
  lobbyingValue: number;
  thirteenFNetShares: number;
  socialMentions: number;
  wikipediaViews: number;
  politicalBeta: number | null;
  latestDate: Date | null;
  committeeRelevanceScore: number;
  committeeRelevanceLabel: "High" | "Medium" | "Low";
};

export type DarkFlowArchetype =
  | "Stealth Accumulation"
  | "Crowded Fade"
  | "Policy Catalyst"
  | "Dark Pressure"
  | "Quiet Tape";

export type DarkFlowCandidate = {
  ticker: string;
  companyName: string | null;
  sector: string | null;
  archetype: DarkFlowArchetype;
  stance: Extract<SignalStance, "Long Watch" | "Short Watch" | "Neutral">;
  confidence: SignalConfidence;
  score: number;
  /**
   * Off-exchange "excess" / "surge" fields are null when fewer than
   * `MIN_OFF_EXCHANGE_BASELINE_SAMPLES` snapshots exist for the ticker.
   * The UI must render these as "—" rather than "0.0" so users don't
   * mistake "we don't have a baseline" for "the baseline is exactly flat".
   */
  darkPoolExcess: number | null;
  shortVolumeExcess: number | null;
  volumeSurge: number | null;
  hasOffExchangeBaseline: boolean;
  socialHeat: number;
  congressNetFlow: number;
  insiderNetValue: number;
  govContractValue: number;
  latestDate: Date | null;
  committeeRelevanceScore: number;
  committeeRelevanceLabel: "High" | "Medium" | "Low";
  reasons: string[];
  warnings: string[];
};

export function scoreLongShortCandidates(
  inputs: LongShortSignalInput[],
): LongShortCandidate[] {
  return inputs
    .map((input) => {
      const buyPressure = input.estimatedBuyVolume + input.buyCount * 35_000;
      const sellPressure = input.estimatedSellVolume + input.sellCount * 35_000;
      const netFlow = input.estimatedBuyVolume - input.estimatedSellVolume;
      const directionalPressure = Math.abs(buyPressure - sellPressure);
      const flowScore = clamp(Math.log10(Math.abs(netFlow) + 1) * 7, 0, 45);
      const countImbalance = Math.abs(input.buyCount - input.sellCount);
      const clusterScore = clamp(countImbalance * 4 + input.politicianCount * 3.5, 0, 28);
      const breadthScore = clamp(input.altDataBreadth * 3.8, 0, 14);
      const insiderScore =
        Math.sign(netFlow || buyPressure - sellPressure) === Math.sign(input.insiderNetValue)
          ? clamp(Math.log10(Math.abs(input.insiderNetValue) + 1) * 1.6, 0, 9)
          : 0;
      const committeeScore = clamp(input.committeeRelevanceScore * 0.16, 0, 16);
      const lagPenalty = input.averageDisclosureLagDays >= 40 ? 9 : input.averageDisclosureLagDays >= 30 ? 5 : 0;
      const scoreBreakdown = {
        flow: flowScore,
        cluster: clusterScore,
        breadth: breadthScore,
        insider: insiderScore,
        committee: committeeScore,
        lagPenalty,
      } satisfies LongShortScoreBreakdown;
      const score = Math.round(clamp(flowScore + clusterScore + breadthScore + insiderScore + committeeScore - lagPenalty, 0, 100));
      const stance =
        buyPressure > sellPressure ? "Long" : sellPressure > buyPressure ? "Short" : "Neutral";

      return {
        ticker: input.ticker,
        companyName: input.companyName,
        sector: input.sector,
        stance,
        confidence: confidenceFor(score),
        score,
        scoreBreakdown,
        netFlow,
        estimatedBuyVolume: input.estimatedBuyVolume,
        estimatedSellVolume: input.estimatedSellVolume,
        buyPressure,
        sellPressure,
        buyCount: input.buyCount,
        sellCount: input.sellCount,
        politicianCount: input.politicianCount,
        insiderNetValue: input.insiderNetValue,
        averageDisclosureLagDays: input.averageDisclosureLagDays,
        latestDisclosureDate: input.latestDisclosureDate,
        committeeRelevanceScore: input.committeeRelevanceScore,
        committeeRelevanceLabel: input.committeeRelevanceLabel,
        reasons: longShortReasons(input, stance, directionalPressure),
        warnings: longShortWarnings(input),
      } satisfies LongShortCandidate;
    })
    .filter(
      (candidate) =>
        candidate.stance !== "Neutral" ||
        candidate.buyCount + candidate.sellCount > 0 ||
        candidate.netFlow !== 0,
    )
    .sort(
      (a, b) =>
        Math.abs(b.netFlow) - Math.abs(a.netFlow) ||
        b.buyCount + b.sellCount - (a.buyCount + a.sellCount) ||
        b.politicianCount - a.politicianCount,
    );
}

export function scoreDarkFlowCandidates(inputs: DarkFlowSignalInput[]): DarkFlowCandidate[] {
  return inputs
    .map((input) => {
      const hasOffExchangeBaseline =
        input.offExchangeSampleSize >= MIN_OFF_EXCHANGE_BASELINE_SAMPLES;
      // Without enough history, latest === average by definition so excess
      // would be a constant 0 — score off-exchange contributions as 0 AND
      // surface null in the output so the UI shows "—" instead of "0.0".
      const darkPoolExcess = hasOffExchangeBaseline
        ? percentExcess(input.latestDarkPoolPercent, input.averageDarkPoolPercent)
        : null;
      const shortVolumeExcess = hasOffExchangeBaseline
        ? percentExcess(input.latestShortVolumePercent, input.averageShortVolumePercent)
        : null;
      const volumeSurge = hasOffExchangeBaseline
        ? ratio(input.latestTotalVolume, input.averageTotalVolume)
        : null;
      const socialHeat = input.socialMentions + input.wikipediaViews;
      const policyValue = input.govContractValue + input.lobbyingValue;
      const institutionalConfirm =
        input.congressNetFlow !== 0 &&
        input.insiderNetValue !== 0 &&
        Math.sign(input.congressNetFlow) === Math.sign(input.insiderNetValue);
      const quietAttention = socialHeat > 0 && socialHeat < 1_000;
      const darkScore = clamp((darkPoolExcess ?? 0) * 1.15, 0, 35);
      const shortScore = clamp((shortVolumeExcess ?? 0) * 0.85, 0, 28);
      const volumeScore = clamp(((volumeSurge ?? 1) - 1) * 8, 0, 20);
      const congressScore = clamp(Math.log10(Math.abs(input.congressNetFlow) + 1) * 3.2, 0, 22);
      const insiderScore = institutionalConfirm
        ? clamp(Math.log10(Math.abs(input.insiderNetValue) + 1) * 1.3, 0, 9)
        : 0;
      const catalystScore = clamp(Math.log10(policyValue + 1) * 2.2, 0, 12);
      const thirteenFScore = clamp(Math.log10(Math.abs(input.thirteenFNetShares) + 1) * 1.3, 0, 8);
      const committeeScore = clamp(input.committeeRelevanceScore * 0.14, 0, 14);
      const quietBonus = quietAttention && input.congressNetFlow > 0 ? 10 : 0;
      const crowdPenalty = socialHeat > 10_000 && input.congressNetFlow > 0 ? 12 : 0;
      const betaScore = clamp(Math.abs(input.politicalBeta ?? 0) * 4, 0, 6);
      const score = Math.round(
        clamp(
          darkScore +
            shortScore +
            volumeScore +
            congressScore +
            insiderScore +
            catalystScore +
            thirteenFScore +
            committeeScore +
            quietBonus +
            betaScore -
            crowdPenalty,
          0,
          100,
        ),
      );
      const archetype = classifyDarkFlow({
        darkPoolExcess: darkPoolExcess ?? 0,
        shortVolumeExcess: shortVolumeExcess ?? 0,
        socialHeat,
        congressNetFlow: input.congressNetFlow,
        policyValue,
      });
      const stance = stanceForDarkFlow(archetype, input);

      return {
        ticker: input.ticker,
        companyName: input.companyName,
        sector: input.sector,
        archetype,
        stance,
        confidence: confidenceFor(score),
        score,
        darkPoolExcess: darkPoolExcess == null ? null : roundOne(darkPoolExcess),
        shortVolumeExcess: shortVolumeExcess == null ? null : roundOne(shortVolumeExcess),
        volumeSurge: volumeSurge == null ? null : roundOne(volumeSurge),
        hasOffExchangeBaseline,
        socialHeat,
        congressNetFlow: input.congressNetFlow,
        insiderNetValue: input.insiderNetValue,
        govContractValue: input.govContractValue,
        latestDate: input.latestDate,
        committeeRelevanceScore: input.committeeRelevanceScore,
        committeeRelevanceLabel: input.committeeRelevanceLabel,
        reasons: darkFlowReasons(
          input,
          archetype,
          darkPoolExcess ?? 0,
          shortVolumeExcess ?? 0,
          volumeSurge ?? 1,
        ),
        warnings: darkFlowWarnings(input, archetype, shortVolumeExcess ?? 0, socialHeat),
      } satisfies DarkFlowCandidate;
    })
    .filter(
      (candidate) =>
        // Without an off-exchange baseline, the page only earns a row when
        // there's a confirming flow signal (congressional, insider, or
        // social attention). Otherwise we'd surface a "Quiet Tape" ticker
        // we have nothing real to say about.
        (candidate.darkPoolExcess ?? 0) > 0 ||
        (candidate.shortVolumeExcess ?? 0) > 0 ||
        (candidate.volumeSurge ?? 1) > 1 ||
        candidate.congressNetFlow !== 0 ||
        candidate.insiderNetValue !== 0 ||
        candidate.socialHeat > 0,
    )
    .sort((a, b) => {
      const aMaxExcess = Math.max(a.darkPoolExcess ?? 0, a.shortVolumeExcess ?? 0);
      const bMaxExcess = Math.max(b.darkPoolExcess ?? 0, b.shortVolumeExcess ?? 0);
      return (
        bMaxExcess - aMaxExcess ||
        (b.volumeSurge ?? 0) - (a.volumeSurge ?? 0) ||
        Math.abs(b.congressNetFlow) - Math.abs(a.congressNetFlow)
      );
    });
}

function longShortReasons(
  input: LongShortSignalInput,
  stance: LongShortCandidate["stance"],
  directionalPressure: number,
) {
  const reasons: string[] = [];

  if (stance === "Long" && input.buyCount - input.sellCount >= 3) {
    reasons.push("Clustered congressional buying");
  }
  if (stance === "Short" && input.sellCount > input.buyCount) {
    reasons.push("Congressional selling dominates disclosed flow");
  }
  if (input.politicianCount >= 3) reasons.push("Multiple politicians are active in the ticker");
  if (input.altDataBreadth >= 3) reasons.push("Signal is confirmed by multiple alternative datasets");
  if (
    input.insiderNetValue > 0 &&
    (stance === "Long" || input.estimatedBuyVolume > input.estimatedSellVolume)
  ) {
    reasons.push("Insider flow confirms the buy side");
  }
  if (
    input.insiderNetValue < 0 &&
    (stance === "Short" || input.estimatedSellVolume > input.estimatedBuyVolume)
  ) {
    reasons.push("Insider flow confirms the sell side");
  }
  if (directionalPressure >= 1_000_000) reasons.push("Estimated disclosure volume is unusually large");
  if (input.committeeRelevanceScore >= 75) {
    reasons.push("Committee jurisdiction directly matches the ticker");
  } else if (input.committeeRelevanceScore >= 35) {
    reasons.push("Committee jurisdiction matches the sector");
  }

  return reasons.length ? reasons : ["Directional activity is detectable but not yet clustered"];
}

function longShortWarnings(input: LongShortSignalInput) {
  const warnings: string[] = [];

  if (input.averageDisclosureLagDays >= 40) {
    warnings.push("Disclosure lag is near the STOCK Act limit");
  }
  if (input.buyCount + input.sellCount < 3) warnings.push("Thin congressional sample");
  if (
    input.insiderNetValue < 0 &&
    input.estimatedBuyVolume > input.estimatedSellVolume
  ) {
    warnings.push("Insider selling contradicts congressional buying");
  }
  if (
    input.insiderNetValue > 0 &&
    input.estimatedSellVolume > input.estimatedBuyVolume
  ) {
    warnings.push("Insider buying contradicts congressional selling");
  }

  return warnings;
}

function classifyDarkFlow({
  darkPoolExcess,
  shortVolumeExcess,
  socialHeat,
  congressNetFlow,
  policyValue,
}: {
  darkPoolExcess: number;
  shortVolumeExcess: number;
  socialHeat: number;
  congressNetFlow: number;
  policyValue: number;
}): DarkFlowArchetype {
  if (socialHeat >= 5_000 && shortVolumeExcess >= 20) return "Crowded Fade";
  if (darkPoolExcess >= 15 && congressNetFlow > 0 && socialHeat < 1_000) {
    return "Stealth Accumulation";
  }
  if (policyValue >= 1_000_000 && congressNetFlow > 0) return "Policy Catalyst";
  if (darkPoolExcess >= 10 || shortVolumeExcess >= 15) return "Dark Pressure";
  return "Quiet Tape";
}

function stanceForDarkFlow(
  archetype: DarkFlowArchetype,
  input: DarkFlowSignalInput,
): DarkFlowCandidate["stance"] {
  if (archetype === "Crowded Fade") return "Short Watch";
  if (
    archetype === "Stealth Accumulation" ||
    archetype === "Policy Catalyst" ||
    input.congressNetFlow > 0 ||
    input.insiderNetValue > 0
  ) {
    return "Long Watch";
  }
  if (input.congressNetFlow < 0 || input.insiderNetValue < 0) return "Short Watch";
  return "Neutral";
}

function darkFlowReasons(
  input: DarkFlowSignalInput,
  archetype: DarkFlowArchetype,
  darkPoolExcess: number,
  shortVolumeExcess: number,
  volumeSurge: number,
) {
  const reasons: string[] = [];

  if (darkPoolExcess >= 15) reasons.push("Dark-pool participation is far above baseline");
  if (shortVolumeExcess >= 20) reasons.push("Short-volume pressure is unusually high");
  if (volumeSurge >= 2) reasons.push("Off-exchange volume is surging versus baseline");
  if (input.congressNetFlow > 0) reasons.push("Congressional net flow is positive");
  if (input.congressNetFlow < 0) reasons.push("Congressional net flow is negative");
  if (input.insiderNetValue > 0) reasons.push("Insiders are net buyers");
  if (input.insiderNetValue < 0) reasons.push("Insiders are net sellers");
  if (input.govContractValue + input.lobbyingValue >= 1_000_000) {
    reasons.push("Policy-linked money flow is material");
  }
  if (input.committeeRelevanceScore >= 75) {
    reasons.push("Committee jurisdiction strengthens the policy edge");
  }
  if (archetype === "Stealth Accumulation") reasons.push("Quiet attention profile");

  return reasons.length ? reasons : ["Tape is unusual but lacks confirmation"];
}

function darkFlowWarnings(
  input: DarkFlowSignalInput,
  archetype: DarkFlowArchetype,
  shortVolumeExcess: number,
  socialHeat: number,
) {
  const warnings: string[] = [];

  if (archetype === "Crowded Fade" && socialHeat >= 5_000) {
    warnings.push("High squeeze risk because public attention is elevated");
  }
  if (input.congressNetFlow > 0 && input.insiderNetValue < 0) {
    warnings.push("Insider selling contradicts political buying");
  }
  if (input.congressNetFlow < 0 && input.insiderNetValue > 0) {
    warnings.push("Insider buying contradicts political selling");
  }
  if (shortVolumeExcess >= 35) warnings.push("Short volume is pressure, not short interest");

  return warnings;
}

function percentExcess(latest: number | null, average: number | null) {
  if (latest == null || average == null) return 0;
  return latest - average;
}

function ratio(latest: number | null, average: number | null) {
  if (latest == null || average == null || average <= 0) return 1;
  return latest / average;
}

function confidenceFor(score: number): SignalConfidence {
  if (score >= 80) return "High";
  if (score >= 45) return "Medium";
  return "Low";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}
