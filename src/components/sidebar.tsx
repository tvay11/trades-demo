"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  Building2,
  Database,
  Filter,
  Info,
  PanelLeftClose,
  PanelLeftOpen,
  Share2,
  ShieldCheck,
  Star,
  Table2,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon };

const NAV_SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: "",
    items: [
      { href: "/", label: "Dashboard", icon: BarChart3 },
      { href: "/trades", label: "Trades", icon: Table2 },
      { href: "/politicians", label: "Politicians", icon: Users },
      { href: "/stocks", label: "Stocks", icon: Building2 },
      { href: "/screener", label: "Screener", icon: Filter },
      { href: "/watchlist", label: "Watchlist", icon: Star },
    ],
  },
  {
    label: "Analysis",
    items: [
      { href: "/analysis", label: "Analysis", icon: Activity },
      { href: "/relationships", label: "Relationships", icon: Share2 },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/datasets", label: "Datasets", icon: Database },
      { href: "/admin/data-health", label: "Data Health", icon: ShieldCheck },
      { href: "/about", label: "About", icon: Info },
    ],
  },
];

function SidebarContent({
  collapsed,
  onCollapseToggle,
  onClose,
}: {
  collapsed: boolean;
  onCollapseToggle?: () => void;
  onClose?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-transparent text-sidebar-foreground">
      {/* Header — icon mark + pulse dot */}
      <div className="flex h-11 items-center gap-3 border-b border-sidebar-border px-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-sm border border-sky-900/50 bg-sky-950/20">
          <Activity className="size-4 text-sky-400" />
        </div>
        {!collapsed ? (
          <div className="flex items-center gap-2">
            <span className="sidebar-pulse-dot" />
            <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground">
              live
            </span>
          </div>
        ) : null}
        {onClose ? (
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </div>

      {/* Navigation — grouped sections */}
      <nav className="flex-1 overflow-y-auto p-2">
        {NAV_SECTIONS.map((section, sectionIndex) => (
          <div key={section.label || "core"}>
            {/* Section divider label (skip for first group) */}
            {section.label && !collapsed ? (
              <div className="sidebar-section-label">
                {section.label}
              </div>
            ) : section.label && collapsed ? (
              <div className="mx-auto my-2 h-px w-6 bg-border" />
            ) : null}

            {/* Add top spacing for non-first groups when there's no label shown */}
            {sectionIndex > 0 && !section.label ? (
              <div className="mt-2" />
            ) : null}

            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "sidebar-nav-item group relative flex h-8 items-center gap-3 rounded-sm px-3 font-mono text-[0.74rem] font-medium uppercase tracking-[0.08em] transition-all duration-150",
                      active
                        ? "sidebar-nav-item-active bg-sky-950/15 text-sky-300"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                      collapsed && "justify-center px-0",
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    {/* Active left accent bar */}
                    {active ? (
                      <span className="absolute inset-y-1 left-0 w-[3px] rounded-full bg-sky-400" />
                    ) : null}
                    <Icon
                      className={cn(
                        "size-4 shrink-0 transition-colors",
                        active
                          ? "text-sky-400"
                          : "text-muted-foreground group-hover:text-foreground",
                      )}
                    />
                    {!collapsed ? (
                      <span className="truncate">{item.label}</span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-2.5">
        <div className={cn("flex items-center gap-2", collapsed && "justify-center")}>
          <ThemeToggle collapsed={collapsed} />
          {onCollapseToggle ? (
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:inline-flex"
              onClick={onCollapseToggle}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <PanelLeftOpen className="size-4" />
              ) : (
                <PanelLeftClose className="size-4" />
              )}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function Sidebar({
  mobileOpen,
  onMobileOpenChange,
}: {
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      <motion.aside
        animate={{ width: collapsed ? 72 : 236 }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
        className="fixed inset-y-0 left-0 z-40 hidden overflow-hidden border-r border-sidebar-border bg-sidebar lg:block"
      >
        <SidebarContent
          collapsed={collapsed}
          onCollapseToggle={() => setCollapsed((current) => !current)}
        />
      </motion.aside>

      <AnimatePresence>
        {mobileOpen ? (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => onMobileOpenChange(false)}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 w-[286px] overflow-hidden border-r border-sidebar-border bg-sidebar lg:hidden"
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", stiffness: 330, damping: 32 }}
            >
              <SidebarContent
                collapsed={false}
                onClose={() => onMobileOpenChange(false)}
              />
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}
