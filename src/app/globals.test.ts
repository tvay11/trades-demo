// @vitest-environment node

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("app ledger design tokens", () => {
  const css = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");

  it("defines report-inspired semantic app classes", () => {
    expect(css).toContain(".ledger-page-title");
    expect(css).toContain(".ledger-util");
    expect(css).toContain(".ledger-section-line");
    expect(css).toContain(".ledger-stamp");
    expect(css).toContain(".ledger-callout");
    expect(css).toContain(".ledger-signal-strip");
    expect(css).toContain(".ledger-field");
    expect(css).toContain(".ledger-menu");
    expect(css).toContain(".ledger-empty");
    expect(css).toContain(".ledger-filter-strip");
  });

  it("keeps app panels sharper and flatter than the old glass terminal surface", () => {
    expect(css).toContain(".qq-panel");
    expect(css).toContain("border-zinc-700/70");
    expect(css).toContain("bg-zinc-950/55");
    expect(css).not.toContain("backdrop-blur-md transition-all duration-200 hover:border-zinc-700/50");
  });

  it("does not draw left-side inset accent rules on ledger panels", () => {
    expect(css).not.toContain("shadow-[inset_");
  });

  it("uses neutral blue accents instead of a green terminal theme in shared tokens", () => {
    expect(css).not.toContain("emerald");
    expect(css).not.toContain("#34d399");
    expect(css).not.toContain("#10b981");
    expect(css).toContain("--primary: #38bdf8");
    expect(css).toContain("html.light");
  });

  it("matches the report page light background on shared light-mode surfaces", () => {
    expect(css).toContain("--background: #f7f3e9");
    expect(css).toContain("--sidebar: #f7f3e9");
    expect(css).toContain("--foreground: #1a1714");
    expect(css).toContain("--card: #fffdf7");
    expect(css).toContain("--accent: #efe6d2");
    expect(css).toContain("--surface-hover: rgb(239 230 210 / 0.72)");
  });

  it("remaps dark utility interaction states to light-mode surface colors", () => {
    expect(css).toContain('html.light [class~="hover:bg-zinc-900/70"]:hover');
    expect(css).toContain('html.light [class~="aria-expanded:bg-zinc-900/70"][aria-expanded="true"]');
    expect(css).toContain('html.light [class~="data-[state=selected]:bg-zinc-900/60"][data-state="selected"]');
    expect(css).toContain("background-color: var(--surface-hover)");
  });

  it("remaps highlighted blue states and dark hover text in light mode", () => {
    expect(css).toContain('html.light [class~="data-highlighted:bg-sky-950/25"][data-highlighted]');
    expect(css).toContain('html.light [class~="data-selected:bg-sky-950/25"][data-selected]');
    expect(css).toContain("background-color: var(--primary-soft-hover)");
    expect(css).toContain('html.light [class~="hover:text-zinc-100"]:hover');
  });
});
