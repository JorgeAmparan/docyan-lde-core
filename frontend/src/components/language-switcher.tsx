"use client";

import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const LANGS: { code: string; label: string }[] = [
  { code: "es", label: "Español" },
  { code: "es-MX", label: "Español (MX)" },
  { code: "es-CO", label: "Español (CO)" },
  { code: "es-AR", label: "Español (AR)" },
  { code: "en", label: "English" },
  { code: "en-US", label: "English (US)" },
  { code: "en-UK", label: "English (UK)" },
  { code: "en-AU", label: "English (AU)" },
];

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="region" aria-label="Cambiar idioma">
          <Languages size={13} strokeWidth={1.75} />
          {current.startsWith("en") ? "EN" : "ES"}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LANGS.map((l) => (
          <DropdownMenuItem key={l.code} onSelect={() => i18n.changeLanguage(l.code)} data-active={current === l.code}>
            {l.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
