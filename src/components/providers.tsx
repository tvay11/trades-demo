"use client";

import { NuqsAdapter } from "nuqs/adapters/next/app";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <NuqsAdapter>{children}</NuqsAdapter>
    </NextThemesProvider>
  );
}
