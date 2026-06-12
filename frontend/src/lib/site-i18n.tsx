"use client";

/**
 * DOCYAN sitio público v2 — estado de idioma + banda (F3 §B).
 *
 * Idioma (es/en) y banda de precio (A/B/C) como estado global del sitio público,
 * persistido en cookie + localStorage; la geolocalización (o el locale de ruteo
 * `/mx` `/us`) preselecciona ambos; siempre ajustables. El onboarding hereda banda
 * e idioma de la misma cookie.
 *
 * i18n: copy ES/EN consistente por vista vía `useT()` → `t({es,en})`, ligado al
 * idioma global (no mezcla por vista). Es la misma capa i18n del prototipo,
 * conectada al estado global; el chrome (nav/footer) y las páginas comparten el
 * toggle. (react-i18next sigue sirviendo a la app autenticada por separado.)
 */
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { type BandKey, DEFAULT_BAND, bandFromLocale } from "./bands";

export type Lang = "es" | "en";

export interface Bilingual {
  es: string;
  en: string;
}

const COOKIE = "docyan_site";
const DAY = 60 * 60 * 24;

interface SiteState {
  lang: Lang;
  band: BandKey;
  setLang: (l: Lang) => void;
  setBand: (b: BandKey) => void;
}

const Ctx = createContext<SiteState>({
  lang: "es", band: DEFAULT_BAND, setLang: () => {}, setBand: () => {},
});

function persist(lang: Lang, band: BandKey) {
  if (typeof document === "undefined") return;
  try {
    document.cookie = `${COOKIE}=${lang}.${band};path=/;max-age=${DAY * 180};samesite=lax`;
    localStorage.setItem(COOKIE, `${lang}.${band}`);
  } catch {
    /* almacenamiento no disponible: el estado vive en memoria */
  }
}

function readInitial(): { lang: Lang; band: BandKey } {
  if (typeof document === "undefined") return { lang: "es", band: DEFAULT_BAND };
  // 1) cookie/localStorage previos.
  try {
    const raw =
      localStorage.getItem(COOKIE) ||
      document.cookie.split("; ").find((c) => c.startsWith(`${COOKIE}=`))?.split("=")[1];
    if (raw) {
      const [l, b] = raw.split(".");
      if ((l === "es" || l === "en") && (b === "A" || b === "B" || b === "C")) {
        return { lang: l, band: b };
      }
    }
  } catch {
    /* ignore */
  }
  // 2) locale de ruteo (/mx, /us…) en el primer segmento de la URL.
  const seg = window.location.pathname.split("/")[1];
  const band = bandFromLocale(seg) ?? DEFAULT_BAND;
  const lang: Lang = navigator.language?.toLowerCase().startsWith("en") ? "en" : "es";
  return { lang, band };
}

export function SiteLangProvider({
  children,
  initialBand,
  initialLang,
}: {
  children: React.ReactNode;
  initialBand?: BandKey;
  initialLang?: Lang;
}) {
  const [lang, setLangState] = useState<Lang>(initialLang ?? "es");
  const [band, setBandState] = useState<BandKey>(initialBand ?? DEFAULT_BAND);

  // Hidrata del cliente tras el montaje (evita mismatch SSR; el server no conoce el
  // cookie aquí). setState-en-effect es el patrón correcto: lang/band derivan de
  // cookie/localStorage/geo, disponibles sólo en cliente; el primer render usa los
  // defaults (es/A) para casar con el SSR y se ajusta al montar.
  useEffect(() => {
    const init = readInitial();
    /* eslint-disable react-hooks/set-state-in-effect */
    setLangState((prev) => (initialLang ? prev : init.lang));
    setBandState((prev) => (initialBand ? prev : init.band));
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLang = useCallback((l: Lang) => { setLangState(l); persist(l, band); }, [band]);
  const setBand = useCallback((b: BandKey) => { setBandState(b); persist(lang, b); }, [lang]);

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = lang;
  }, [lang]);

  return <Ctx.Provider value={{ lang, band, setLang, setBand }}>{children}</Ctx.Provider>;
}

export function useSite(): SiteState {
  return useContext(Ctx);
}

/** `t({es,en})` ligado al idioma global del sitio. Consistente por vista. */
export function useT(): (o: Bilingual) => string {
  const { lang } = useSite();
  return useCallback((o: Bilingual) => (o ? o[lang] ?? o.es : ""), [lang]);
}

export function useBand() {
  const { band, setBand } = useSite();
  return { band, setBand };
}
