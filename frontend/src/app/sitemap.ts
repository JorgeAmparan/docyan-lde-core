import type { MetadataRoute } from "next";

/** Sitemap del sitio público v2 (F3 §F). Las rutas comerciales canónicas + detalle
 *  de verticales (lab/maquila/flotillas). El dominio se toma de NEXT_PUBLIC_SITE_URL. */
const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://docyan-lde.vercel.app";

const ROUTES = [
  "", "/producto", "/como-funciona", "/verticales",
  "/verticales/laboratorios", "/verticales/maquila", "/verticales/flotillas",
  "/seguridad", "/precios", "/demo", "/legal",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((path) => ({
    url: `${BASE}${path}`,
    changeFrequency: "weekly",
    priority: path === "" ? 1 : 0.7,
  }));
}
