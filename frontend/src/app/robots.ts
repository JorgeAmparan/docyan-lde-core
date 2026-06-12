import type { MetadataRoute } from "next";

/** robots.txt (F3 §F). Indexa el sitio público; excluye la app autenticada y la
 *  consola de plataforma. Apunta al sitemap. */
const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://docyan-lde.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/consult", "/admin", "/cuenta", "/platform", "/onboarding", "/q/"],
    },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
