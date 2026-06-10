/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      // C1 (F3): la etiqueta pública es "Sectores"; el slug canónico sigue siendo
      // /verticales. /sectores redirige (301) para que el término no rompa enlaces.
      { source: "/sectores", destination: "/verticales", permanent: true },
      { source: "/sectores/:slug", destination: "/verticales/:slug", permanent: true },
      // §F: rutas del sitio viejo que cambiaron o desaparecieron en v2 (301).
      { source: "/verticales/agencias", destination: "/verticales", permanent: true },
      { source: "/verticales/pharma", destination: "/verticales", permanent: true },
      { source: "/verticales/mining", destination: "/verticales", permanent: true },
      { source: "/verticales/agribusiness", destination: "/verticales", permanent: true },
      { source: "/verticales/maquiladoras", destination: "/verticales/maquila", permanent: true },
      // /legal histórico → aviso de privacidad (temporal hasta publicar el definitivo).
      { source: "/legal", destination: "/privacidad", permanent: false },
    ];
  },
};

export default nextConfig;
