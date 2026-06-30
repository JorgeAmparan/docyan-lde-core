/* DOCYAN — i18n runtime. t({es, en}) lee window.__LANG (puesto por el harness en
   cada render). Cambiar idioma re-renderiza el árbol → t() relee el valor nuevo.
   El swap ES/EN es del COLABORADOR (usuario multilingüe del brief: piso, ES-MX/EN-US);
   el admin opera en el idioma de la organización. La misma infra sirve para el admin. */
window.__LANG = window.__LANG || "es";
function t(o) { if (o == null || typeof o !== "object") return o; const l = window.__LANG || "es"; return (l in o) ? o[l] : o.es; }
Object.assign(window, { t });
