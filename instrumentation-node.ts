// Node-only server bootstrap. Imported from instrumentation.ts when the
// runtime is nodejs; the indirection keeps node:* imports out of the Edge
// bundle so Turbopack doesn't warn about "module not supported in Edge
// Runtime".

import { setDefaultResultOrder } from "node:dns";

// Force IPv4-first DNS lookups for outbound fetches.
//
// Node 18+ defaults `dns.lookup` to "verbatim" order, which on some Windows
// dev setups returns AAAA (IPv6) records first. Several upstreams we hit
// (Yahoo Finance for quoteSummary/earnings, TickerPriceCache price fetches,
// Turso libSQL) have flaky IPv6 paths but reliable IPv4 paths, so the first
// connection times out with the generic "fetch failed" error before Node
// tries v4. Forcing ipv4first sidesteps that without breaking IPv6-only
// hosts — Node still falls back to v6 if no v4 record exists.
setDefaultResultOrder("ipv4first");
