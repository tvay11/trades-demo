import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { Suspense } from "react";

import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { Providers } from "@/components/providers";

const darkReaderHydrationCleanup = `
(() => {
  const darkReaderAttributes = [
    "data-darkreader-inline-bgcolor",
    "data-darkreader-inline-border",
    "data-darkreader-inline-boxshadow",
    "data-darkreader-inline-color",
    "data-darkreader-inline-fill",
    "data-darkreader-inline-outline",
    "data-darkreader-inline-stroke"
  ];
  const darkReaderProperties = [
    "--darkreader-inline-bgcolor",
    "--darkreader-inline-border",
    "--darkreader-inline-boxshadow",
    "--darkreader-inline-color",
    "--darkreader-inline-fill",
    "--darkreader-inline-outline",
    "--darkreader-inline-stroke"
  ];

  document.querySelectorAll("svg").forEach((icon) => {
    darkReaderAttributes.forEach((attribute) => icon.removeAttribute(attribute));
    darkReaderProperties.forEach((property) => icon.style.removeProperty(property));
    if (icon.getAttribute("style") === "") {
      icon.removeAttribute("style");
    }
  });

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      const target = mutation.target instanceof SVGElement ? mutation.target : null;
      if (target) {
        darkReaderAttributes.forEach((attribute) => target.removeAttribute(attribute));
        darkReaderProperties.forEach((property) => target.style.removeProperty(property));
        if (target.getAttribute("style") === "") {
          target.removeAttribute("style");
        }
      }

      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        const icons = node instanceof SVGElement ? [node] : Array.from(node.querySelectorAll("svg"));
        icons.forEach((icon) => {
          darkReaderAttributes.forEach((attribute) => icon.removeAttribute(attribute));
          darkReaderProperties.forEach((property) => icon.style.removeProperty(property));
          if (icon.getAttribute("style") === "") {
            icon.removeAttribute("style");
          }
        });
      });
    });
  });

  observer.observe(document.documentElement, {
    attributeFilter: ["style", ...darkReaderAttributes],
    attributes: true,
    childList: true,
    subtree: true
  });
  window.addEventListener("load", () => window.setTimeout(() => observer.disconnect(), 3000), {
    once: true
  });
})();
`;

const geist = Geist({ variable: "--font-geist", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "Dashboard",
    template: "%s",
  },
  description:
    "A premium financial terminal for tracking alternative data signals.",
};

export const viewport: Viewport = {
  colorScheme: "dark light",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable} dark h-full bg-background text-foreground`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground">
        <Providers>
          <Suspense fallback={<div className="min-h-dvh bg-background" />}>
            <AppShell>
              {children}
            </AppShell>
          </Suspense>
        </Providers>
        <Script
          id="darkreader-hydration-cleanup"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: darkReaderHydrationCleanup }}
        />
      </body>
    </html>
  );
}
