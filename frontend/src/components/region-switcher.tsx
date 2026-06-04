"use client";

import { useEffect } from "react";
import { Globe } from "lucide-react";
import { useRegion } from "@/lib/region-store";
import { REGION_KEYS, regionFromCountry, type RegionKey } from "@/lib/pricing";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/** Region pill + dropdown. On first mount, geo-detects via locale (no extra
 *  network) and sets the default region unless the user already chose one. */
export function RegionSwitcher({ withLang = true }: { withLang?: boolean }) {
  const region = useRegion((s) => s.region);
  const detect = useRegion((s) => s.detect);
  const setRegion = useRegion((s) => s.setRegion);

  useEffect(() => {
    // Locale-based region hint (e.g. "es-MX" → MX). Cheap, client-only.
    const loc = typeof navigator !== "undefined" ? navigator.language : "";
    const cc = loc.split("-")[1];
    detect(regionFromCountry(cc));
  }, [detect]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="region" aria-label="Cambiar región">
          <Globe size={13} strokeWidth={1.75} />
          {region}
          {withLang && " · ES"}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {REGION_KEYS.map((k: RegionKey) => (
          <DropdownMenuItem key={k} onSelect={() => setRegion(k)} data-active={k === region}>
            {k}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
