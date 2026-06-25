"use client";

import { Menu, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { CommandSearch } from "@/components/command-search";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ROUTE_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/trades": "Trades",
  "/politicians": "Politicians",
  "/datasets": "Datasets",
  "/analysis": "Analysis",
  "/analysis/edges": "Edges",
  "/analysis/dark-flow": "Dark Flow",
  "/analysis/long-short": "Long Short",
  "/analysis/stocks": "Stocks",
  "/watchlist": "Watchlist",
  "/admin": "Admin",
  "/admin/data-health": "Data Health",
  "/about": "About",
};

function breadcrumbs(pathname: string) {
  if (pathname === "/") return [{ label: "Dashboard", href: "/" }];

  const segments = pathname.split("/").filter(Boolean);
  let href = "";

  return segments.map((segment) => {
    href += `/${segment}`;
    const label =
      ROUTE_LABELS[href] ??
      decodeURIComponent(segment)
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    return { label, href };
  });
}

export function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isDemo = pathname === "/demo";
  const crumbs = useMemo(() => breadcrumbs(pathname), [pathname]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", handler, { passive: true });
    handler();
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setMobileOpen(false));
    return () => window.cancelAnimationFrame(id);
  }, [pathname]);

  if (pathname.startsWith("/report")) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {!isDemo && <Sidebar mobileOpen={mobileOpen} onMobileOpenChange={setMobileOpen} />}
      <CommandSearch open={commandOpen} onOpenChange={setCommandOpen} />

      <div className={cn(!isDemo && "lg:pl-[236px]")}>
        <header
          className={cn(
            "ledger-util sticky top-0 z-30 transition-colors duration-150",
            scrolled
              ? "bg-background"
              : "bg-background/95",
          )}
        >
          <div className="flex h-10 items-center gap-3 px-3 sm:px-4">
            {!isDemo && (
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation"
              >
                <Menu className="size-4" />
              </Button>
            )}

            <nav
              aria-label="Breadcrumb"
              className="hidden min-w-0 items-center gap-1.5 font-mono text-[0.68rem] uppercase tracking-[0.12em] sm:flex"
            >
              {crumbs.map((crumb, index) => (
                <span key={crumb.href} className="flex min-w-0 items-center gap-1.5">
                  {index > 0 ? (
                    <span className="font-mono text-muted-foreground/40">/</span>
                  ) : null}
                  <span
                    className={cn(
                      "truncate",
                      index === crumbs.length - 1
                        ? "font-medium text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {crumb.label}
                  </span>
                </span>
              ))}
            </nav>

            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              className="ledger-search ml-auto hidden h-7 min-w-[280px] items-center gap-2 rounded-sm border border-border bg-input px-2.5 text-left font-mono text-[0.7rem] text-muted-foreground transition hover:border-sky-500/50 hover:bg-accent md:flex"
            >
              <Search className="size-3.5 text-muted-foreground" />
              <span className="flex-1">Search trades, tickers, politicians</span>
              <kbd className="rounded-sm border border-border bg-background/70 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                Ctrl K
              </kbd>
            </button>

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setCommandOpen(true)}
              aria-label="Open search"
            >
              <Search className="size-4" />
            </Button>
          </div>
        </header>

        <div className="min-h-[calc(100dvh-2.5rem)]">{children}</div>
      </div>
    </div>
  );
}
