"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_REGION, type RegionKey } from "./pricing";

interface RegionState {
  region: RegionKey;
  /** false until geo-IP/locale detection has run once (so manual choice sticks). */
  detected: boolean;
  setRegion: (region: RegionKey) => void;
  detect: (region: RegionKey) => void;
}

/**
 * Active commercial region drives every figure/currency on the pricing page and
 * the signup summary. Defaults to MX, geo-detected on first load, user-overridable.
 */
export const useRegion = create<RegionState>()(
  persist(
    (set, get) => ({
      region: DEFAULT_REGION,
      detected: false,
      setRegion: (region) => set({ region, detected: true }),
      detect: (region) => {
        if (!get().detected) set({ region, detected: true });
      },
    }),
    { name: "docyan-region" },
  ),
);
