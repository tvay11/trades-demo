"use client";

import { useEffect, useState } from "react";
import { Moon, User, Shield, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "general", label: "General", icon: User },
  { id: "security", label: "Security", icon: Shield },
  { id: "notifications", label: "Notifications", icon: Bell },
];

function Toggle({ enabled, onToggle, label, description }: { enabled: boolean; onToggle: () => void; label: string; description: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-zinc-800/70 bg-zinc-900/40 p-4 transition-colors hover:border-zinc-700/60">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={onToggle}
        className={cn(
          "relative h-6 w-11 rounded-full transition-colors duration-200",
          enabled ? "bg-sky-500" : "bg-zinc-800"
        )}
      >
        <span
          className={cn(
            "absolute left-0.5 top-0.5 size-5 rounded-full bg-zinc-100 shadow-sm transition-transform duration-200",
            enabled && "translate-x-5"
          )}
        />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("general");
  const [mounted, setMounted] = useState(false);
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [pushNotifs, setPushNotifs] = useState(false);
  const [twoFactor, setTwoFactor] = useState(false);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  return (
    <main className="qq-page max-w-5xl">
      <div className="mb-4 space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">
          <span className="text-zinc-100">Settings</span>
        </h1>
        <p className="font-mono text-xs text-muted-foreground">
          Manage your preferences and account settings
        </p>
      </div>

      <div className="flex flex-col gap-4 md:flex-row">
        <nav className="flex flex-row gap-1 md:w-48 md:flex-col md:flex-shrink-0">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  activeTab === tab.id
                    ? "border-sky-900/50 bg-sky-950/20 text-sky-400"
                    : "border-transparent text-muted-foreground hover:border-zinc-800 hover:bg-zinc-900/40 hover:text-foreground"
                )}
              >
                <Icon className="size-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="flex-1 space-y-6">
          {activeTab === "general" && (
            <div className="space-y-6">
              <div className="qq-panel p-4">
                <h3 className="mb-4 font-mono text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Profile</h3>
                <div className="flex items-center gap-4">
                  <div className="flex size-16 cursor-pointer items-center justify-center rounded-md border border-dashed border-zinc-800 bg-zinc-950/40 text-muted-foreground transition-colors hover:border-sky-900/60 hover:text-sky-400">
                    <User className="size-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Profile picture</p>
                    <p className="text-xs text-muted-foreground">Click to upload a photo</p>
                  </div>
                </div>
              </div>

              <div className="qq-panel p-4">
                <h3 className="mb-4 font-mono text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Appearance</h3>
                {mounted && (
                  <div className="rounded-md border border-sky-900/40 bg-sky-950/15 p-4">
                    <div className="flex items-center gap-3">
                      <Moon className="size-5 text-sky-400" />
                      <div>
                        <p className="text-sm font-medium text-zinc-100">Dark terminal</p>
                        <p className="mt-1 font-mono text-xs text-zinc-500">
                          The workspace is locked to the institutional terminal skin.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div className="space-y-3">
              <Toggle
                enabled={twoFactor}
                onToggle={() => setTwoFactor((v) => !v)}
                label="Two-factor authentication"
                description="Add an extra layer of security to your account"
              />
              <div className="space-y-3 rounded-md border border-zinc-800/70 bg-zinc-900/40 p-4">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Change password</p>
                  <p className="text-xs text-muted-foreground">Update your account password</p>
                </div>
                <button className="rounded-md border border-sky-900/50 bg-sky-950/20 px-4 py-2 font-mono text-xs font-semibold text-sky-400 transition-colors hover:border-sky-800 hover:text-sky-300">
                  Update password
                </button>
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="space-y-3">
              <Toggle
                enabled={emailNotifs}
                onToggle={() => setEmailNotifs((v) => !v)}
                label="Email notifications"
                description="Receive trade alerts and weekly summaries via email"
              />
              <Toggle
                enabled={pushNotifs}
                onToggle={() => setPushNotifs((v) => !v)}
                label="Push notifications"
                description="Get instant alerts when new trades are disclosed"
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
