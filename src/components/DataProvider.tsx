"use client";

// SWR global settings (client-only provider).

import { SWRConfig } from "swr";

export function SwrSettings({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        errorRetryCount: 2,
        dedupingInterval: 2_000,
        focusThrottleInterval: 10_000,
        keepPreviousData: true,
      }}
    >
      {children}
    </SWRConfig>
  );
}
