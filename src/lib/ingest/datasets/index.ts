import type { DatasetSpec } from "../types";
import { CongressTradeSpec } from "./congress";
import { SenateTradeSpec } from "./senate";
import { HouseTradeSpec } from "./house";
import { LobbyingDisclosureSpec } from "./lobbying";
import { WsbMentionSpec } from "./wsb";
import { SpacSpec } from "./spac";
import { PoliticalBetaSpec } from "./politicalbeta";
import { PatentSpec } from "./patents";
import { GovContractSpec } from "./govcontracts";
import { ThirteenFHoldingSpec } from "./thirteenf";
import { OffExchangeActivitySpec } from "./offexchange";
import { InsiderTradeSpec } from "./insiders";

// WikipediaView intentionally omitted: no Quiver endpoint works at the trader tier.
// TwitterMention intentionally omitted: /live/twitter returns Twitter follower
// tracking data (Followers, pct_change*), not mention counts — the existing schema
// is incompatible. Re-add with a redesigned spec/schema if needed.

export const DATASETS: DatasetSpec<unknown, unknown>[] = [
  CongressTradeSpec as unknown as DatasetSpec<unknown, unknown>,
  SenateTradeSpec as unknown as DatasetSpec<unknown, unknown>,
  HouseTradeSpec as unknown as DatasetSpec<unknown, unknown>,
  LobbyingDisclosureSpec as unknown as DatasetSpec<unknown, unknown>,
  WsbMentionSpec as unknown as DatasetSpec<unknown, unknown>,
  SpacSpec as unknown as DatasetSpec<unknown, unknown>,
  PoliticalBetaSpec as unknown as DatasetSpec<unknown, unknown>,
  PatentSpec as unknown as DatasetSpec<unknown, unknown>,
  GovContractSpec as unknown as DatasetSpec<unknown, unknown>,
  ThirteenFHoldingSpec as unknown as DatasetSpec<unknown, unknown>,
  OffExchangeActivitySpec as unknown as DatasetSpec<unknown, unknown>,
  InsiderTradeSpec as unknown as DatasetSpec<unknown, unknown>,
];
