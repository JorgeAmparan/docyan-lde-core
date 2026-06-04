"use client";

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import esCommon from "./locales/es/common.json";
import esLanding from "./locales/es/landing.json";
import esPricing from "./locales/es/pricing.json";
import enCommon from "./locales/en/common.json";
import enLanding from "./locales/en/landing.json";
import enPricing from "./locales/en/pricing.json";

export const NAMESPACES = [
  "common",
  "landing",
  "pricing",
  "signup",
  "account",
  "pwa",
  "admin",
  "consult",
  "playbook",
] as const;

/**
 * ES (default) + EN, with regional variants that fall back to the base language:
 * es-MX/es-CO/es-AR → es, en-US/en-UK/en-AU → en. Voice: tú in all Spanish.
 */
export const resources = {
  es: { common: esCommon, landing: esLanding, pricing: esPricing },
  en: { common: enCommon, landing: enLanding, pricing: enPricing },
} as const;

export const SUPPORTED_LNGS = [
  "es", "es-MX", "es-CO", "es-AR",
  "en", "en-US", "en-UK", "en-AU",
] as const;

if (!i18n.isInitialized) {
  void i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      fallbackLng: {
        "es-MX": ["es"], "es-CO": ["es"], "es-AR": ["es"],
        "en-US": ["en"], "en-UK": ["en"], "en-AU": ["en"],
        default: ["es"],
      },
      supportedLngs: [...SUPPORTED_LNGS],
      nonExplicitSupportedLngs: true,
      load: "all",
      defaultNS: "common",
      ns: ["common", "landing", "pricing"],
      interpolation: { escapeValue: false },
      detection: {
        order: ["localStorage", "cookie", "navigator", "htmlTag"],
        caches: ["localStorage", "cookie"],
      },
    });
}

export default i18n;
