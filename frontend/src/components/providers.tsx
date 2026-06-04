"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { useApplyTheme } from "@/lib/theme";
import { PwaRegister } from "./pwa-register";
import "@/i18n/config";

function ThemeBridge() {
  useApplyTheme();
  return null;
}

/** App-wide providers: React Query (server cache), theme, toasts, i18n init. */
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <ThemeBridge />
      <PwaRegister />
      {children}
      <Toaster position="top-center" toastOptions={{ style: { fontFamily: "var(--font-sans)" } }} />
    </QueryClientProvider>
  );
}
