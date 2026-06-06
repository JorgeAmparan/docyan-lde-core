"""
Super-Admin de Plataforma DOCYAN (F2 backend).

Consola del fundador (`platform_admin`): observabilidad y operación de la
plataforma completa. Modelo de seguridad cerrado (Sprint F2):

  · `platform_admin` es un rol especial FUERA de la jerarquía de tenant, con
    identidad/JWT propios (tabla `platform_admins`, fuera del RLS de tenant).
  · **metadata SÍ, contenido NO**: ningún endpoint `/platform/*` devuelve texto de
    documentos, texto de consultas, ni contenido de grafos. Solo conteos, pesos,
    estados y agregados.
  · **frecuencia sí, causa no**: las métricas reportan volumen/frecuencia, nunca
    infieren decisiones ni razones causales.
  · toda acción mutante de plataforma se audita en el FAT.
"""
