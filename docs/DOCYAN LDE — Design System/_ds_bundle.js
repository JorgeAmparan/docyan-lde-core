/* @ds-bundle: {"format":3,"namespace":"DOCYANLDEDesignSystem_1b0eb9","components":[],"sourceHashes":{"app/admin-mobile.jsx":"1ef8fb1732c6","app/answers.jsx":"3749bf867fe2","app/colab-mobile.jsx":"21d00e693837","app/colab.jsx":"a579ab885c87","app/consult.jsx":"950b0e3c5f32","app/data.jsx":"fec3a2b83011","app/demo-showcase.jsx":"83d4aca43902","app/entry.jsx":"ba36272e4d6e","app/expediente.jsx":"35d5981c9587","app/i18n.jsx":"32450b56385d","app/org-views.jsx":"fedafbdd7eeb","app/org.jsx":"9ba6cd284cf2","app/parts.jsx":"74e3c57910b5","app/playbook.jsx":"54ddcf193c06","app/resumen.jsx":"8f7968f0a152","app/schemas.jsx":"dfdcacc18058","app/source-viewer.jsx":"2f0429970977","app/ui-kit.jsx":"14af1efe8752","app/wizard.jsx":"e1fd4cc86b10","ui_kits/commercial-v2/app.jsx":"64d868480afe","ui_kits/commercial-v2/codo-data.jsx":"8c470f46c471","ui_kits/commercial-v2/codos.jsx":"2573a41dc4f7","ui_kits/commercial-v2/como.jsx":"64513aaec908","ui_kits/commercial-v2/demo.jsx":"56796f59217b","ui_kits/commercial-v2/home.jsx":"953935e323de","ui_kits/commercial-v2/precios.jsx":"078f0b9af9ec","ui_kits/commercial-v2/producto.jsx":"6b55d4e9f483","ui_kits/commercial-v2/seguridad.jsx":"526d369425b5","ui_kits/commercial-v2/shared.jsx":"c251765f047b","ui_kits/commercial-v2/tweaks-panel.jsx":"6591467622ed","ui_kits/commercial-v2/verticales.jsx":"ae9d5615a1b1","ui_kits/platform/access.jsx":"c09555fedaa3","ui_kits/platform/app.jsx":"2dec96676620","ui_kits/platform/atoms.jsx":"5c5b9129743a","ui_kits/platform/data.jsx":"aea31f7aa9fb","ui_kits/platform/ingresos.jsx":"048f253c6b97","ui_kits/platform/jobs.jsx":"355b81e046cb","ui_kits/platform/orgs.jsx":"a97855d16177","ui_kits/platform/resumen.jsx":"85709f63d3af","ui_kits/platform/support.jsx":"9a3de04b6fc1"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.DOCYANLDEDesignSystem_1b0eb9 = window.DOCYANLDEDesignSystem_1b0eb9 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// app/admin-mobile.jsx
try { (() => {
/* DOCYAN — ADMIN DE BOLSILLO (breakpoint angosto de la organización).
   NO es el panel de escritorio encogido: es un subconjunto curado de acciones
   urgentes y atómicas + la consulta/escaneo (el admin también consume).
   Comparte la gramática móvil; tiene sus propios componentes.
   Lo profundo (Crear CoDo, consola de Ingesta, Gobernanza & FAT, QRs, Resumen,
   Usuarios, Plan) redirige a escritorio. */

const ADMIN_GLANCE = [["86%", "Hit-rate caché"], ["$0.011", "Costo / consulta"], ["38", "Consultas hoy"]];
const ADMIN_ALERTS_M = [["warn", "Por vencer · ≤ 7 días", "Calibración — Mezcladora MAXI-10ND", "CODO-OBR-07", "Vence 02 jul · en 4 días", "CAL-22-117"], ["warn", "Por vencer · ≤ 7 días", "Certificado del operador A. Ríos", "Org", "Venció 28 jun", "CERT-OP-AR"], ["caution", "Próximas · ≤ 30 días", "Cambio de aceite SAE-30 programado", "CODO-OBR-07", "En 22 días", "MTTO-OBR-03"], ["caution", "Próximas · ≤ 30 días", "MSDS refrigerante — Centrífuga", "CODO-LAB-04", "Expira 25 jul · en 27 días", "MSDS-REF-03"]];
const DESK_ONLY = [["folder-plus", "Crear CoDo", "Nombrar entidad, vincular acervo, generar QR"], ["upload-cloud", "Consola de ingesta", "Cola, cotización por documento, cupo del plan, reintentos"], ["shield-check", "Gobernanza & FAT", "Umbrales GRG, cuarentena, bitácora, exportes"], ["qr-code", "Generar lotes de QR", "Imprimir placas y etiquetas físicas"], ["layout-dashboard", "Resumen completo", "Métricas PCL, patrones, balance de ingesta"], ["users", "Usuarios & asientos", "Roster completo, costos de seat, facturación"]];
/* Freemium: subconjunto del subconjunto */
const DESK_FREE = [["files", "Gestionar documentos", "Subir, organizar y vincular tu acervo (hasta 3)"], ["users", "Usuarios", "Invitar admins y colaboradores"], ["gem", "Plan", "Tu uso y opciones de Profesional"]];
const PRO_LOCKED = [["bell", "Alertas administrativas", "Calibración, certificados y MSDS por vencer"], ["shield-check", "Gobernanza & FAT", "Umbrales de confianza y bitácora auditable"], ["qr-code", "Generar QRs", "Etiquetas persistentes para tus equipos"], ["sparkles", "Patrones & inteligencia", "Rutinas y conocimiento recurrente detectados"]];
const FREE_LIMIT = 3,
  FREE_USED = 2,
  FREE_COLABS = 8;

/* ---------- Subir documento rápido (micro-flujo móvil) ---------- */
const SOURCES = [["mail", "Desde el correo", "El PDF que acabas de recibir en tu buzón"], ["folder", "Desde archivos", "Documentos guardados en este dispositivo"], ["camera", "Escanear con la cámara", "Foto de un documento físico (OCR)"]];
function SubirDoc({
  onCancel
}) {
  const [step, setStep] = useState("source");
  const [codoKey, setCodoKey] = useState(null);
  const [seg, setSeg] = useState(2);
  const [pct, setPct] = useState(0);
  const picked = {
    name: "MSDS — Refrigerante R-410A.pdf",
    meta: "pdf · 4 págs · 0.6 MB"
  };
  const codo = CODOS.find(c => c.key === codoKey);
  useEffect(() => {
    if (step !== "progress") return;
    setPct(0);
    const id = setInterval(() => setPct(p => {
      if (p >= 100) {
        clearInterval(id);
        setTimeout(() => setStep("done"), 350);
        return 100;
      }
      return p + 8;
    }), 180);
    return () => clearInterval(id);
  }, [step]);
  return /*#__PURE__*/React.createElement("div", {
    className: "ph-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cons-top"
  }, /*#__PURE__*/React.createElement("button", {
    className: "back-btn",
    onClick: onCancel
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-left",
    size: 18
  })), /*#__PURE__*/React.createElement("div", {
    className: "cons-ctx"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cc"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot"
  }), "ACCI\xD3N R\xC1PIDA"), /*#__PURE__*/React.createElement("div", {
    className: "cnm"
  }, "Subir documento"))), step === "source" && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "sec-lab"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "upload",
    size: 14
  }), "\xBFDe d\xF3nde lo subes?"), SOURCES.map(s => /*#__PURE__*/React.createElement("button", {
    key: s[0],
    className: "src-tile",
    onClick: () => setStep("assign")
  }, /*#__PURE__*/React.createElement("span", {
    className: "sti"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: s[0],
    size: 22
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "stt"
  }, s[1]), /*#__PURE__*/React.createElement("div", {
    className: "stm"
  }, s[2])), /*#__PURE__*/React.createElement("span", {
    className: "car",
    style: {
      marginLeft: "auto",
      color: "var(--fg-subtle)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-right",
    size: 18
  }))))), step === "assign" && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "picked"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pic"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "file-text",
    size: 20
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "pn"
  }, picked.name), /*#__PURE__*/React.createElement("div", {
    className: "pm"
  }, picked.meta))), /*#__PURE__*/React.createElement("div", {
    className: "m-field"
  }, /*#__PURE__*/React.createElement("label", null, "Asignar a un CoDo"), CODOS.map(c => /*#__PURE__*/React.createElement("button", {
    key: c.key,
    className: "m-sel" + (codoKey === c.key ? " on" : ""),
    onClick: () => setCodoKey(c.key),
    style: {
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: c.icon,
    size: 18
  }), /*#__PURE__*/React.createElement("span", {
    className: "ml"
  }, /*#__PURE__*/React.createElement("div", null, c.name), /*#__PURE__*/React.createElement("div", {
    className: "mc"
  }, c.id)), codoKey === c.key && /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 18
  })))), /*#__PURE__*/React.createElement("div", {
    className: "m-field"
  }, /*#__PURE__*/React.createElement("label", null, "Segmento"), /*#__PURE__*/React.createElement("div", {
    className: "seg"
  }, SEGMENTS.map((s, i) => /*#__PURE__*/React.createElement("button", {
    key: s.key,
    className: seg === i ? "on" : "",
    onClick: () => setSeg(i)
  }, s.label.split(" ")[0])))), /*#__PURE__*/React.createElement("button", {
    className: "m-cta",
    disabled: !codoKey,
    onClick: () => setStep("progress")
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "zap",
    size: 17,
    color: "#fff"
  }), "Ingerir ahora"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: "var(--fg-muted)",
      textAlign: "center",
      margin: "12px 4px 0",
      lineHeight: 1.5
    }
  }, "Entra en tu ", /*#__PURE__*/React.createElement("b", null, "cupo del plan"), " \xB7 setup $0. Sobre el cupo se cotiza antes de cobrar. Cobro manual durante el piloto.")), step === "progress" && /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "picked"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pic"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "file-text",
    size: 20
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "pn"
  }, picked.name), /*#__PURE__*/React.createElement("div", {
    className: "pm"
  }, picked.meta))), /*#__PURE__*/React.createElement("div", {
    className: "sec-lab",
    style: {
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "loader",
    size: 14
  }), "Procesando \xB7 ", codo ? codo.id : ""), /*#__PURE__*/React.createElement("div", {
    className: "ingbar"
  }, /*#__PURE__*/React.createElement("i", {
    style: {
      width: pct + "%"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      fontFamily: "var(--font-mono)",
      fontSize: 11.5,
      color: "var(--fg-muted)"
    }
  }, /*#__PURE__*/React.createElement("span", null, pct < 30 ? "Conversión" : pct < 65 ? "Extracción" : pct < 95 ? "Escritura a grafo" : "Deduplicación"), /*#__PURE__*/React.createElement("span", null, pct, "%"))), step === "done" && /*#__PURE__*/React.createElement("div", {
    className: "done-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dc-ic"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 30
  })), /*#__PURE__*/React.createElement("div", {
    className: "dc-t"
  }, "Documento vivo"), /*#__PURE__*/React.createElement("div", {
    className: "dc-m"
  }, "Qued\xF3 disponible en ", /*#__PURE__*/React.createElement("b", null, codo ? codo.name : "el CoDo"), ".", /*#__PURE__*/React.createElement("br", null), "Los colaboradores ya pueden consultarlo con cita a la fuente."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 20,
      display: "flex",
      flexDirection: "column",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "m-cta",
    onClick: onCancel
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 17,
    color: "#fff"
  }), "Listo"), /*#__PURE__*/React.createElement("button", {
    className: "m-cta ghost",
    onClick: () => setStep("source")
  }, "Subir otro documento"))));
}

/* ---------- Alertas (móvil) ---------- */
function AlertasMobile({
  onBack
}) {
  const [read, setRead] = useState([]);
  const groups = [...new Set(ADMIN_ALERTS_M.map(a => a[1]))];
  return /*#__PURE__*/React.createElement("div", {
    className: "ph-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cons-top"
  }, /*#__PURE__*/React.createElement("button", {
    className: "back-btn",
    onClick: onBack
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-left",
    size: 18
  })), /*#__PURE__*/React.createElement("div", {
    className: "cons-ctx"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cc"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot"
  }), "ADMINISTRACI\xD3N"), /*#__PURE__*/React.createElement("div", {
    className: "cnm"
  }, "Alertas"))), /*#__PURE__*/React.createElement("div", {
    className: "admin-banner"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "info",
    size: 15
  }), "Recordatorio administrativo \u2014 no es una instrucci\xF3n operativa. DOCYAN no emite decisiones cl\xEDnicas u operativas."), groups.map(g => /*#__PURE__*/React.createElement("div", {
    key: g
  }, /*#__PURE__*/React.createElement("div", {
    className: "ag-lab"
  }, g), ADMIN_ALERTS_M.map((a, i) => a[1] === g && /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "alert-card s-" + a[0] + (read.includes(i) ? " read" : "")
  }, /*#__PURE__*/React.createElement("div", {
    className: "ah"
  }, /*#__PURE__*/React.createElement("span", {
    className: "aico"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: a[0] === "warn" ? "alarm-clock" : "clock",
    size: 16
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "at"
  }, a[2]), /*#__PURE__*/React.createElement("div", {
    className: "am"
  }, /*#__PURE__*/React.createElement("span", {
    className: "codo-pill"
  }, a[3]), a[4]))), /*#__PURE__*/React.createElement("div", {
    className: "a-cite"
  }, /*#__PURE__*/React.createElement("span", {
    className: "brk"
  }), a[5], " \u2197"), /*#__PURE__*/React.createElement("div", {
    className: "a-acts"
  }, /*#__PURE__*/React.createElement("button", {
    className: read.includes(i) ? "on" : "",
    onClick: () => setRead(r => r.includes(i) ? r.filter(x => x !== i) : [...r, i])
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 14
  }), read.includes(i) ? "Leída" : "Marcar leída"), /*#__PURE__*/React.createElement("button", null, "Posponer"), /*#__PURE__*/React.createElement("button", null, "Asignar")))))));
}

/* ---------- Invitar usuario (móvil) ---------- */
function InviteMobile({
  onBack
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(0);
  const [lang, setLang] = useState(0);
  const [sent, setSent] = useState(false);
  const ROLES = ["Colaborador", "Admin"];
  const LANGS = ["ES-MX", "EN-US"];
  return /*#__PURE__*/React.createElement("div", {
    className: "ph-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cons-top"
  }, /*#__PURE__*/React.createElement("button", {
    className: "back-btn",
    onClick: onBack
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-left",
    size: 18
  })), /*#__PURE__*/React.createElement("div", {
    className: "cons-ctx"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cc"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot"
  }), "ADMINISTRACI\xD3N"), /*#__PURE__*/React.createElement("div", {
    className: "cnm"
  }, "Invitar usuario"))), !sent ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "m-field"
  }, /*#__PURE__*/React.createElement("label", null, "Correo a invitar"), /*#__PURE__*/React.createElement("input", {
    className: "m-input",
    type: "email",
    placeholder: "nombre@laboratorio.mx",
    value: email,
    onChange: e => setEmail(e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    className: "m-field"
  }, /*#__PURE__*/React.createElement("label", null, "Rol"), /*#__PURE__*/React.createElement("div", {
    className: "seg"
  }, ROLES.map((r, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    className: role === i ? "on" : "",
    onClick: () => setRole(i)
  }, r))), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11.5,
      color: "var(--fg-muted)",
      margin: "8px 2px 0",
      lineHeight: 1.4
    }
  }, role === 0 ? "Entra por QR, sin costo. Consulta y guarda." : "Suma un costo de seat según el plan.")), /*#__PURE__*/React.createElement("div", {
    className: "m-field"
  }, /*#__PURE__*/React.createElement("label", null, "Par ling\xFC\xEDstico"), /*#__PURE__*/React.createElement("div", {
    className: "seg"
  }, LANGS.map((l, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    className: lang === i ? "on" : "",
    onClick: () => setLang(i)
  }, l)))), /*#__PURE__*/React.createElement("button", {
    className: "m-cta",
    disabled: !email.trim(),
    onClick: () => setSent(true)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "send",
    size: 16,
    color: "#fff"
  }), "Enviar invitaci\xF3n")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "invite-sent"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check-circle",
    size: 22
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "ist"
  }, "Invitaci\xF3n enviada"), /*#__PURE__*/React.createElement("div", {
    className: "ism"
  }, email, " \xB7 ", ROLES[role], " \xB7 ", LANGS[lang]))), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13.5,
      color: "var(--fg-muted)",
      margin: "16px 4px",
      lineHeight: 1.5
    }
  }, "Recibir\xE1 un enlace para activar su cuenta. Si es colaborador, tambi\xE9n podr\xE1 entrar escaneando el QR de cualquier equipo asignado."), /*#__PURE__*/React.createElement("button", {
    className: "m-cta ghost",
    onClick: () => {
      setSent(false);
      setEmail("");
    }
  }, "Invitar a otra persona"), /*#__PURE__*/React.createElement("button", {
    className: "m-cta",
    style: {
      marginTop: 10
    },
    onClick: onBack
  }, "Listo")));
}

/* ---------- Home (admin de bolsillo) ---------- */
function AdminMobileHome({
  plan,
  openAction,
  openCodo,
  scan,
  openPro,
  alertCount
}) {
  const free = plan === "free";
  const term = free ? "Documentos" : "CoDos";
  return /*#__PURE__*/React.createElement("div", {
    className: "ph-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "greet"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hi"
  }, "Hola, Jorge"), /*#__PURE__*/React.createElement("div", {
    className: "sub"
  }, free ? "Plan gratuito · Laboratorio Estándar" : "Admin · Laboratorio Estándar · resuelve lo urgente desde aquí.")), free ? /*#__PURE__*/React.createElement("div", {
    className: "usage"
  }, /*#__PURE__*/React.createElement("div", {
    className: "us-row"
  }, /*#__PURE__*/React.createElement("span", null, term, " vivos"), /*#__PURE__*/React.createElement("b", null, FREE_USED, " de ", FREE_LIMIT)), /*#__PURE__*/React.createElement("div", {
    className: "us-bar"
  }, /*#__PURE__*/React.createElement("i", {
    style: {
      width: FREE_USED / FREE_LIMIT * 100 + "%"
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "us-foot"
  }, /*#__PURE__*/React.createElement("span", null, FREE_COLABS, " colaboradores \xB7 ilimitados"), /*#__PURE__*/React.createElement("button", {
    className: "us-up",
    onClick: () => openPro("Profesional")
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "gem",
    size: 13
  }), "Subir a Profesional"))) : /*#__PURE__*/React.createElement("div", {
    className: "glance"
  }, ADMIN_GLANCE.map((m, i) => /*#__PURE__*/React.createElement("div", {
    className: "gm",
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    className: "gv"
  }, m[0]), /*#__PURE__*/React.createElement("div", {
    className: "gl"
  }, m[1])))), /*#__PURE__*/React.createElement("div", {
    className: "sec-lab"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "zap",
    size: 14
  }), "Acciones r\xE1pidas"), /*#__PURE__*/React.createElement("div", {
    className: "qa-grid"
  }, /*#__PURE__*/React.createElement("button", {
    className: "qa primary",
    onClick: () => openAction("subir")
  }, /*#__PURE__*/React.createElement("span", {
    className: "qa-ic"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "upload",
    size: 22,
    color: "#fff"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "qa-t"
  }, "Subir documento"), /*#__PURE__*/React.createElement("div", {
    className: "qa-m"
  }, "Vivo en minutos"))), /*#__PURE__*/React.createElement("button", {
    className: "qa",
    onClick: () => openAction("invitar")
  }, /*#__PURE__*/React.createElement("span", {
    className: "qa-ic"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "user-plus",
    size: 22
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "qa-t"
  }, "Invitar usuario"), /*#__PURE__*/React.createElement("div", {
    className: "qa-m"
  }, "Sin ir a la oficina"))), free ? /*#__PURE__*/React.createElement("button", {
    className: "qa upsell",
    onClick: () => openPro("Profesional")
  }, /*#__PURE__*/React.createElement("span", {
    className: "qa-ic"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "gem",
    size: 22
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "qa-t"
  }, "Profesional"), /*#__PURE__*/React.createElement("div", {
    className: "qa-m"
  }, "Alertas, QRs y m\xE1s"))) : /*#__PURE__*/React.createElement("button", {
    className: "qa",
    onClick: () => openAction("alertas")
  }, alertCount > 0 && /*#__PURE__*/React.createElement("span", {
    className: "qa-badge"
  }, alertCount), /*#__PURE__*/React.createElement("span", {
    className: "qa-ic"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "bell",
    size: 22
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "qa-t"
  }, "Alertas"), /*#__PURE__*/React.createElement("div", {
    className: "qa-m"
  }, "Por vencer y pr\xF3ximas"))), /*#__PURE__*/React.createElement("button", {
    className: "qa",
    onClick: scan
  }, /*#__PURE__*/React.createElement("span", {
    className: "qa-ic"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "scan-line",
    size: 22
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "qa-t"
  }, "Escanear QR"), /*#__PURE__*/React.createElement("div", {
    className: "qa-m"
  }, "Consulta en piso")))), /*#__PURE__*/React.createElement("div", {
    className: "sec-lab"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "folder-tree",
    size: 14
  }), "Tus ", term, /*#__PURE__*/React.createElement("span", {
    className: "cnt"
  }, "consultar")), CODOS.map(c => /*#__PURE__*/React.createElement("button", {
    key: c.key,
    className: "codo-card",
    onClick: () => openCodo(c)
  }, /*#__PURE__*/React.createElement("span", {
    className: "ci"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: c.icon,
    size: 24
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "cid"
  }, c.id), /*#__PURE__*/React.createElement("div", {
    className: "cn"
  }, c.name), /*#__PURE__*/React.createElement("div", {
    className: "cm"
  }, /*#__PURE__*/React.createElement("span", {
    className: "badge-vivo"
  }, /*#__PURE__*/React.createElement("span", {
    className: "bd"
  }), c.docs, " docs vivos"), /*#__PURE__*/React.createElement("span", null, "\xB7"), /*#__PURE__*/React.createElement("span", null, c.consultas, " consultas"))), /*#__PURE__*/React.createElement("span", {
    className: "car"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-right",
    size: 20
  })))), /*#__PURE__*/React.createElement("div", {
    className: "readonly-note"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "monitor",
    size: 16
  }), "La configuraci\xF3n profunda ", free ? "—gestionar documentos, usuarios, plan—" : "—crear CoDos, consola de ingesta, gobernanza, lotes de QR—", " se hace en escritorio. Aqu\xED resuelves lo urgente."));
}

/* ---------- Acciones (hub) ---------- */
function AdminMobileActions({
  plan,
  openAction,
  openDesk,
  openPro,
  alertCount
}) {
  const free = plan === "free";
  return /*#__PURE__*/React.createElement("div", {
    className: "ph-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "scr-head"
  }, "Acciones"), /*#__PURE__*/React.createElement("div", {
    className: "scr-sub"
  }, "Lo que puedes resolver desde el tel\xE9fono."), /*#__PURE__*/React.createElement("div", {
    className: "sec-lab"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "zap",
    size: 14
  }), "R\xE1pidas"), /*#__PURE__*/React.createElement("button", {
    className: "act-row",
    onClick: () => openAction("subir")
  }, /*#__PURE__*/React.createElement("span", {
    className: "ari"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "upload",
    size: 20
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "at"
  }, "Subir documento"), /*#__PURE__*/React.createElement("div", {
    className: "am"
  }, "Desde correo, archivos o c\xE1mara \u2192 vivo en minutos")), /*#__PURE__*/React.createElement("span", {
    className: "car"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-right",
    size: 18
  }))), /*#__PURE__*/React.createElement("button", {
    className: "act-row",
    onClick: () => openAction("invitar")
  }, /*#__PURE__*/React.createElement("span", {
    className: "ari"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "user-plus",
    size: 20
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "at"
  }, "Invitar usuario"), /*#__PURE__*/React.createElement("div", {
    className: "am"
  }, "Colaborador o admin, con par ling\xFC\xEDstico")), /*#__PURE__*/React.createElement("span", {
    className: "car"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-right",
    size: 18
  }))), !free && /*#__PURE__*/React.createElement("button", {
    className: "act-row",
    onClick: () => openAction("alertas")
  }, /*#__PURE__*/React.createElement("span", {
    className: "ari"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "bell",
    size: 20
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "at"
  }, "Alertas"), /*#__PURE__*/React.createElement("div", {
    className: "am"
  }, "Recordatorios administrativos por vencer y pr\xF3ximos")), alertCount > 0 ? /*#__PURE__*/React.createElement("span", {
    className: "ar-badge"
  }, alertCount) : /*#__PURE__*/React.createElement("span", {
    className: "car"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-right",
    size: 18
  }))), free && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "sec-lab",
    style: {
      marginTop: 22
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "gem",
    size: 14
  }), "Disponible en Profesional"), PRO_LOCKED.map(d => /*#__PURE__*/React.createElement("button", {
    key: d[1],
    className: "desk-row locked",
    onClick: () => openPro(d[1])
  }, /*#__PURE__*/React.createElement("span", {
    className: "dri"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: d[0],
    size: 18
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "dt"
  }, d[1]), /*#__PURE__*/React.createElement("div", {
    className: "dm"
  }, d[2])), /*#__PURE__*/React.createElement("span", {
    className: "dpill pro"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "lock",
    size: 12
  }), "Pro")))), /*#__PURE__*/React.createElement("div", {
    className: "sec-lab",
    style: {
      marginTop: 22
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "monitor",
    size: 14
  }), "Solo en escritorio"), (free ? DESK_FREE : DESK_ONLY).map(d => /*#__PURE__*/React.createElement("button", {
    key: d[1],
    className: "desk-row",
    onClick: () => openDesk(d[1])
  }, /*#__PURE__*/React.createElement("span", {
    className: "dri"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: d[0],
    size: 18
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "dt"
  }, d[1]), /*#__PURE__*/React.createElement("div", {
    className: "dm"
  }, d[2])), /*#__PURE__*/React.createElement("span", {
    className: "dpill"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "monitor",
    size: 12
  }), "Escritorio"))));
}

/* ---------- Consult picker (cuando entra por la pestaña Consultar) ---------- */
function AdminConsultPicker({
  openCodo
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "ph-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "scr-head"
  }, "Consultar"), /*#__PURE__*/React.createElement("div", {
    className: "scr-sub"
  }, "Elige un CoDo o escanea su QR para preguntar."), CODOS.map(c => /*#__PURE__*/React.createElement("button", {
    key: c.key,
    className: "codo-card",
    onClick: () => openCodo(c)
  }, /*#__PURE__*/React.createElement("span", {
    className: "ci"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: c.icon,
    size: 24
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "cid"
  }, c.id), /*#__PURE__*/React.createElement("div", {
    className: "cn"
  }, c.name), /*#__PURE__*/React.createElement("div", {
    className: "cm"
  }, /*#__PURE__*/React.createElement("span", {
    className: "badge-vivo"
  }, /*#__PURE__*/React.createElement("span", {
    className: "bd"
  }), c.docs, " docs vivos"), /*#__PURE__*/React.createElement("span", null, "\xB7"), /*#__PURE__*/React.createElement("span", null, c.loc))), /*#__PURE__*/React.createElement("span", {
    className: "car"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-right",
    size: 20
  })))));
}
function AdminMobilePerfil({
  plan,
  openPro
}) {
  const free = plan === "free";
  return /*#__PURE__*/React.createElement("div", {
    className: "ph-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "scr-head"
  }, "Mi cuenta"), /*#__PURE__*/React.createElement("div", {
    className: "scr-sub"
  }, "Admin de organizaci\xF3n."), /*#__PURE__*/React.createElement("div", {
    className: "prof"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pav"
  }, "JM"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "pn"
  }, "Jorge Medina"), /*#__PURE__*/React.createElement("div", {
    className: "pr"
  }, "ADMIN \xB7 PROPIETARIO"))), /*#__PURE__*/React.createElement("div", {
    className: "prof-row"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "building-2",
    size: 19
  }), "Organizaci\xF3n", /*#__PURE__*/React.createElement("span", {
    className: "pv"
  }, "Laboratorio Est\xE1ndar")), /*#__PURE__*/React.createElement("div", {
    className: "prof-row"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "globe",
    size: 19
  }), "Idioma", /*#__PURE__*/React.createElement("span", {
    className: "pv"
  }, "ES-MX")), /*#__PURE__*/React.createElement("div", {
    className: "prof-row"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "gem",
    size: 19
  }), "Plan", /*#__PURE__*/React.createElement("span", {
    className: "pv"
  }, free ? "Gratuito" : "Profesional")), free ? /*#__PURE__*/React.createElement("button", {
    className: "m-cta",
    style: {
      marginTop: 6
    },
    onClick: () => openPro("Profesional")
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "gem",
    size: 16,
    color: "#fff"
  }), "Subir a Profesional") : /*#__PURE__*/React.createElement("div", {
    className: "prof-row"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "package-check",
    size: 19
  }), "Cupo de ingestas", /*#__PURE__*/React.createElement("span", {
    className: "pv"
  }, CUPO_DEMO.restante, " de ", CUPO_DEMO.recurrente, " este mes")), /*#__PURE__*/React.createElement("div", {
    className: "readonly-note"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "monitor",
    size: 16
  }), "Facturaci\xF3n, asientos y configuraci\xF3n de la organizaci\xF3n se gestionan en escritorio."), /*#__PURE__*/React.createElement("button", {
    className: "logout-row"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "log-out",
    size: 17
  }), "Cerrar sesi\xF3n"));
}
const ADMIN_TABS = [["home", "Inicio", "house"], ["scan", "Escanear", "scan-line"], ["consult", "Consultar", "messages-square"], ["actions", "Acciones", "layout-grid"]];
function AdminMobile({
  saved,
  toggleSave,
  plan,
  setPlan
}) {
  const [tab, setTab] = useState("home");
  const [consult, setConsult] = useState(null); // {codo, initialKey, viaQR}
  const [action, setAction] = useState(null); // 'subir'|'alertas'|'invitar'|'perfil'
  const [sheet, setSheet] = useState(null); // {kind:'desk'|'pro', title}
  const alertCount = ADMIN_ALERTS_M.length;
  const openCodo = (codo, viaQR) => setConsult({
    codo,
    viaQR: !!viaQR
  });
  const openDesk = title => setSheet({
    kind: "desk",
    title
  });
  const openPro = title => setSheet({
    kind: "pro",
    title
  });
  const reset = () => {
    setConsult(null);
    setAction(null);
  };
  let body;
  if (consult) body = /*#__PURE__*/React.createElement(MobileConsult, {
    codo: consult.codo,
    back: () => setConsult(null),
    saved: saved,
    toggleSave: toggleSave,
    viaQR: consult.viaQR
  });else if (action === "subir") body = /*#__PURE__*/React.createElement(SubirDoc, {
    onCancel: () => setAction(null)
  });else if (action === "alertas") body = /*#__PURE__*/React.createElement(AlertasMobile, {
    onBack: () => setAction(null)
  });else if (action === "invitar") body = /*#__PURE__*/React.createElement(InviteMobile, {
    onBack: () => setAction(null)
  });else if (action === "perfil") body = /*#__PURE__*/React.createElement(AdminMobilePerfil, {
    plan: plan,
    openPro: openPro
  });else if (tab === "home") body = /*#__PURE__*/React.createElement(AdminMobileHome, {
    plan: plan,
    openAction: setAction,
    openCodo: c => openCodo(c, false),
    scan: () => setTab("scan"),
    openPro: openPro,
    alertCount: alertCount
  });else if (tab === "scan") body = /*#__PURE__*/React.createElement(MobileScan, {
    pick: c => openCodo(c, true),
    title: "Escanear QR",
    sub: "Apunta al equipo para consultar o verificar en piso."
  });else if (tab === "consult") body = /*#__PURE__*/React.createElement(AdminConsultPicker, {
    openCodo: c => openCodo(c, false)
  });else body = /*#__PURE__*/React.createElement(AdminMobileActions, {
    plan: plan,
    openAction: setAction,
    openDesk: openDesk,
    openPro: openPro,
    alertCount: alertCount
  });
  const activeTab = consult || action ? null : tab;
  return /*#__PURE__*/React.createElement("div", {
    className: "dy-mobile"
  }, /*#__PURE__*/React.createElement(MobileStatus, null), /*#__PURE__*/React.createElement("div", {
    className: "ph-top"
  }, /*#__PURE__*/React.createElement(Mark, {
    size: 22
  }), /*#__PURE__*/React.createElement("span", {
    className: "w"
  }, "DOCYAN"), /*#__PURE__*/React.createElement("span", {
    className: "lde"
  }, "LDE"), /*#__PURE__*/React.createElement("span", {
    className: "role-tag"
  }, plan === "free" ? "Admin · Free" : "Admin"), /*#__PURE__*/React.createElement("button", {
    className: "av ink" + (action === "perfil" ? " on" : ""),
    onClick: () => {
      reset();
      setAction("perfil");
    }
  }, "JM")), body, /*#__PURE__*/React.createElement("div", {
    className: "tabbar"
  }, ADMIN_TABS.map(t => /*#__PURE__*/React.createElement("button", {
    key: t[0],
    className: "tab" + (t[0] === "scan" ? " scan" : "") + (activeTab === t[0] ? " on" : ""),
    onClick: () => {
      reset();
      setTab(t[0]);
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: t[2],
    size: t[0] === "scan" ? 30 : 24
  }), t[1]))), sheet && /*#__PURE__*/React.createElement("div", {
    className: "dy-sheet-scrim",
    onClick: () => setSheet(null)
  }, /*#__PURE__*/React.createElement("div", {
    className: "dy-sheet",
    onClick: e => e.stopPropagation()
  }, sheet.kind === "pro" ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "dy-sheet-ic pro"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "gem",
    size: 26
  })), /*#__PURE__*/React.createElement("div", {
    className: "dy-sheet-t"
  }, sheet.title), /*#__PURE__*/React.createElement("div", {
    className: "dy-sheet-m"
  }, "Es una funci\xF3n del plan ", /*#__PURE__*/React.createElement("b", null, "Profesional"), ": alertas administrativas, gobernanza & FAT, generaci\xF3n de QRs e inteligencia organizacional. React\xEDvala desde Plan."), /*#__PURE__*/React.createElement("button", {
    className: "m-cta",
    onClick: () => {
      setPlan("pro");
      setSheet(null);
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "gem",
    size: 16,
    color: "#fff"
  }), "Subir a Profesional"), /*#__PURE__*/React.createElement("button", {
    className: "m-cta ghost",
    style: {
      marginTop: 10
    },
    onClick: () => setSheet(null)
  }, "Ahora no")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "dy-sheet-ic"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "monitor",
    size: 26
  })), /*#__PURE__*/React.createElement("div", {
    className: "dy-sheet-t"
  }, sheet.title), /*#__PURE__*/React.createElement("div", {
    className: "dy-sheet-m"
  }, "Esta funci\xF3n es densa y deliberada \u2014 se hace mejor en la versi\xF3n de escritorio, con teclado y pantalla amplia. \xC1brela desde tu computadora."), /*#__PURE__*/React.createElement("button", {
    className: "m-cta",
    onClick: () => setSheet(null)
  }, "Entendido")))));
}
Object.assign(window, {
  AdminMobile
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "app/admin-mobile.jsx", error: String((e && e.message) || e) }); }

// app/answers.jsx
try { (() => {
/* DOCYAN — renderizado de la respuesta por TIPO DE INTENCIÓN (8 tipos).
   Compartido por la consulta de escritorio (consult.jsx) y la móvil (colab-mobile.jsx).
   El chrome base de la tarjeta (.acard/.mode/.citerow/.cite2/.savebtn/.src) ya está
   estilizado por views.css (escritorio) y mobile.css (.dy-mobile). Las clases propias
   de cada tipo van bajo .dc-answer en answer-types.css → idénticas en ambos contextos. */

const {
  useState: useStateA,
  useEffect: useEffectA
} = React;

/* Traza cada RENDER (eje B) a su TIPO DOCUMENTAL representativo (eje A) cuando la
   respuesta no declara `a.tipo`. Hace visible la relación render↔schema. */
const KIND_SCHEMA = {
  info: "ficha_tecnica",
  steps: "manual_mantenimiento",
  troubleshoot: "manual_mantenimiento",
  diagram: "manual_operacion",
  video: "manual_operacion",
  history: "registro_historico",
  alerts: "certificado_calibracion",
  compare: "manual_operacion",
  bilingual: "memoria_traduccion"
};

/* ---------- piezas compartidas ---------- */
function SaveBtn({
  saved,
  onSave
}) {
  if (!onSave) return null;
  return /*#__PURE__*/React.createElement("button", {
    className: "savebtn" + (saved ? " on" : ""),
    onClick: onSave
  }, /*#__PURE__*/React.createElement(Icon, {
    name: saved ? "check" : "bookmark",
    size: 14
  }), saved ? t({
    es: "Guardada",
    en: "Saved"
  }) : t({
    es: "Guardar",
    en: "Save"
  }));
}

/* fila de cita + fragmento original revelado inline + Abrir PDF */
function CitedFragment({
  a,
  saved,
  onSave,
  onCite
}) {
  const [open, setOpen] = useStateA(false);
  useEffectA(() => {
    const id = setTimeout(() => setOpen(true), 340);
    return () => clearTimeout(id);
  }, []);
  if (!a.cite) return onSave ? /*#__PURE__*/React.createElement("div", {
    className: "citerow"
  }, /*#__PURE__*/React.createElement(SaveBtn, {
    saved: saved,
    onSave: onSave
  })) : null;
  const parts = a.mark && a.span && a.span.includes(a.mark) ? a.span.split(a.mark) : null;
  const openSrc = () => window.dispatchEvent(new CustomEvent("dc-open-source", {
    detail: a
  }));
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "citerow"
  }, /*#__PURE__*/React.createElement("button", {
    className: "cite2",
    onClick: () => setOpen(o => !o)
  }, /*#__PURE__*/React.createElement("span", {
    className: "brk"
  }), a.cite, a.page != null ? " · " + t({
    es: "p\u00e1g.",
    en: "p."
  }) + " " + a.page : "", " \u2197"), /*#__PURE__*/React.createElement("button", {
    className: "openpdf",
    onClick: openSrc
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "external-link",
    size: 13
  }), t({
    es: "Abrir PDF",
    en: "Open PDF"
  })), /*#__PURE__*/React.createElement(SaveBtn, {
    saved: saved,
    onSave: onSave
  })), open && a.span && /*#__PURE__*/React.createElement("div", {
    className: "src"
  }, /*#__PURE__*/React.createElement("span", {
    className: "thr"
  }), /*#__PURE__*/React.createElement("div", {
    className: "src2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "s-head"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "file-text",
    size: 12
  }), /*#__PURE__*/React.createElement("span", null, t({
    es: "Fragmento original",
    en: "Original excerpt"
  })), a.page != null && /*#__PURE__*/React.createElement("span", {
    className: "pg"
  }, t({
    es: "p\u00e1g.",
    en: "p."
  }), " ", a.page)), /*#__PURE__*/React.createElement("div", {
    className: "s-span"
  }, parts ? /*#__PURE__*/React.createElement(React.Fragment, null, parts[0], /*#__PURE__*/React.createElement("mark", null, a.mark), parts[1]) : a.span), a.lang && a.lang !== "ES" && /*#__PURE__*/React.createElement("span", {
    className: "s-orig"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "globe",
    size: 11
  }), t({
    es: "Documento original en ingl\u00e9s · preguntaste en espa\u00f1ol",
    en: "Source document in English · you asked in English"
  })), /*#__PURE__*/React.createElement("div", {
    className: "s-actions"
  }, /*#__PURE__*/React.createElement("span", {
    className: "s-ped"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "shield-check",
    size: 12
  }), t({
    es: "Pedigree a span · SHA-256",
    en: "Pedigree to span · SHA-256"
  })), /*#__PURE__*/React.createElement("button", {
    className: "openpdf",
    onClick: openSrc
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "external-link",
    size: 13
  }), t({
    es: "Abrir PDF",
    en: "Open PDF"
  }))))));
}

/* ── Tipo 1 · Informativa (valor o texto) ───────────────── */
function InfoAnswer({
  a,
  saved,
  onSave,
  onCite
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "acard"
  }, /*#__PURE__*/React.createElement("div", {
    className: "q"
  }, a.q), a.value ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "big"
  }, a.value, /*#__PURE__*/React.createElement("span", {
    className: "u"
  }, a.unit)), /*#__PURE__*/React.createElement("p", {
    className: "note"
  }, a.note)) : /*#__PURE__*/React.createElement("p", {
    className: "note",
    style: {
      fontSize: 14.5,
      color: "var(--fg)"
    }
  }, a.text), /*#__PURE__*/React.createElement(CitedFragment, {
    a: a,
    saved: saved,
    onSave: onSave,
    onCite: onCite
  }));
}

/* ── Tipo 2 · Procedimiento paso a paso (tono ANSI Z535) ── */
function StepsAnswer({
  a,
  saved,
  onSave,
  onCite
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "acard"
  }, /*#__PURE__*/React.createElement("div", {
    className: "q"
  }, a.title), a.ppe && /*#__PURE__*/React.createElement("div", {
    className: "ppe"
  }, a.ppe.map(([ic, t], i) => /*#__PURE__*/React.createElement("span", {
    className: "chip",
    key: i
  }, /*#__PURE__*/React.createElement(Icon, {
    name: ic,
    size: 13
  }), t))), /*#__PURE__*/React.createElement("ol", {
    className: "steps"
  }, a.steps.map((s, i) => /*#__PURE__*/React.createElement("li", {
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "st"
  }, s)))), a.warn && /*#__PURE__*/React.createElement("div", {
    className: "warn"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "triangle-alert",
    size: 16
  }), /*#__PURE__*/React.createElement("div", {
    className: "wt"
  }, /*#__PURE__*/React.createElement("span", {
    className: "wlab"
  }, a.warn.lab), a.warn.text)), /*#__PURE__*/React.createElement(CitedFragment, {
    a: a,
    saved: saved,
    onSave: onSave,
    onCite: onCite
  }));
}

/* ── Tipo 3 · Troubleshooting DEL MANUAL (NO diagnóstico del caso) ─────────
   Línea absoluta: se presenta el árbol síntoma→causa→acción TAL COMO LO DICE EL
   MANUAL. No interroga al usuario ni dictamina su caso — el profesional decide. */
function TroubleshootAnswer({
  a,
  saved,
  onSave,
  onCite
}) {
  const [open, setOpen] = useStateA(null);
  const RAMAS = [{
    cond: "Si la vibración aparece solo en vacío",
    causa: "El manual la asocia a desbalance del rotor.",
    accion: "Indica revisar el asiento de los tubos y que las masas estén pareadas."
  }, {
    cond: "Si la vibración persiste también con carga",
    causa: "El manual la asocia a holgura en el acople motor-eje.",
    accion: "Indica inspeccionar el acople y el par de apriete de la base."
  }];
  return /*#__PURE__*/React.createElement("div", {
    className: "acard"
  }, /*#__PURE__*/React.createElement("div", {
    className: "q"
  }, "Lo que dice el manual \xB7 vibraci\xF3n al arrancar"), /*#__PURE__*/React.createElement("div", {
    className: "ans-banner"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "book-open",
    size: 15
  }), "\xC1rbol de fallas ", /*#__PURE__*/React.createElement("b", null, "tal como aparece en el manual"), ". No es un diagn\xF3stico de tu equipo \u2014 DOCYAN presenta el texto; el profesional decide."), /*#__PURE__*/React.createElement("ul", {
    className: "ts-tree"
  }, RAMAS.map((r, i) => /*#__PURE__*/React.createElement("li", {
    key: i,
    className: "ts-branch" + (open === i ? " on" : ""),
    onClick: () => setOpen(open === i ? null : i)
  }, /*#__PURE__*/React.createElement("div", {
    className: "tsb-cond"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "git-branch",
    size: 14
  }), /*#__PURE__*/React.createElement("span", null, r.cond), /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-right",
    size: 15,
    className: "tsb-chev"
  })), open === i && /*#__PURE__*/React.createElement("div", {
    className: "tsb-body"
  }, /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("span", {
    className: "tsb-lab"
  }, "El manual indica"), r.causa), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("span", {
    className: "tsb-lab"
  }, "Acci\xF3n del manual"), r.accion))))), /*#__PURE__*/React.createElement(CitedFragment, {
    a: a,
    saved: saved,
    onSave: onSave,
    onCite: onCite
  }));
}

/* ── Tipo 4 · Diagrama con pines ────────────────────────── */
const DIAG_PINS = [{
  n: 1,
  x: 33,
  y: 26,
  label: "Tapa del rotor",
  note: "Cierre de bayoneta. Alinea la marca con el punto antes de girar."
}, {
  n: 2,
  x: 58,
  y: 47,
  label: "Rotor de ángulo fijo",
  note: "6 × 50 ml. No exceder el desbalance máximo de carga."
}, {
  n: 3,
  x: 44,
  y: 72,
  label: "Acople motor-eje",
  note: "Inspeccionar ante vibración (ver diagnóstico §3.5)."
}];
function DiagramAnswer({
  a,
  saved,
  onSave,
  onCite
}) {
  const [active, setActive] = useStateA(null);
  const toggle = n => setActive(active === n ? null : n);
  return /*#__PURE__*/React.createElement("div", {
    className: "acard"
  }, /*#__PURE__*/React.createElement("div", {
    className: "q"
  }, a.title), /*#__PURE__*/React.createElement("div", {
    className: "diag-img"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ph-tag"
  }, "DIAGRAMA T\xC9CNICO \xB7 DROP IMAGE"), DIAG_PINS.map(p => /*#__PURE__*/React.createElement("button", {
    key: p.n,
    className: "pin" + (active === p.n ? " on" : ""),
    style: {
      left: p.x + "%",
      top: p.y + "%"
    },
    onClick: () => toggle(p.n),
    "aria-label": p.label
  }, p.n)), /*#__PURE__*/React.createElement("span", {
    className: "diag-zoom"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "zoom-in",
    size: 14
  }), "Pellizca para acercar")), /*#__PURE__*/React.createElement("ol", {
    className: "legend"
  }, DIAG_PINS.map(p => /*#__PURE__*/React.createElement("li", {
    key: p.n,
    className: active === p.n ? "on" : "",
    onClick: () => toggle(p.n)
  }, /*#__PURE__*/React.createElement("span", {
    className: "ln"
  }, p.n), /*#__PURE__*/React.createElement("div", {
    className: "lc"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lt"
  }, p.label), active === p.n && /*#__PURE__*/React.createElement("span", {
    className: "lnote"
  }, p.note)), /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-right",
    size: 15
  })))), /*#__PURE__*/React.createElement(CitedFragment, {
    a: a,
    saved: saved,
    onSave: onSave,
    onCite: onCite
  }));
}

/* ── Tipo 5 · Video con capítulos / transcripción ───────── */
const VID_CH = [["00:00", "Preparación y EPP"], ["01:12", "Extracción del rotor"], ["02:40", "Limpieza del eje"], ["03:55", "Montaje y balanceo"]];
const VID_TR = [["02:40", "Con el rotor fuera, limpia el eje con un paño sin pelusa."], ["02:52", "Verifica que no queden residuos en el asiento cónico.", true], ["03:08", "Aplica una capa fina del lubricante indicado."]];
function VideoAnswer({
  a,
  saved,
  onSave,
  onCite
}) {
  const [ch, setCh] = useStateA(2);
  const [tab, setTab] = useStateA("cap");
  return /*#__PURE__*/React.createElement("div", {
    className: "acard"
  }, /*#__PURE__*/React.createElement("div", {
    className: "q"
  }, a.title), /*#__PURE__*/React.createElement("div", {
    className: "vid-player"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ph-tag"
  }, "VIDEO \xB7 04:30 \xB7 DROP CLIP"), /*#__PURE__*/React.createElement("button", {
    className: "vid-play",
    "aria-label": "Reproducir"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "play",
    size: 20
  })), /*#__PURE__*/React.createElement("div", {
    className: "vid-scrub"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: "58%"
    }
  })), /*#__PURE__*/React.createElement("span", {
    className: "vid-cc"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "captions",
    size: 13
  }), "CC \xB7 ES")), /*#__PURE__*/React.createElement("div", {
    className: "vid-tabs"
  }, /*#__PURE__*/React.createElement("button", {
    className: tab === "cap" ? "on" : "",
    onClick: () => setTab("cap")
  }, "Cap\xEDtulos"), /*#__PURE__*/React.createElement("button", {
    className: tab === "tr" ? "on" : "",
    onClick: () => setTab("tr")
  }, "Transcripci\xF3n")), tab === "cap" && /*#__PURE__*/React.createElement("ul", {
    className: "chapters"
  }, VID_CH.map(([t, l], i) => /*#__PURE__*/React.createElement("li", {
    key: i,
    className: ch === i ? "on" : "",
    onClick: () => setCh(i)
  }, /*#__PURE__*/React.createElement("span", {
    className: "tc"
  }, t), /*#__PURE__*/React.createElement("span", {
    className: "cl"
  }, l), ch === i && /*#__PURE__*/React.createElement(Icon, {
    name: "play",
    size: 13
  })))), tab === "tr" && /*#__PURE__*/React.createElement("div", {
    className: "transcript"
  }, VID_TR.map(([t, l, cur], i) => /*#__PURE__*/React.createElement("p", {
    key: i,
    className: cur ? "on" : ""
  }, /*#__PURE__*/React.createElement("span", {
    className: "tc"
  }, t), l))), /*#__PURE__*/React.createElement(CitedFragment, {
    a: a,
    saved: saved,
    onSave: onSave,
    onCite: onCite
  }));
}

/* ── Tipo 6 · Historial / timeline + patrón → Playbook ──── */
const HIST_F = ["Todo", "Esta semana", "Calibración", "Mantenimiento"];
const HIST_EV = [["Hoy · 09:14", "Velocidad máxima del rotor", "info", "gauge", [0, 1]], ["Ayer · 16:02", "Vibración al arrancar — diagnóstico", "diagnóstico", "activity", [0, 1]], ["12 may", "Cambio de tubos de la centrífuga", "mantenimiento", "wrench", [0, 3]], ["08 may", "Calibración registrada · A. Ríos", "registro", "shield-check", [0, 2]]];
function HistoryAnswer({
  saved,
  onSave
}) {
  const [f, setF] = useStateA(0);
  const ev = HIST_EV.filter(e => e[4].includes(f));
  return /*#__PURE__*/React.createElement("div", {
    className: "acard"
  }, /*#__PURE__*/React.createElement("div", {
    className: "q"
  }, "Historial \xB7 CODO-LAB-04"), /*#__PURE__*/React.createElement("div", {
    className: "hist-filters"
  }, HIST_F.map((l, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    className: f === i ? "on" : "",
    onClick: () => setF(i)
  }, l))), /*#__PURE__*/React.createElement("ul", {
    className: "timeline"
  }, ev.map(([d, t, tag, ic], i) => /*#__PURE__*/React.createElement("li", {
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: ic,
    size: 13
  })), /*#__PURE__*/React.createElement("div", {
    className: "tl-c"
  }, /*#__PURE__*/React.createElement("span", {
    className: "tl-d"
  }, d), /*#__PURE__*/React.createElement("span", {
    className: "tl-t"
  }, t), /*#__PURE__*/React.createElement("span", {
    className: "tl-tag"
  }, tag)))), ev.length === 0 && /*#__PURE__*/React.createElement("li", {
    className: "tl-empty"
  }, "Sin registros para este filtro.")), /*#__PURE__*/React.createElement("div", {
    className: "patterns"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ph"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sparkles",
    size: 15
  }), "Patrones detectados"), /*#__PURE__*/React.createElement("p", null, "Consultas la ", /*#__PURE__*/React.createElement("strong", null, "velocidad del rotor"), " antes de cada arranque de turno. DOCYAN puede unir tus consultas recurrentes en un Playbook."), /*#__PURE__*/React.createElement("button", {
    className: "sug pat-cta",
    onClick: onSave
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "git-branch",
    size: 14
  }), "Proponer Playbook")));
}

/* ── Tipo 7 · Alertas administrativas ───────────────────── */
const ANS_ALERTS = [{
  sev: "warn",
  grp: "Por vencer · ≤ 7 días",
  title: "Calibración de la centrífuga",
  meta: "Vence en 4 días · 02 jul",
  cite: "Certificado CAL-22-117"
}, {
  sev: "caution",
  grp: "Próximas · ≤ 30 días",
  title: "MSDS del refrigerante",
  meta: "Expira en 22 días · 25 jul",
  cite: "DOC-MSDS-REF-03"
}, {
  sev: "caution",
  grp: "Próximas · ≤ 30 días",
  title: "Certificación del colaborador",
  meta: "Renovación en 28 días · A. Ríos",
  cite: "RH · CERT-OP-AR"
}];
function AnsAlertCard({
  a
}) {
  const [state, setState] = useStateA(null);
  return /*#__PURE__*/React.createElement("div", {
    className: "al-card s-" + a.sev + (state ? " done" : "")
  }, /*#__PURE__*/React.createElement("div", {
    className: "al-top"
  }, /*#__PURE__*/React.createElement("span", {
    className: "al-t"
  }, a.title), state && /*#__PURE__*/React.createElement("span", {
    className: "al-state"
  }, state === "read" ? "Leída" : "Pospuesta")), /*#__PURE__*/React.createElement("span", {
    className: "al-m"
  }, a.meta), /*#__PURE__*/React.createElement("div", {
    className: "al-foot"
  }, /*#__PURE__*/React.createElement("span", {
    className: "al-cite"
  }, /*#__PURE__*/React.createElement("span", {
    className: "brk"
  }), a.cite, " \u2197"), !state && /*#__PURE__*/React.createElement("div", {
    className: "al-acts"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setState("read")
  }, "Marcar le\xEDda"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setState("snooze")
  }, "Posponer"))));
}
function AlertsAnswer({
  a,
  saved,
  onSave
}) {
  const groups = [...new Set(ANS_ALERTS.map(x => x.grp))];
  return /*#__PURE__*/React.createElement("div", {
    className: "acard"
  }, /*#__PURE__*/React.createElement("div", {
    className: "q"
  }, a.title), /*#__PURE__*/React.createElement("div", {
    className: "ans-banner"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "info",
    size: 15
  }), "Recordatorio administrativo \u2014 no es una instrucci\xF3n operativa."), groups.map(g => /*#__PURE__*/React.createElement("div", {
    className: "al-group",
    key: g
  }, /*#__PURE__*/React.createElement("div", {
    className: "al-glab"
  }, g), ANS_ALERTS.filter(x => x.grp === g).map((x, i) => /*#__PURE__*/React.createElement(AnsAlertCard, {
    key: i,
    a: x
  })))), /*#__PURE__*/React.createElement("div", {
    className: "citerow"
  }, /*#__PURE__*/React.createElement(SaveBtn, {
    saved: saved,
    onSave: onSave
  })));
}

/* ── Tipo 8 · Comparativa de versiones ──────────────────── */
const DIFF = [{
  k: "chg",
  lab: "Torque del perno B",
  from: "80 N·m",
  to: "85 N·m"
}, {
  k: "add",
  text: "Etapa de apriete en cruz en 3 pasos (40 → 65 → 85)."
}, {
  k: "del",
  text: "Lubricación del perno antes del montaje."
}];
function CompareAnswer({
  a,
  saved,
  onSave,
  onCite
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "acard"
  }, /*#__PURE__*/React.createElement("div", {
    className: "q"
  }, a.title), /*#__PURE__*/React.createElement("div", {
    className: "cmp-vers"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ver old"
  }, "Rev. C", /*#__PURE__*/React.createElement("small", null, "mar 2025")), /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-right",
    size: 15
  }), /*#__PURE__*/React.createElement("span", {
    className: "ver new"
  }, "Rev. D", /*#__PURE__*/React.createElement("small", null, "vigente"))), /*#__PURE__*/React.createElement("ul", {
    className: "diff"
  }, DIFF.map((d, i) => /*#__PURE__*/React.createElement("li", {
    key: i,
    className: "d-" + d.k
  }, d.k === "chg" ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    className: "dm"
  }, "~"), /*#__PURE__*/React.createElement("span", {
    className: "dt"
  }, d.lab, ": ", /*#__PURE__*/React.createElement("s", null, d.from), " \u2192 ", /*#__PURE__*/React.createElement("b", null, d.to))) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    className: "dm"
  }, d.k === "add" ? "+" : "−"), /*#__PURE__*/React.createElement("span", {
    className: "dt"
  }, d.text))))), /*#__PURE__*/React.createElement("div", {
    className: "cmp-sum"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cs-lab"
  }, "Resumen"), "La Rev. D endurece el apriete del perno B y formaliza el patr\xF3n en cruz; elimina la lubricaci\xF3n previa."), /*#__PURE__*/React.createElement(CitedFragment, {
    a: a,
    saved: saved,
    onSave: onSave,
    onCite: onCite
  }));
}

/* ── Tipo 9 · Vista bilingüe alineada (memoria_traduccion · Pista B) ───────
   Segmentos origen↔destino por par lingüístico, con lock terminológico. */
const TM_PAIRS = [{
  src: "Stop the machine and apply lock-out/tag-out before service.",
  tgt: "Detén la máquina y aplica bloqueo/etiquetado (LOTO) antes del servicio.",
  lock: ["lock-out/tag-out", "bloqueo/etiquetado (LOTO)"]
}, {
  src: "The housing remains pressurized until fully drained.",
  tgt: "El alojamiento permanece presurizado hasta drenarse por completo.",
  lock: null
}, {
  src: "Replace the coolant filter cartridge every 500 hours.",
  tgt: "Reemplaza el cartucho del filtro de refrigerante cada 500 horas.",
  lock: ["coolant filter", "filtro de refrigerante"]
}];
function BilingualAnswer({
  a,
  saved,
  onSave,
  onCite
}) {
  const pairs = a && a.pairs || TM_PAIRS;
  return /*#__PURE__*/React.createElement("div", {
    className: "acard"
  }, /*#__PURE__*/React.createElement("div", {
    className: "q"
  }, a && a.title || "Memoria de traducción · EN-US → ES-MX"), /*#__PURE__*/React.createElement("div", {
    className: "ans-banner"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "languages",
    size: 15
  }), "Segmentos alineados de la memoria. Los t\xE9rminos con ", /*#__PURE__*/React.createElement("b", null, "candado"), " son equivalencias fijadas (lock terminol\xF3gico)."), /*#__PURE__*/React.createElement("ul", {
    className: "tm-list"
  }, pairs.map((p, i) => /*#__PURE__*/React.createElement("li", {
    className: "tm-seg",
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    className: "tm-side src"
  }, /*#__PURE__*/React.createElement("span", {
    className: "tm-lang"
  }, "EN-US"), /*#__PURE__*/React.createElement("span", {
    className: "tm-txt"
  }, p.src)), /*#__PURE__*/React.createElement("div", {
    className: "tm-side tgt"
  }, /*#__PURE__*/React.createElement("span", {
    className: "tm-lang"
  }, "ES-MX"), /*#__PURE__*/React.createElement("span", {
    className: "tm-txt"
  }, p.tgt)), p.lock && /*#__PURE__*/React.createElement("div", {
    className: "tm-lock"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "lock",
    size: 11
  }), /*#__PURE__*/React.createElement("span", {
    className: "tm-term"
  }, p.lock[0]), /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-right",
    size: 11
  }), /*#__PURE__*/React.createElement("span", {
    className: "tm-term"
  }, p.lock[1]))))), /*#__PURE__*/React.createElement(CitedFragment, {
    a: a,
    saved: saved,
    onSave: onSave,
    onCite: onCite
  }));
}

/* ---------- despachador ---------- */
function AnswerBody({
  a,
  saved,
  onSave,
  onCite
}) {
  const synth = a.mode === "synth";
  let card;
  switch (a.kind) {
    case "steps":
      card = /*#__PURE__*/React.createElement(StepsAnswer, {
        a: a,
        saved: saved,
        onSave: onSave,
        onCite: onCite
      });
      break;
    case "troubleshoot":
      card = /*#__PURE__*/React.createElement(TroubleshootAnswer, {
        a: a,
        saved: saved,
        onSave: onSave,
        onCite: onCite
      });
      break;
    case "diagram":
      card = /*#__PURE__*/React.createElement(DiagramAnswer, {
        a: a,
        saved: saved,
        onSave: onSave,
        onCite: onCite
      });
      break;
    case "video":
      card = /*#__PURE__*/React.createElement(VideoAnswer, {
        a: a,
        saved: saved,
        onSave: onSave,
        onCite: onCite
      });
      break;
    case "history":
      card = /*#__PURE__*/React.createElement(HistoryAnswer, {
        a: a,
        saved: saved,
        onSave: onSave
      });
      break;
    case "alerts":
      card = /*#__PURE__*/React.createElement(AlertsAnswer, {
        a: a,
        saved: saved,
        onSave: onSave
      });
      break;
    case "compare":
      card = /*#__PURE__*/React.createElement(CompareAnswer, {
        a: a,
        saved: saved,
        onSave: onSave,
        onCite: onCite
      });
      break;
    case "bilingual":
      card = /*#__PURE__*/React.createElement(BilingualAnswer, {
        a: a,
        saved: saved,
        onSave: onSave,
        onCite: onCite
      });
      break;
    default:
      card = /*#__PURE__*/React.createElement(InfoAnswer, {
        a: a,
        saved: saved,
        onSave: onSave,
        onCite: onCite
      });
  }
  const sch = SCHEMA_BY_ID[a.tipo || KIND_SCHEMA[a.kind] || "ficha_tecnica"];
  return /*#__PURE__*/React.createElement("div", {
    className: "dc-answer"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dc-prov"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mode" + (synth ? " synth" : "")
  }, /*#__PURE__*/React.createElement("span", {
    className: "pulse"
  }), synth ? t({
    es: "Respuesta sintetizada",
    en: "Synthesized answer"
  }) : t({
    es: "Respuesta instant\u00e1nea · cach\u00e9",
    en: "Instant answer · cache"
  })), sch && /*#__PURE__*/React.createElement("span", {
    className: "prov-tipo",
    title: "Tipo documental del que proviene esta respuesta"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "library",
    size: 11
  }), sch.label)), card);
}
Object.assign(window, {
  AnswerBody
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "app/answers.jsx", error: String((e && e.message) || e) }); }

// app/colab-mobile.jsx
try { (() => {
/* DOCYAN — Colaborador MÓVIL (breakpoint angosto del colaborador).
   Reusa datos compartidos (CODOS, ANSWERS) y el estado saved del harness.
   Exporta primitivas móviles (MobileAnswerCard / MobileConsult / MobileScan /
   MobileStatus) que el Admin de Bolsillo también consume. */

/* ---- status bar (compartida) ---- */
function MobileStatus() {
  return /*#__PURE__*/React.createElement("div", {
    className: "ph-status"
  }, /*#__PURE__*/React.createElement("span", null, "9:41"), /*#__PURE__*/React.createElement("span", {
    className: "rt"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "signal",
    size: 15
  }), /*#__PURE__*/React.createElement(Icon, {
    name: "wifi",
    size: 15
  }), /*#__PURE__*/React.createElement(Icon, {
    name: "battery-full",
    size: 17
  })));
}

/* ---- answer card (móvil) ---- */
function MobileAnswerCard({
  a,
  saved,
  onSave
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setOpen(true), 360);
    return () => clearTimeout(id);
  }, []);
  const parts = a.mark && a.span && a.span.includes(a.mark) ? a.span.split(a.mark) : null;
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "mode" + (a.mode === "synth" ? " synth" : "")
  }, /*#__PURE__*/React.createElement("span", {
    className: "pulse"
  }), a.mode === "synth" ? "Respuesta sintetizada" : "Respuesta instantánea · caché"), /*#__PURE__*/React.createElement("div", {
    className: "acard"
  }, /*#__PURE__*/React.createElement("div", {
    className: "q"
  }, a.q), a.value ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "big"
  }, a.value, /*#__PURE__*/React.createElement("span", {
    className: "u"
  }, a.unit)), /*#__PURE__*/React.createElement("p", {
    className: "note"
  }, a.note)) : /*#__PURE__*/React.createElement("p", {
    className: "note",
    style: {
      fontSize: 15.5,
      color: "var(--fg)"
    }
  }, a.text), /*#__PURE__*/React.createElement("div", {
    className: "citerow"
  }, /*#__PURE__*/React.createElement("button", {
    className: "cite2",
    onClick: () => setOpen(o => !o)
  }, /*#__PURE__*/React.createElement("span", {
    className: "brk"
  }), a.cite, " \xB7 p\xE1g. ", a.page, " \u2197"), onSave && /*#__PURE__*/React.createElement("button", {
    className: "savebtn" + (saved ? " on" : ""),
    onClick: onSave
  }, /*#__PURE__*/React.createElement(Icon, {
    name: saved ? "check" : "bookmark",
    size: 15
  }), saved ? "Guardada" : "Guardar")), open && a.span && /*#__PURE__*/React.createElement("div", {
    className: "src"
  }, /*#__PURE__*/React.createElement("span", {
    className: "thr"
  }), /*#__PURE__*/React.createElement("div", {
    className: "src2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "s-head"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "file-text",
    size: 13
  }), /*#__PURE__*/React.createElement("span", null, "Fragmento original"), /*#__PURE__*/React.createElement("span", {
    className: "pg"
  }, "p\xE1g. ", a.page)), /*#__PURE__*/React.createElement("div", {
    className: "s-span"
  }, parts ? /*#__PURE__*/React.createElement(React.Fragment, null, parts[0], /*#__PURE__*/React.createElement("mark", null, a.mark), parts[1]) : a.span), a.lang !== "ES" && /*#__PURE__*/React.createElement("span", {
    className: "s-orig"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "globe",
    size: 12
  }), "Documento original en ingl\xE9s \xB7 preguntaste en espa\xF1ol"), /*#__PURE__*/React.createElement("div", {
    className: "s-actions"
  }, /*#__PURE__*/React.createElement("span", {
    className: "s-ped"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "shield-check",
    size: 13
  }), "Pedigree a span \xB7 SHA-256"), /*#__PURE__*/React.createElement("button", {
    className: "openpdf"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "external-link",
    size: 13
  }), "Abrir PDF"))))));
}

/* ---- consult (móvil) — usado por colaborador y admin ---- */
function MobileConsult({
  codo,
  back,
  initialKey,
  saved,
  toggleSave,
  viaQR = true
}) {
  const [thread, setThread] = useState([]);
  const [text, setText] = useState("");
  const ref = useRef(null);
  const sugs = codo.sugs || [];
  const ask = (label, key) => {
    const a = ANSWERS[key] || {
      q: label,
      text: "DOCYAN clasifica tu pregunta y responde con cita a la fuente.",
      mode: "synth",
      cite: codo.id,
      page: "—",
      span: null,
      lang: "ES"
    };
    setThread(t => [...t, {
      role: "u",
      text: label
    }, {
      role: "a",
      a,
      id: Date.now() + Math.random()
    }]);
  };
  useEffect(() => {
    if (initialKey && ANSWERS[initialKey]) ask(ANSWERS[initialKey].q, initialKey); /* eslint-disable-next-line */
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread]);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "ph-body",
    ref: ref
  }, /*#__PURE__*/React.createElement("div", {
    className: "cons-top"
  }, /*#__PURE__*/React.createElement("button", {
    className: "back-btn",
    onClick: back
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-left",
    size: 18
  })), /*#__PURE__*/React.createElement("div", {
    className: "cons-ctx"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cc"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot"
  }), codo.id), /*#__PURE__*/React.createElement("div", {
    className: "cnm"
  }, codo.name))), viaQR && /*#__PURE__*/React.createElement("div", {
    className: "qr-banner"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "scan-line",
    size: 15
  }), /*#__PURE__*/React.createElement("span", null, t({
    es: "QR escaneado",
    en: "QR scanned"
  }), " \xB7 ", codo.docs, " ", t({
    es: "docs vivos",
    en: "live docs"
  }))), thread.length === 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "sec-lab"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sparkles",
    size: 14
  }), t({
    es: "Preguntas frecuentes aqu\u00ed",
    en: "Frequent questions here"
  })), sugs.map((s, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    className: "sug",
    onClick: () => ask(s[1], s[2])
  }, /*#__PURE__*/React.createElement(Icon, {
    name: s[0],
    size: 18
  }), /*#__PURE__*/React.createElement("span", {
    className: "tx"
  }, s[1]), /*#__PURE__*/React.createElement("span", {
    className: "ar"
  }, "\u2192")))), thread.map((m, i) => m.role === "u" ? /*#__PURE__*/React.createElement("div", {
    className: "bubble",
    key: i
  }, m.text) : /*#__PURE__*/React.createElement(AnswerBody, {
    key: m.id,
    a: m.a,
    saved: saved.some(s => s.q === m.a.q),
    onSave: () => toggleSave(m.a, codo)
  }))), /*#__PURE__*/React.createElement("div", {
    className: "dock"
  }, /*#__PURE__*/React.createElement("form", {
    className: "qbar",
    onSubmit: e => {
      e.preventDefault();
      const v = text.trim();
      if (v) {
        ask(v, null);
        setText("");
      }
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: text,
    onChange: e => setText(e.target.value),
    placeholder: t({
      es: "Pregunta sobre este equipo\u2026",
      en: "Ask about this equipment\u2026"
    })
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "mic",
    title: t({
      es: "Dictar",
      en: "Dictate"
    })
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "mic",
    size: 18
  })), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "send"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-up",
    size: 18
  })))));
}

/* ---- scan (móvil) — usado por colaborador y admin ---- */
function MobileScan({
  pick,
  title,
  sub
}) {
  const ttl = title || t({
    es: "Escanear QR",
    en: "Scan QR"
  });
  const sb = sub || t({
    es: "Apunta la c\u00e1mara al QR pegado en el equipo.",
    en: "Point the camera at the QR on the equipment."
  });
  return /*#__PURE__*/React.createElement("div", {
    className: "ph-body",
    style: {
      display: "flex",
      flexDirection: "column"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "greet",
    style: {
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "hi"
  }, ttl), /*#__PURE__*/React.createElement("div", {
    className: "sub"
  }, sb)), /*#__PURE__*/React.createElement("div", {
    style: {
      aspectRatio: "1",
      borderRadius: 22,
      background: "var(--ink-950)",
      position: "relative",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      marginBottom: 18
    }
  }, ["tl", "tr", "bl", "br"].map(p => /*#__PURE__*/React.createElement("span", {
    key: p,
    style: {
      position: "absolute",
      width: 44,
      height: 44,
      borderColor: "var(--cinnabar-500)",
      borderStyle: "solid",
      borderWidth: p === "tl" ? "4px 0 0 4px" : p === "tr" ? "4px 4px 0 0" : p === "bl" ? "0 0 4px 4px" : "0 4px 4px 0",
      borderTopLeftRadius: p === "tl" ? 12 : 0,
      borderTopRightRadius: p === "tr" ? 12 : 0,
      borderBottomLeftRadius: p === "bl" ? 12 : 0,
      borderBottomRightRadius: p === "br" ? 12 : 0,
      top: p[0] === "t" ? 26 : "auto",
      bottom: p[0] === "b" ? 26 : "auto",
      left: p[1] === "l" ? 26 : "auto",
      right: p[1] === "r" ? 26 : "auto"
    }
  })), /*#__PURE__*/React.createElement(Icon, {
    name: "scan-line",
    size: 56,
    color: "rgba(250,247,241,.5)"
  })), /*#__PURE__*/React.createElement("div", {
    className: "sec-lab"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "zap",
    size: 14
  }), t({
    es: "Detectados cerca de ti",
    en: "Detected near you"
  })), CODOS.map(c => /*#__PURE__*/React.createElement("button", {
    key: c.key,
    className: "codo-card",
    onClick: () => pick(c)
  }, /*#__PURE__*/React.createElement("span", {
    className: "ci"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: c.icon,
    size: 24
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "cid"
  }, c.id), /*#__PURE__*/React.createElement("div", {
    className: "cn"
  }, c.name), /*#__PURE__*/React.createElement("div", {
    className: "cm"
  }, /*#__PURE__*/React.createElement("span", null, c.loc))), /*#__PURE__*/React.createElement("span", {
    className: "car"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-right",
    size: 20
  })))));
}

/* ---- colaborador: home / saved / perfil ---- */
function ColabMobileHome({
  go,
  openCodo,
  saved
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "ph-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "greet"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hi"
  }, t({
    es: "Hola, Andr\u00e9s",
    en: "Hi, Andr\u00e9s"
  })), /*#__PURE__*/React.createElement("div", {
    className: "sub"
  }, t({
    es: "Escanea el QR del equipo o entra a un CoDo.",
    en: "Scan the equipment QR or enter a CoDo."
  }))), /*#__PURE__*/React.createElement("button", {
    className: "scan-cta",
    onClick: () => go("scan")
  }, /*#__PURE__*/React.createElement("span", {
    className: "si"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "scan-line",
    size: 26,
    color: "#fff"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "st"
  }, t({
    es: "Escanear QR",
    en: "Scan QR"
  })), /*#__PURE__*/React.createElement("div", {
    className: "sm"
  }, t({
    es: "Apunta al equipo y pregunta",
    en: "Point at the equipment and ask"
  }))), /*#__PURE__*/React.createElement("span", {
    className: "sar"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-right",
    size: 20,
    color: "#fff"
  }))), /*#__PURE__*/React.createElement("button", {
    className: "ask",
    onClick: () => openCodo(CODOS[0])
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "search",
    size: 19
  }), /*#__PURE__*/React.createElement("span", null, t({
    es: "Pregunta directo a un documento\u2026",
    en: "Ask a document directly\u2026"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "sec-lab"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "folder-tree",
    size: 14
  }), t({
    es: "Tus CoDos",
    en: "Your CoDos"
  }), /*#__PURE__*/React.createElement("span", {
    className: "cnt"
  }, CODOS.length, " ", t({
    es: "con acceso",
    en: "with access"
  }))), CODOS.map(c => /*#__PURE__*/React.createElement("button", {
    key: c.key,
    className: "codo-card",
    onClick: () => openCodo(c)
  }, /*#__PURE__*/React.createElement("span", {
    className: "ci"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: c.icon,
    size: 24
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "cid"
  }, c.id), /*#__PURE__*/React.createElement("div", {
    className: "cn"
  }, c.name), /*#__PURE__*/React.createElement("div", {
    className: "cm"
  }, /*#__PURE__*/React.createElement("span", {
    className: "badge-vivo"
  }, /*#__PURE__*/React.createElement("span", {
    className: "bd"
  }), c.docs, " ", t({
    es: "docs vivos",
    en: "live docs"
  })), /*#__PURE__*/React.createElement("span", null, "\xB7"), /*#__PURE__*/React.createElement("span", null, c.loc))), /*#__PURE__*/React.createElement("span", {
    className: "car"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-right",
    size: 20
  })))), /*#__PURE__*/React.createElement("div", {
    className: "sec-lab",
    style: {
      marginTop: 22
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "bookmark",
    size: 14
  }), t({
    es: "Consultas guardadas",
    en: "Saved queries"
  })), saved.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      color: "var(--fg-subtle)",
      padding: "4px 4px 0",
      lineHeight: 1.5
    }
  }, t({
    es: "A\u00fan no guardas consultas. Toca ",
    en: "No saved queries yet. Tap "
  }), /*#__PURE__*/React.createElement("b", null, t({
    es: "Guardar",
    en: "Save"
  })), t({
    es: " en una respuesta para tenerla a la mano.",
    en: " on an answer to keep it handy."
  })) : saved.slice(0, 3).map((s, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    className: "saved-q",
    onClick: () => openCodo(CODOS.find(c => c.key === s.codoKey) || CODOS[0], s.key)
  }, /*#__PURE__*/React.createElement("span", {
    className: "qi"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "bookmark",
    size: 17
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "qt"
  }, s.q), /*#__PURE__*/React.createElement("div", {
    className: "qm"
  }, s.codoId)), /*#__PURE__*/React.createElement("span", {
    className: "car"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-right",
    size: 18
  })))), /*#__PURE__*/React.createElement("div", {
    className: "readonly-note"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "info",
    size: 16
  }), t({
    es: "Como colaborador, consultas y guardas — la organizaci\u00f3n gestiona los documentos y los CoDos.",
    en: "As a collaborator, you consult and save — the organization manages the documents and CoDos."
  })));
}
function ColabMobileSaved({
  saved,
  openCodo
}) {
  const [run, setRun] = useState(false);
  const isPlaybook = saved.length >= PB_MIN;
  if (run) return /*#__PURE__*/React.createElement("div", {
    className: "ph-body"
  }, /*#__PURE__*/React.createElement(PlaybookRun, {
    items: saved,
    onBack: () => setRun(false)
  }));
  return /*#__PURE__*/React.createElement("div", {
    className: "ph-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "scr-head"
  }, isPlaybook ? t({
    es: "Tus consultas",
    en: "Your queries"
  }) : t({
    es: "Consultas guardadas",
    en: "Saved queries"
  })), /*#__PURE__*/React.createElement("div", {
    className: "scr-sub"
  }, t({
    es: "Tus respuestas a la mano, con su cita a la fuente.",
    en: "Your answers at hand, with their citation to the source."
  })), saved.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "empty-thread"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "bookmark",
    size: 26
  }), /*#__PURE__*/React.createElement("p", null, t({
    es: "A\u00fan no guardas consultas.",
    en: "No saved queries yet."
  }), /*#__PURE__*/React.createElement("br", null), t({
    es: "Toca ",
    en: "Tap "
  }), /*#__PURE__*/React.createElement("b", null, t({
    es: "Guardar",
    en: "Save"
  })), t({
    es: " en cualquier respuesta.",
    en: " on any answer."
  }))) : /*#__PURE__*/React.createElement(React.Fragment, null, saved.map((s, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    className: "saved-q",
    onClick: () => openCodo(CODOS.find(c => c.key === s.codoKey) || CODOS[0], s.key)
  }, isPlaybook ? /*#__PURE__*/React.createElement("span", {
    className: "pb-listnum"
  }, i + 1) : /*#__PURE__*/React.createElement("span", {
    className: "qi"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "bookmark",
    size: 17
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "qt"
  }, s.q), /*#__PURE__*/React.createElement("div", {
    className: "qm"
  }, s.codoId, " \xB7 ", s.cite)), /*#__PURE__*/React.createElement("span", {
    className: "car"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-right",
    size: 18
  })))), isPlaybook && /*#__PURE__*/React.createElement(PlaybookNudge, {
    onRun: () => setRun(true)
  })));
}
function ColabMobilePerfil() {
  return /*#__PURE__*/React.createElement("div", {
    className: "ph-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "scr-head"
  }, t({
    es: "Perfil",
    en: "Profile"
  })), /*#__PURE__*/React.createElement("div", {
    className: "scr-sub"
  }, t({
    es: "Tu cuenta de colaborador.",
    en: "Your collaborator account."
  })), /*#__PURE__*/React.createElement("div", {
    className: "prof"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pav"
  }, "AR"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "pn"
  }, "Andr\xE9s R\xEDos"), /*#__PURE__*/React.createElement("div", {
    className: "pr"
  }, t({
    es: "COLABORADOR · ENTRA POR QR",
    en: "COLLABORATOR · ENTERS BY QR"
  })))), /*#__PURE__*/React.createElement("div", {
    className: "prof-row"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "globe",
    size: 19
  }), t({
    es: "Idioma",
    en: "Language"
  }), /*#__PURE__*/React.createElement("span", {
    className: "pv"
  }, window.__LANG === "en" ? "EN-US" : "ES-MX")), /*#__PURE__*/React.createElement("div", {
    className: "prof-row"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sparkles",
    size: 19
  }), t({
    es: "Sugerencias de IA",
    en: "AI suggestions"
  }), /*#__PURE__*/React.createElement("span", {
    className: "pv"
  }, t({
    es: "Activadas",
    en: "On"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "prof-row"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "building-2",
    size: 19
  }), t({
    es: "Organizaci\u00f3n",
    en: "Organization"
  }), /*#__PURE__*/React.createElement("span", {
    className: "pv"
  }, "Laboratorio Est\xE1ndar")), /*#__PURE__*/React.createElement("div", {
    className: "prof-row"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "bell",
    size: 19
  }), t({
    es: "Notificaciones",
    en: "Notifications"
  }), /*#__PURE__*/React.createElement("span", {
    className: "pv"
  }, t({
    es: "Solo alertas",
    en: "Alerts only"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "readonly-note"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "info",
    size: 16
  }), t({
    es: "No gestionas documentos ni CoDos. Si necesitas acceso a un equipo, p\u00eddelo a tu admin de organizaci\u00f3n.",
    en: "You don\u2019t manage documents or CoDos. If you need access to equipment, ask your organization admin."
  })));
}
const COLAB_TABS = [["home", "Inicio", "house"], ["scan", "Escanear", "scan-line"], ["saved", "Guardadas", "bookmark"], ["perfil", "Perfil", "user"]];
const COLAB_TAB_EN = {
  home: "Home",
  scan: "Scan",
  saved: "Saved",
  perfil: "Profile"
};
function ColabMobile({
  saved,
  toggleSave
}) {
  const [tab, setTab] = useState("home");
  const [consult, setConsult] = useState(null);
  const openCodo = (codo, initialKey) => setConsult({
    codo,
    initialKey
  });
  let body;
  if (consult) body = /*#__PURE__*/React.createElement(MobileConsult, {
    codo: consult.codo,
    initialKey: consult.initialKey,
    back: () => setConsult(null),
    saved: saved,
    toggleSave: toggleSave
  });else if (tab === "home") body = /*#__PURE__*/React.createElement(ColabMobileHome, {
    go: setTab,
    openCodo: openCodo,
    saved: saved
  });else if (tab === "scan") body = /*#__PURE__*/React.createElement(MobileScan, {
    pick: openCodo
  });else if (tab === "saved") body = /*#__PURE__*/React.createElement(ColabMobileSaved, {
    saved: saved,
    openCodo: openCodo
  });else body = /*#__PURE__*/React.createElement(ColabMobilePerfil, null);
  const activeTab = consult ? null : tab;
  return /*#__PURE__*/React.createElement("div", {
    className: "dy-mobile"
  }, /*#__PURE__*/React.createElement(MobileStatus, null), /*#__PURE__*/React.createElement("div", {
    className: "ph-top"
  }, /*#__PURE__*/React.createElement(Mark, {
    size: 22
  }), /*#__PURE__*/React.createElement("span", {
    className: "w"
  }, "DOCYAN"), /*#__PURE__*/React.createElement("span", {
    className: "lde"
  }, "LDE"), /*#__PURE__*/React.createElement("button", {
    className: "av" + (tab === "perfil" && !consult ? " on" : ""),
    onClick: () => {
      setConsult(null);
      setTab("perfil");
    }
  }, "AR")), body, /*#__PURE__*/React.createElement("div", {
    className: "tabbar"
  }, COLAB_TABS.map(tb => /*#__PURE__*/React.createElement("button", {
    key: tb[0],
    className: "tab" + (tb[0] === "scan" ? " scan" : "") + (activeTab === tb[0] ? " on" : ""),
    onClick: () => {
      setConsult(null);
      setTab(tb[0]);
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: tb[2],
    size: tb[0] === "scan" ? 30 : 24
  }), t({
    es: tb[1],
    en: COLAB_TAB_EN[tb[0]]
  })))));
}
Object.assign(window, {
  MobileStatus,
  MobileAnswerCard,
  MobileConsult,
  MobileScan,
  ColabMobile
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "app/colab-mobile.jsx", error: String((e && e.message) || e) }); }

// app/colab.jsx
try { (() => {
/* DOCYAN — colaborador web views: Inicio · Guardadas · Perfil (consulta = ConsultView compartida) */

function ColabInicio({
  openCodo,
  saved,
  goConsult
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "colab-home"
  }, /*#__PURE__*/React.createElement("div", {
    className: "colab-hi"
  }, t({
    es: "Hola, Andr\u00e9s",
    en: "Hi, Andr\u00e9s"
  })), /*#__PURE__*/React.createElement("div", {
    className: "colab-sub"
  }, t({
    es: "Escanea el QR del equipo o entra a un CoDo para consultar.",
    en: "Scan the equipment QR or enter a CoDo to consult."
  })), /*#__PURE__*/React.createElement("div", {
    className: "scan-row"
  }, /*#__PURE__*/React.createElement("button", {
    className: "scan-cta",
    onClick: () => goConsult(CODOS[0])
  }, /*#__PURE__*/React.createElement("span", {
    className: "si"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "scan-line",
    size: 24,
    color: "#fff"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "st"
  }, t({
    es: "Escanear QR",
    en: "Scan QR"
  })), /*#__PURE__*/React.createElement("div", {
    className: "sm"
  }, t({
    es: "Apunta al equipo y pregunta",
    en: "Point at the equipment and ask"
  }))), /*#__PURE__*/React.createElement("span", {
    className: "sar"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-right",
    size: 20,
    color: "#fff"
  }))), /*#__PURE__*/React.createElement("button", {
    className: "ask-cta",
    onClick: () => goConsult(CODOS[0])
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "search",
    size: 20
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "at"
  }, t({
    es: "Pregunta directo",
    en: "Ask directly"
  })), /*#__PURE__*/React.createElement("div", {
    className: "am"
  }, t({
    es: "Busca en los documentos de un CoDo",
    en: "Search a CoDo\u2019s documents"
  }))))), /*#__PURE__*/React.createElement("div", {
    className: "sec-lab"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "folder-tree",
    size: 14
  }), t({
    es: "Tus CoDos",
    en: "Your CoDos"
  }), /*#__PURE__*/React.createElement("span", {
    className: "cnt"
  }, CODOS.length, " ", t({
    es: "con acceso",
    en: "with access"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "colab-codos"
  }, CODOS.map(c => /*#__PURE__*/React.createElement("button", {
    key: c.key,
    className: "cc-card",
    onClick: () => openCodo(c)
  }, /*#__PURE__*/React.createElement("span", {
    className: "ci"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: c.icon,
    size: 22
  })), /*#__PURE__*/React.createElement("div", {
    className: "cid"
  }, c.id), /*#__PURE__*/React.createElement("div", {
    className: "cn"
  }, c.name), /*#__PURE__*/React.createElement("div", {
    className: "cm"
  }, /*#__PURE__*/React.createElement("span", {
    className: "badge-vivo"
  }, /*#__PURE__*/React.createElement("span", {
    className: "bd"
  }), c.docs, " ", t({
    es: "docs vivos",
    en: "live docs"
  })), /*#__PURE__*/React.createElement("span", null, "\xB7"), /*#__PURE__*/React.createElement("span", null, c.loc))))), /*#__PURE__*/React.createElement("div", {
    className: "sec-lab"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "bookmark",
    size: 14
  }), t({
    es: "Consultas guardadas",
    en: "Saved queries"
  })), saved.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      color: "var(--fg-subtle)",
      padding: "0 2px 4px",
      lineHeight: 1.5
    }
  }, t({
    es: "A\u00fan no guardas consultas. Toca ",
    en: "No saved queries yet. Tap "
  }), /*#__PURE__*/React.createElement("b", null, t({
    es: "Guardar",
    en: "Save"
  })), t({
    es: " en una respuesta para tenerla a la mano.",
    en: " on an answer to keep it handy."
  })) : saved.slice(0, 4).map((s, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    className: "saved-q",
    style: {
      maxWidth: 640
    },
    onClick: () => openCodo(CODOS.find(c => c.key === s.codoKey) || CODOS[0], s.key)
  }, /*#__PURE__*/React.createElement("span", {
    className: "qi"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "bookmark",
    size: 16
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "qt"
  }, s.q), /*#__PURE__*/React.createElement("div", {
    className: "qm"
  }, s.codoId)), /*#__PURE__*/React.createElement("span", {
    className: "car"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-right",
    size: 18
  })))), /*#__PURE__*/React.createElement("div", {
    className: "readonly-note"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "info",
    size: 16
  }), t({
    es: "Como colaborador, consultas y guardas — la organizaci\u00f3n gestiona los documentos y los CoDos.",
    en: "As a collaborator, you consult and save — the organization manages the documents and CoDos."
  }))));
}
function ColabGuardadas({
  saved,
  openCodo
}) {
  const [run, setRun] = useState(false);
  const isPlaybook = saved.length >= PB_MIN;
  if (run) return /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 640
    }
  }, /*#__PURE__*/React.createElement(PlaybookRun, {
    items: saved,
    onBack: () => setRun(false)
  })));
  return /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "scr-head"
  }, isPlaybook ? t({
    es: "Tus consultas",
    en: "Your queries"
  }) : t({
    es: "Consultas guardadas",
    en: "Saved queries"
  })), /*#__PURE__*/React.createElement("div", {
    className: "scr-sub"
  }, t({
    es: "Tus respuestas a la mano, con su cita a la fuente.",
    en: "Your answers at hand, with their citation to the source."
  })), saved.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "empty-thread"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "bookmark",
    size: 26
  }), /*#__PURE__*/React.createElement("p", null, t({
    es: "A\u00fan no guardas consultas.",
    en: "No saved queries yet."
  }), /*#__PURE__*/React.createElement("br", null), t({
    es: "Toca ",
    en: "Tap "
  }), /*#__PURE__*/React.createElement("b", null, t({
    es: "Guardar",
    en: "Save"
  })), t({
    es: " en cualquier respuesta.",
    en: " on any answer."
  }))) : /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 640
    }
  }, saved.map((s, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    className: "saved-q",
    onClick: () => openCodo(CODOS.find(c => c.key === s.codoKey) || CODOS[0], s.key)
  }, isPlaybook ? /*#__PURE__*/React.createElement("span", {
    className: "pb-listnum"
  }, i + 1) : /*#__PURE__*/React.createElement("span", {
    className: "qi"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "bookmark",
    size: 16
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "qt"
  }, s.q), /*#__PURE__*/React.createElement("div", {
    className: "qm"
  }, s.codoId, " \xB7 ", s.cite)), /*#__PURE__*/React.createElement("span", {
    className: "car"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-right",
    size: 18
  })))), isPlaybook && /*#__PURE__*/React.createElement(PlaybookNudge, {
    onRun: () => setRun(true)
  })));
}
function ColabPerfil() {
  return /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "scr-head"
  }, t({
    es: "Perfil",
    en: "Profile"
  })), /*#__PURE__*/React.createElement("div", {
    className: "scr-sub"
  }, t({
    es: "Tu cuenta de colaborador.",
    en: "Your collaborator account."
  })), /*#__PURE__*/React.createElement("div", {
    className: "prof"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pav"
  }, "AR"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "pn"
  }, "Andr\xE9s R\xEDos"), /*#__PURE__*/React.createElement("div", {
    className: "pr"
  }, t({
    es: "COLABORADOR · ENTRA POR QR",
    en: "COLLABORATOR · ENTERS BY QR"
  })))), /*#__PURE__*/React.createElement("div", {
    className: "prof-row"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "globe",
    size: 18
  }), t({
    es: "Idioma",
    en: "Language"
  }), /*#__PURE__*/React.createElement("span", {
    className: "pv"
  }, window.__LANG === "en" ? "EN-US" : "ES-MX")), /*#__PURE__*/React.createElement("div", {
    className: "prof-row"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sparkles",
    size: 18
  }), t({
    es: "Sugerencias de IA",
    en: "AI suggestions"
  }), /*#__PURE__*/React.createElement("span", {
    className: "pv"
  }, t({
    es: "Activadas",
    en: "On"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "prof-row"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "building-2",
    size: 18
  }), t({
    es: "Organizaci\u00f3n",
    en: "Organization"
  }), /*#__PURE__*/React.createElement("span", {
    className: "pv"
  }, "Laboratorio Est\xE1ndar")), /*#__PURE__*/React.createElement("div", {
    className: "prof-row"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "bell",
    size: 18
  }), t({
    es: "Notificaciones",
    en: "Notifications"
  }), /*#__PURE__*/React.createElement("span", {
    className: "pv"
  }, t({
    es: "Solo alertas",
    en: "Alerts only"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "readonly-note"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "info",
    size: 16
  }), t({
    es: "No gestionas documentos ni CoDos. Si necesitas acceso a un equipo, p\u00eddelo a tu admin de organizaci\u00f3n.",
    en: "You don\u2019t manage documents or CoDos. If you need access to equipment, ask your organization admin."
  })));
}
Object.assign(window, {
  ColabInicio,
  ColabGuardadas,
  ColabPerfil
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "app/colab.jsx", error: String((e && e.message) || e) }); }

// app/consult.jsx
try { (() => {
/* DOCYAN — answer card + consult view (shared org + colaborador web) */

function AnswerCard({
  a,
  saved,
  onSave
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setOpen(true), 340);
    return () => clearTimeout(id);
  }, []);
  const parts = a.mark && a.span && a.span.includes(a.mark) ? a.span.split(a.mark) : null;
  return /*#__PURE__*/React.createElement("div", {
    className: "answer"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mode" + (a.mode === "synth" ? " synth" : "")
  }, /*#__PURE__*/React.createElement("span", {
    className: "pulse"
  }), a.mode === "synth" ? "Respuesta sintetizada" : "Respuesta instantánea · caché"), /*#__PURE__*/React.createElement("div", {
    className: "acard"
  }, /*#__PURE__*/React.createElement("div", {
    className: "q"
  }, a.q), a.value ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "big"
  }, a.value, /*#__PURE__*/React.createElement("span", {
    className: "u"
  }, a.unit)), /*#__PURE__*/React.createElement("p", {
    className: "note"
  }, a.note)) : /*#__PURE__*/React.createElement("p", {
    className: "note",
    style: {
      fontSize: 14,
      color: "var(--fg)"
    }
  }, a.text), /*#__PURE__*/React.createElement("div", {
    className: "citerow"
  }, /*#__PURE__*/React.createElement("button", {
    className: "cite2",
    onClick: () => setOpen(o => !o)
  }, /*#__PURE__*/React.createElement("span", {
    className: "brk"
  }), a.cite, " \xB7 p\xE1g. ", a.page, " \u2197"), /*#__PURE__*/React.createElement("button", {
    className: "openpdf"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "external-link",
    size: 13
  }), "Abrir PDF"), onSave && /*#__PURE__*/React.createElement("button", {
    className: "savebtn" + (saved ? " on" : ""),
    onClick: onSave
  }, /*#__PURE__*/React.createElement(Icon, {
    name: saved ? "check" : "bookmark",
    size: 14
  }), saved ? "Guardada" : "Guardar")), open && a.span && /*#__PURE__*/React.createElement("div", {
    className: "src"
  }, /*#__PURE__*/React.createElement("span", {
    className: "thr"
  }), /*#__PURE__*/React.createElement("div", {
    className: "src2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "s-head"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "file-text",
    size: 12
  }), /*#__PURE__*/React.createElement("span", null, "Fragmento original"), /*#__PURE__*/React.createElement("span", {
    className: "pg"
  }, "p\xE1g. ", a.page)), /*#__PURE__*/React.createElement("div", {
    className: "s-span"
  }, parts ? /*#__PURE__*/React.createElement(React.Fragment, null, parts[0], /*#__PURE__*/React.createElement("mark", null, a.mark), parts[1]) : a.span), a.lang !== "ES" && /*#__PURE__*/React.createElement("span", {
    className: "s-orig"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "globe",
    size: 11
  }), "Documento original en ingl\xE9s \xB7 preguntaste en espa\xF1ol"), /*#__PURE__*/React.createElement("div", {
    className: "s-actions"
  }, /*#__PURE__*/React.createElement("span", {
    className: "s-ped"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "shield-check",
    size: 12
  }), "Pedigree a span \xB7 SHA-256"), /*#__PURE__*/React.createElement("button", {
    className: "openpdf"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "external-link",
    size: 13
  }), "Abrir PDF"))))));
}

/* Consult view: doctabs + contexto/sugeridas-por-documento + "Tus consultas" (izq) + hilo + limpiar (der).
   Paridad con la versión final de Shell-A. */
const CONSULT_LS = "docyan_proto_userq";
const OBS_LS = "docyan_proto_obs";
function ConsultView({
  codo,
  initialKey,
  saved,
  toggleSave
}) {
  const c = codo || CODOS[0];
  const [docIdx, setDocIdx] = useState(0);
  const [thread, setThread] = useState([]);
  const [text, setText] = useState("");
  const [userQ, setUserQ] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(CONSULT_LS)) || {};
    } catch (e) {
      return {};
    }
  });
  const [adding, setAdding] = useState(false);
  const [addVal, setAddVal] = useState("");
  const [savedKeys, setSavedKeys] = useState([]);
  const [obs, setObs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(OBS_LS)) || {};
    } catch (e) {
      return {};
    }
  });
  const [obsAdding, setObsAdding] = useState(false);
  const [obsVal, setObsVal] = useState("");
  const threadRef = useRef(null);
  const doc = c.docList[docIdx] || c.docList[0];
  const mine = userQ[doc.key] || [];
  const misObs = obs[c.id] || [];
  useEffect(() => {
    localStorage.setItem(CONSULT_LS, JSON.stringify(userQ));
  }, [userQ]);
  useEffect(() => {
    localStorage.setItem(OBS_LS, JSON.stringify(obs));
  }, [obs]);
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread]);
  const addObs = () => {
    const v = obsVal.trim();
    if (!v) return;
    setObs(o => ({
      ...o,
      [c.id]: [...(o[c.id] || []), {
        t: v,
        at: t({
          es: "ahora",
          en: "now"
        })
      }]
    }));
    setObsVal("");
    setObsAdding(false);
  };
  const delObs = i => setObs(o => ({
    ...o,
    [c.id]: (o[c.id] || []).filter((_, k) => k !== i)
  }));
  const ask = (label, key) => {
    const a = ANSWERS[key] || {
      q: label,
      text: "En el producto real, DOCYAN clasifica la intención y responde con cita a la fuente.",
      mode: "synth",
      cite: doc.name + " · §",
      page: "—",
      span: null,
      lang: "ES"
    };
    setThread(t => [...t, {
      role: "u",
      text: label
    }, {
      role: "a",
      a,
      id: Date.now() + Math.random()
    }]);
  };
  const addUser = () => {
    const v = addVal.trim();
    if (!v) return;
    setUserQ(u => ({
      ...u,
      [doc.key]: [...(u[doc.key] || []), v]
    }));
    setAddVal("");
    setAdding(false);
    ask(v, null);
  };
  const delUser = i => setUserQ(u => ({
    ...u,
    [doc.key]: (u[doc.key] || []).filter((_, k) => k !== i)
  }));
  const saveFromCard = m => {
    if (savedKeys.includes(m.id)) return;
    setSavedKeys(s => [...s, m.id]);
    setUserQ(u => ({
      ...u,
      [doc.key]: [...(u[doc.key] || []), m.a.q]
    }));
    if (toggleSave && !(saved && saved.some(s => s.q === m.a.q))) toggleSave(m.a, c);
  };
  useEffect(() => {
    if (initialKey && ANSWERS[initialKey]) ask(ANSWERS[initialKey].q, initialKey); /* eslint-disable-next-line */
  }, [c.key]);
  return /*#__PURE__*/React.createElement("div", {
    className: "consult-wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ctxbar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot"
  }), t({
    es: "Consultando",
    en: "Consulting"
  }), " \xB7 ", c.id), /*#__PURE__*/React.createElement("h1", null, c.name)), /*#__PURE__*/React.createElement("div", {
    className: "doctabs"
  }, c.docList.map((d, i) => /*#__PURE__*/React.createElement("button", {
    key: d.key,
    className: "doctab" + (i === docIdx ? " on" : ""),
    onClick: () => setDocIdx(i)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "file-text",
    size: 14
  }), d.name, /*#__PURE__*/React.createElement("span", {
    className: "lt"
  }, d.lang)))), /*#__PURE__*/React.createElement("div", {
    className: "cwrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "col-left"
  }, /*#__PURE__*/React.createElement("div", {
    className: "doc-card2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dh"
  }, /*#__PURE__*/React.createElement("span", {
    className: "di"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: doc.icon || "file-text",
    size: 19
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "dn"
  }, doc.name), /*#__PURE__*/React.createElement("div", {
    className: "dm"
  }, doc.meta, " \xB7 ", t({
    es: "idioma",
    en: "language"
  }), " ", doc.lang), doc.tipo && SCHEMA_BY_ID[doc.tipo] && /*#__PURE__*/React.createElement("span", {
    className: "doc-tipo"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sev-dot " + ESTADO_META[SCHEMA_BY_ID[doc.tipo].estado].sev
  }), SCHEMA_BY_ID[doc.tipo].label))), /*#__PURE__*/React.createElement("span", {
    className: "badge-vivo"
  }, /*#__PURE__*/React.createElement("span", {
    className: "bd"
  }), t({
    es: "documento vivo",
    en: "live document"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "cb-group"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cb-lab"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sparkles",
    size: 13
  }), t({
    es: "Sugeridas por DOCYAN",
    en: "Suggested by DOCYAN"
  })), (doc.sugs || []).map((s, i) => /*#__PURE__*/React.createElement("button", {
    className: "sug",
    key: i,
    onClick: () => ask(s[1], s[2])
  }, /*#__PURE__*/React.createElement(Icon, {
    name: s[0],
    size: 15
  }), /*#__PURE__*/React.createElement("span", {
    className: "tx"
  }, s[1]), /*#__PURE__*/React.createElement("span", {
    className: "ar"
  }, "\u2192")))), /*#__PURE__*/React.createElement("div", {
    className: "cb-group"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cb-lab"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "bookmark",
    size: 13
  }), t({
    es: "Tus consultas",
    en: "Your queries"
  })), mine.map((q, i) => /*#__PURE__*/React.createElement("button", {
    className: "sug saved",
    key: i,
    onClick: () => ask(q, Object.keys(ANSWERS).find(k => ANSWERS[k].q === q))
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "bookmark",
    size: 15
  }), /*#__PURE__*/React.createElement("span", {
    className: "tx"
  }, q), /*#__PURE__*/React.createElement("span", {
    className: "del",
    onClick: e => {
      e.stopPropagation();
      delUser(i);
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 13
  })))), adding ? /*#__PURE__*/React.createElement("div", {
    className: "add-row"
  }, /*#__PURE__*/React.createElement("input", {
    autoFocus: true,
    value: addVal,
    placeholder: t({
      es: "Escribe una consulta para guardar\u2026",
      en: "Type a query to save\u2026"
    }),
    onChange: e => setAddVal(e.target.value),
    onKeyDown: e => {
      if (e.key === "Enter") addUser();
      if (e.key === "Escape") setAdding(false);
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "ok",
    onClick: addUser
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 16
  }))) : /*#__PURE__*/React.createElement("button", {
    className: "add-q",
    onClick: () => setAdding(true)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 15
  }), t({
    es: "Agregar consulta",
    en: "Add query"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "cb-group"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cb-lab"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "pencil-line",
    size: 13
  }), t({
    es: "Observaciones",
    en: "Observations"
  })), /*#__PURE__*/React.createElement("p", {
    className: "obs-hint"
  }, t({
    es: "Anota algo que viste en el equipo. Queda registrado en la entidad; no es una instrucción, es tu nota.",
    en: "Note something you saw on the equipment. It's logged on the entity; not an instruction, your note."
  })), misObs.map((o, i) => /*#__PURE__*/React.createElement("div", {
    className: "obs-item",
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "obs-ic"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "message-square-text",
    size: 14
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "obs-t"
  }, o.t), /*#__PURE__*/React.createElement("div", {
    className: "obs-m"
  }, t({
    es: "tú",
    en: "you"
  }), " \xB7 ", o.at)), /*#__PURE__*/React.createElement("button", {
    className: "obs-del",
    onClick: () => delObs(i)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 13
  })))), obsAdding ? /*#__PURE__*/React.createElement("div", {
    className: "add-row"
  }, /*#__PURE__*/React.createElement("input", {
    autoFocus: true,
    value: obsVal,
    placeholder: t({
      es: "Ej. holgura en el acople motor-eje\u2026",
      en: "E.g. play in the motor-shaft coupling\u2026"
    }),
    onChange: e => setObsVal(e.target.value),
    onKeyDown: e => {
      if (e.key === "Enter") addObs();
      if (e.key === "Escape") setObsAdding(false);
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "ok",
    onClick: addObs
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 16
  }))) : /*#__PURE__*/React.createElement("button", {
    className: "add-q",
    onClick: () => setObsAdding(true)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 15
  }), t({
    es: "Anotar observaci\u00f3n",
    en: "Add observation"
  })))), /*#__PURE__*/React.createElement("div", {
    className: "col-right"
  }, /*#__PURE__*/React.createElement("div", {
    className: "threadbar"
  }, /*#__PURE__*/React.createElement("span", {
    className: "tb-l"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "messages-square",
    size: 14
  }), t({
    es: "Conversaci\u00f3n",
    en: "Conversation"
  }), " \xB7 ", doc.name), thread.length > 0 && /*#__PURE__*/React.createElement("button", {
    className: "clearbtn",
    onClick: () => setThread([])
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "eraser",
    size: 14
  }), t({
    es: "Limpiar conversaci\u00f3n",
    en: "Clear conversation"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "thread",
    ref: threadRef
  }, thread.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "empty"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "message-circle-question",
    size: 26
  }), /*#__PURE__*/React.createElement("p", null, t({
    es: "Toca una consulta sugerida o escribe tu pregunta sobre ",
    en: "Tap a suggested query or type your question about "
  }), /*#__PURE__*/React.createElement("b", null, doc.name), ". ", t({
    es: "La respuesta llega con su cita a la fuente.",
    en: "The answer arrives with its citation to the source."
  }))), thread.map((m, i) => m.role === "u" ? /*#__PURE__*/React.createElement("div", {
    className: "bubble",
    key: i
  }, m.text) : /*#__PURE__*/React.createElement(AnswerBody, {
    key: m.id,
    a: m.a,
    saved: savedKeys.includes(m.id),
    onSave: () => saveFromCard(m)
  }))), /*#__PURE__*/React.createElement("form", {
    className: "qbar",
    onSubmit: e => {
      e.preventDefault();
      const v = text.trim();
      if (v) {
        ask(v, null);
        setText("");
      }
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: text,
    onChange: e => setText(e.target.value),
    placeholder: t({
      es: "Pregunta sobre " + doc.name + "\u2026",
      en: "Ask about " + doc.name + "\u2026"
    })
  }), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "send"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-up",
    size: 16
  }))))));
}
Object.assign(window, {
  AnswerCard,
  ConsultView
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "app/consult.jsx", error: String((e && e.message) || e) }); }

// app/data.jsx
try { (() => {
/* DOCYAN — shared data: CoDos, documentos, respuestas citadas, navegación.
   Datos reales de la revolvedora de concreto CIPSA MAXI-10ND donde aplica. */

/* respuestas canónicas (verbatim real de los manuales MAXI-10ND) */
const ANSWERS = {
  rpm: {
    q: "RPM de la olla",
    value: "28–32",
    unit: "rpm",
    mode: "cache",
    note: "Calibra el motor hasta que la olla trabaje de 28 a 32 rpm. Si no tienes tacómetro, coloca una marca en la olla y cuéntalas.",
    cite: "Operación MAXI-10ND · Calibración del motor",
    page: 6,
    lang: "ES",
    span: "En caso de no contar con tacómetro, colocar una marca en la olla y calibrar el motor hasta que la olla trabaje de 28 a 32 revoluciones por minuto.",
    mark: "28 a 32 revoluciones por minuto"
  },
  calib: {
    q: "Calibración del motor",
    value: "2300–2400",
    unit: "rpm",
    mode: "cache",
    note: "2300–2400 rpm en las versiones estándar; 3000–3100 rpm para motores de 5.5 hp. Aprieta el tornillo tope del acelerador en esa posición.",
    cite: "Operación MAXI-10ND · Calibración del motor",
    page: 6,
    lang: "ES",
    span: "gire la palanca del acelerador hasta obtener la velocidad necesaria (3000-3100 rpm para motores de 5.5 hp y 2300-2400 rpm para las demás versiones de motor). Apriete el tornillo tope a la posición que se encuentre la palanca.",
    mark: "2300-2400 rpm para las demás versiones"
  },
  aceite: {
    q: "Aceite del motor",
    text: "El motor usa aceite SAE-30. En la lista de partes es la refacción con código CIP490482.",
    mode: "synth",
    cite: "Lista de partes · Ensamble Motor",
    page: 3,
    lang: "ES",
    span: "CIP490482   ACEITE SAE-30",
    mark: "ACEITE SAE-30"
  },
  refa: {
    q: "Cómo pedir una refacción",
    text: "Al solicitar refacciones especifica el modelo (MAXI-10ND), el número de serie de la máquina y el código de la pieza (p. ej. CIP504107).",
    mode: "synth",
    cite: "Operación MAXI-10ND · Uso de lista de partes",
    page: 12,
    lang: "ES",
    span: "deberá especificar: Modelo de la máquina · Número de serie de la misma · Código de la pieza que necesita.",
    mark: "Modelo de la máquina · Número de serie de la misma · Código de la pieza que necesita"
  },
  banda: {
    q: "Banda en V por motor",
    text: "Depende del motor: B-54 para Kohler 12HP; B-55 para Honda 8/13HP y Kohler 9/14HP; B-57 para Briggs 8HP / Robin 7HP.",
    mode: "synth",
    cite: "Lista de partes · Ensamble Motor",
    page: 3,
    lang: "ES",
    span: "CIP504107 BANDA V SECCION B-54 PARA KOHLER 12HP · CIP493399 BANDA V SECCION B-55 PARA HONDA 8HP, 13HP; KOHLER 9HP, 14HP.",
    mark: "BANDA V SECCION B-54"
  },
  vel: {
    q: "Velocidad máxima del rotor",
    value: "4,000",
    unit: "rpm",
    mode: "cache",
    note: "Rotor de ángulo fijo. No exceder con carga desbalanceada.",
    cite: "Hettich · cap. 2",
    page: 9,
    lang: "ES",
    span: "Velocidad máxima de operación: 4,000 rpm con el rotor de ángulo fijo.",
    mark: "4,000 rpm"
  },
  vibra: {
    kind: "troubleshoot",
    q: "Vibración al arrancar",
    text: "Causa probable: desbalance del rotor. Revisa el asiento de los tubos y que las masas estén pareadas.",
    mode: "synth",
    cite: "Guía de fallas · §3.5",
    page: 7,
    lang: "ES",
    span: "Vibración al arranque — verificar primero el balance del rotor y la holgura del acople motor-eje.",
    mark: "holgura del acople motor-eje"
  },
  filtro: {
    kind: "steps",
    q: "Cambio del filtro de refrigerante",
    title: "Cambio del filtro de refrigerante",
    text: "Detén la máquina y aplica LOTO; cierra la válvula y deja drenar 2 min antes de retirar la tapa.",
    mode: "synth",
    ppe: [["hand", "Guantes nitrilo"], ["glasses", "Gafas de seguridad"]],
    steps: ["Detén la máquina y aplica bloqueo/etiquetado (LOTO) en el interruptor principal.", "Cierra la válvula de suministro y deja drenar 2 min al depósito.", "Retira la tapa del alojamiento del filtro girando en sentido antihorario.", "Extrae el cartucho usado y deséchalo según el MSDS del refrigerante.", "Coloca el cartucho nuevo, vuelve a sellar y reabre la válvula."],
    warn: {
      lab: "Advertencia",
      text: "No retires la tapa sin haber drenado: el alojamiento permanece presurizado."
    },
    cite: "Manual VF-2 · §7.3",
    page: 28,
    lang: "EN",
    span: "Stop the machine and apply lock-out/tag-out; the housing remains pressurized until fully drained.",
    mark: "the housing remains pressurized"
  },
  capacidad: {
    q: "Capacidad y producción",
    value: "350",
    unit: "L",
    mode: "cache",
    note: "Volumen de la olla plástico 350 L. Producción aprox. 5 m³ por hora, con ciclo de trabajo de ~3 min.",
    cite: "Operación MAXI-10ND · Especificaciones",
    page: 5,
    lang: "ES",
    span: "Volumen de la olla plástico 350 Lts · Producción por hora 5 metros cúbicos · Ciclo de trabajo 3 minutos aprox.",
    mark: "350 Lts"
  },
  diag: {
    kind: "diagram",
    q: "Diagrama del rotor",
    title: "Diagrama · rotor y cabezal",
    mode: "cache",
    cite: "Hettich Rotina 380 · fig. 4",
    page: 14,
    lang: "ES",
    span: "Rotor de ángulo fijo (6 × 50 ml): no exceder el desbalance máximo de carga. La tapa de bayoneta debe alinear la marca con el punto antes de girar.",
    mark: "no exceder el desbalance máximo de carga"
  },
  video: {
    kind: "video",
    q: "Montaje del rotor",
    title: "Video · montaje del rotor",
    mode: "cache",
    cite: "Hettich · capacitación cap. 3",
    page: 31,
    lang: "ES",
    span: "Con el rotor fuera, limpia el eje con un paño sin pelusa y verifica que no queden residuos en el asiento cónico antes del montaje.",
    mark: "verifica que no queden residuos en el asiento cónico"
  },
  historial: {
    kind: "history",
    q: "Historial de la centrífuga",
    title: "Historial de la centrífuga",
    mode: "synth"
  },
  alertas: {
    kind: "alerts",
    q: "Alertas pendientes",
    title: "Alertas pendientes",
    mode: "synth"
  },
  compara: {
    kind: "compare",
    q: "Comparativa rev. C vs D",
    title: "Comparativa · Manual VF-2",
    mode: "synth",
    cite: "VF-2 · §4.2.1 · Δ rev.",
    page: 12,
    lang: "ES",
    span: "Rev. D — par de apriete del perno B: 85 N·m (antes 80 N·m), en cruz en 3 pasos. Se elimina la lubricación previa del perno.",
    mark: "85 N·m (antes 80 N·m)"
  },
  traduccion: {
    kind: "bilingual",
    q: "Equivalente bilingüe del manual VF-2",
    title: "Memoria de traducción · VF-2 · EN-US → ES-MX",
    mode: "synth",
    cite: "TM VF-2 · par EN-US/ES-MX",
    page: 28,
    lang: "EN",
    span: "Stop the machine and apply lock-out/tag-out; the housing remains pressurized until fully drained.",
    mark: "lock-out/tag-out"
  }
};

/* Eje A (tipo documental) por respuesta — el render proviene de un schema.
   Hace trazable cada respuesta a su tipo (answers.jsx muestra la procedencia). */
const ANSWER_TIPO = {
  rpm: "manual_operacion",
  calib: "manual_operacion",
  aceite: "ficha_tecnica",
  refa: "ficha_tecnica",
  banda: "ficha_tecnica",
  vel: "manual_operacion",
  vibra: "manual_mantenimiento",
  filtro: "manual_mantenimiento",
  capacidad: "ficha_tecnica",
  diag: "manual_operacion",
  video: "manual_operacion",
  historial: "registro_historico",
  alertas: "certificado_calibracion",
  compara: "manual_operacion",
  traduccion: "memoria_traduccion"
};
Object.entries(ANSWER_TIPO).forEach(([k, v]) => {
  if (ANSWERS[k]) ANSWERS[k].tipo = v;
});

/* documentos por CoDo (para doctabs en consulta) — las consultas sugeridas son POR DOCUMENTO */
const MAXI_DOCS = [{
  key: "op",
  name: "Instrucciones de operación",
  lang: "ES",
  meta: "manual · 12 págs",
  icon: "book-open",
  tipo: "manual_operacion",
  sugs: [["gauge", "¿A cuántas RPM debe girar la olla?", "rpm"], ["settings", "¿A qué rpm calibro el motor?", "calib"]]
}, {
  key: "partes",
  name: "Lista de partes",
  lang: "ES",
  meta: "refacciones · 17 págs",
  icon: "list-checks",
  tipo: "ficha_tecnica",
  sugs: [["fuel", "¿Qué aceite usa el motor?", "aceite"], ["disc-3", "¿Qué banda en V lleva mi motor?", "banda"], ["box", "¿Cómo pido una refacción?", "refa"]]
}, {
  key: "ficha",
  name: "Ficha técnica",
  lang: "ES",
  meta: "ficha técnica · 1 pág",
  icon: "file-text",
  tipo: "ficha_tecnica",
  sugs: [["ruler", "¿Capacidad y producción?", "capacidad"]]
}];

/* CoDos del cliente (con acceso del colaborador) */
const CODOS = [{
  key: "maxi10",
  id: "CODO-OBR-07",
  name: "Mezcladora de concreto MAXI-10ND",
  icon: "blend",
  docs: 3,
  loc: "Obra · cuadrilla 2",
  colab: 6,
  consultas: 84,
  alert: false,
  docList: MAXI_DOCS,
  sugs: [["gauge", "¿A cuántas RPM debe girar la olla?", "rpm"], ["settings", "¿A qué rpm calibro el motor?", "calib"], ["fuel", "¿Qué aceite usa el motor?", "aceite"], ["box", "¿Cómo pido una refacción?", "refa"]]
}, {
  key: "lab04",
  id: "CODO-LAB-04",
  name: "Centrífuga Hettich Rotina 380",
  icon: "disc-3",
  docs: 12,
  loc: "Lab · mesa 3",
  colab: 9,
  consultas: 318,
  alert: true,
  docList: [{
    key: "het",
    name: "Hettich Rotina 380 — manual",
    lang: "ES",
    meta: "manual · 32 págs",
    icon: "book-open",
    tipo: "manual_operacion",
    sugs: [["gauge", "¿Velocidad máxima del rotor?", "vel"], ["activity", "Vibra al arrancar", "vibra"], ["image", "Muéstrame el diagrama del rotor", "diag"], ["play-circle", "Video: montaje del rotor", "video"], ["history", "Historial de esta centrífuga", "historial"], ["bell", "¿Qué alertas tengo pendientes?", "alertas"]]
  }],
  sugs: [["gauge", "¿Velocidad máxima del rotor?", "vel"], ["activity", "Vibra al arrancar", "vibra"], ["image", "Muéstrame el diagrama del rotor", "diag"], ["play-circle", "Video: montaje del rotor", "video"], ["history", "Historial de esta centrífuga", "historial"], ["bell", "¿Qué alertas tengo pendientes?", "alertas"]]
}, {
  key: "maq02",
  id: "CODO-MAQ-02",
  name: "CNC Haas VF-2",
  icon: "cog",
  docs: 7,
  loc: "Maquinado · celda B",
  colab: 4,
  consultas: 142,
  alert: false,
  docList: [{
    key: "vf2",
    name: "Manual CNC Haas VF-2",
    lang: "EN",
    meta: "manual · 64 págs",
    icon: "book-open",
    tipo: "manual_mantenimiento",
    sugs: [["wrench", "¿Cómo cambio el filtro de refrigerante?", "filtro"], ["git-compare", "Compara la rev. C y D del manual", "compara"], ["languages", "Equivalente bilingüe del manual", "traduccion"]]
  }],
  sugs: [["wrench", "¿Cómo cambio el filtro de refrigerante?", "filtro"], ["git-compare", "Compara la rev. C y D del manual", "compara"], ["languages", "Equivalente bilingüe del manual", "traduccion"]]
}];

/* acervo para el wizard (los 3 reales + extras vinculables) — `tipo` = schema documental */
const ACERVO = [{
  id: "d1",
  name: "Instrucciones de operación — MAXI-10ND",
  lang: "ES",
  kind: "manual · PDF",
  tipo: "manual_operacion",
  pages: 12,
  mb: 1.2,
  seg: "operacion"
}, {
  id: "d2",
  name: "Lista de partes — MAXI-10ND",
  lang: "ES",
  kind: "refacciones · PDF",
  tipo: "ficha_tecnica",
  pages: 17,
  mb: 1.6,
  seg: "operacion"
}, {
  id: "d3",
  name: "Ficha técnica — MAXI-10ND",
  lang: "ES",
  kind: "ficha técnica · PDF",
  tipo: "ficha_tecnica",
  pages: 1,
  mb: 0.3,
  seg: "manuales"
}, {
  id: "d4",
  name: "NOM-018-STPS — pictogramas",
  lang: "ES",
  kind: "norma · PDF",
  tipo: "norma_ley_reglamento",
  pages: 12,
  mb: 0.7,
  seg: "seguridad"
}, {
  id: "d5",
  name: "Bitácora de mantenimiento 2025",
  lang: "ES",
  kind: "registro · XLSX",
  tipo: "registro_historico",
  pages: 1,
  mb: 0.2,
  seg: "calibracion"
}, {
  id: "d6",
  name: "Garantía y datos del motor",
  lang: "ES",
  kind: "ficha técnica · PDF",
  tipo: "ficha_tecnica",
  pages: 4,
  mb: 0.4,
  seg: "operacion"
}];
const SEGMENTS = [{
  key: "manuales",
  label: "Manuales de equipo",
  icon: "book-open",
  crit: "op"
}, {
  key: "operacion",
  label: "Operación & mantenimiento",
  icon: "list-checks",
  crit: "op"
}, {
  key: "seguridad",
  label: "Seguridad & MSDS",
  icon: "shield-alert",
  crit: "sec"
}, {
  key: "calibracion",
  label: "Calibración & registros",
  icon: "ruler",
  crit: "op"
}];
const SEG_LABEL = Object.fromEntries(SEGMENTS.map(s => [s.key, s.label]));
const VERTICALES = ["Construcción — planta de concreto", "Laboratorio ISO 17025", "Maquila IMMEX", "Minería & agregados", "Farmacéutica"];
const PARES = ["ES-MX · EN-US", "ES-MX", "EN-US · ES-MX", "ES-CO · EN-US"];

/* menús: org adaptable al plan + colaborador */
const NAV_ORG = {
  free: [["files", "Documentos", "codos"], ["scan-line", "Consultar", "consultar"], ["users", "Usuarios", "usuarios"], ["gem", "Plan", "plan"]],
  pro: [["grp", "Operación"], ["layout-dashboard", "Resumen", "resumen"], ["sparkles", "Inteligencia", "inteligencia"], ["folder-tree", "CoDos", "codos"], ["scan-line", "Consultar", "consultar"], ["bell", "Alertas", "alertas"], ["grp", "Administración"], ["files", "Documentos", "documentos"], ["upload", "Ingesta", "ingesta"], ["library", "Schemas", "schemas"], ["book-marked", "Glosario", "glosario"], ["shield-check", "Gobernanza & FAT", "gobernanza"], ["qr-code", "Generar QRs", "qrs"], ["users", "Usuarios", "usuarios"], ["gem", "Plan", "plan"]]
};
const NAV_COLAB = [["house", "Inicio", "inicio"], ["scan-line", "Consultar", "consultar"], ["bookmark", "Guardadas", "guardadas"], ["user", "Perfil", "perfil"]];
Object.assign(window, {
  ANSWERS,
  CODOS,
  ACERVO,
  SEGMENTS,
  SEG_LABEL,
  VERTICALES,
  PARES,
  NAV_ORG,
  NAV_COLAB,
  MAXI_DOCS
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "app/data.jsx", error: String((e && e.message) || e) }); }

// app/demo-showcase.jsx
try { (() => {
/* DOCYAN — Demo pública sin registro · superficie del prototipo (fuente de verdad).
   Reusa la consulta REAL del prototipo (ColabMobile / ConsultView) DENTRO de marcos
   de dispositivo (teléfono ↔ tablet, toggle), con el CoDo MAXI-10ND (3 docs de la
   mezcladora) — el mismo preview de consulta. Opus porta esto a la sección /demo
   del sitio público; en producción la consulta libre va contra el backend real. */
const {
  useState: useStateD
} = React;
function DemoShowcase({
  saved,
  toggleSave
}) {
  const [dev, setDev] = useStateD("phone"); // phone | tablet
  return /*#__PURE__*/React.createElement("div", {
    className: "demo-show"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ds-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ds-eyebrow"
  }, "Demo sin registro"), /*#__PURE__*/React.createElement("h1", {
    className: "ds-title"
  }, "Pru\xE9balo con documentos reales"), /*#__PURE__*/React.createElement("p", {
    className: "ds-lead"
  }, "Mezcladora de concreto ", /*#__PURE__*/React.createElement("b", null, "MAXI-10ND"), " \xB7 3 documentos vivos. Pregunta lo que preguntar\xEDas frente al equipo \u2014 la respuesta llega citada a la fuente, en tu idioma."), /*#__PURE__*/React.createElement("div", {
    className: "ds-devtoggle",
    role: "tablist",
    "aria-label": "Dispositivo"
  }, /*#__PURE__*/React.createElement("button", {
    className: "ds-dev" + (dev === "phone" ? " on" : ""),
    role: "tab",
    "aria-selected": dev === "phone",
    onClick: () => setDev("phone")
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "smartphone",
    size: 15
  }), "Tel\xE9fono"), /*#__PURE__*/React.createElement("button", {
    className: "ds-dev" + (dev === "tablet" ? " on" : ""),
    role: "tab",
    "aria-selected": dev === "tablet",
    onClick: () => setDev("tablet")
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "tablet",
    size: 15
  }), "Tablet"))), /*#__PURE__*/React.createElement("div", {
    className: "ds-stage"
  }, dev === "phone" ? /*#__PURE__*/React.createElement("div", {
    className: "ds-bezel phone"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ds-screen"
  }, /*#__PURE__*/React.createElement(ColabMobile, {
    saved: saved,
    toggleSave: toggleSave
  }))) : /*#__PURE__*/React.createElement("div", {
    className: "ds-bezel tablet"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ds-screen"
  }, /*#__PURE__*/React.createElement(ConsultView, {
    codo: CODOS[0],
    saved: saved,
    toggleSave: toggleSave
  })))), /*#__PURE__*/React.createElement("div", {
    className: "ds-banner"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dsb-dot"
  }, /*#__PURE__*/React.createElement("span", null)), /*#__PURE__*/React.createElement("div", {
    className: "dsb-txt"
  }, /*#__PURE__*/React.createElement("b", null, "Est\xE1s en un CoDo demo."), " Las respuestas vienen de los 3 documentos reales de la MAXI-10ND. Cuando quieras, hazlo con los tuyos."), /*#__PURE__*/React.createElement("div", {
    className: "dsb-cta"
  }, /*#__PURE__*/React.createElement("button", {
    className: "dsb-btn primary",
    onClick: () => dcModal({
      icon: "rocket",
      title: "Empieza gratis",
      body: "Crea tu cuenta y carga tus primeros 3 documentos — sin tarjeta, 30 días, todas las capacidades.",
      confirm: "Crear cuenta gratis",
      doneTitle: "¡Listo!",
      doneBody: "En producción esto te lleva al registro (/signup)."
    })
  }, "Ahora con tus documentos"), /*#__PURE__*/React.createElement("button", {
    className: "dsb-btn ghost",
    onClick: () => dcModal({
      icon: "calendar",
      title: "Agendar demo",
      body: "Te mostramos DOCYAN con documentos de tu sector y resolvemos dudas de implementación.",
      confirm: "Agendar",
      doneTitle: "Gracias",
      doneBody: "En producción esto te lleva a /codigo (piloto, Esencial −30%)."
    })
  }, "Agendar demo"))));
}
Object.assign(window, {
  DemoShowcase
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "app/demo-showcase.jsx", error: String((e && e.message) || e) }); }

// app/entry.jsx
try { (() => {
/* DOCYAN — Superficie de ENTRADA (pre-login) · portada de ui_kits/onboarding/
   {atoms,auth,onboarding-flow}.jsx al prototipo (fuente de verdad única).
   Todo local salvo EntryFlow (window) para no colisionar con el prototipo.
   Estilos en app/entry.css, todos prefijados con `.entry`. */
const {
  useState: useStateE,
  useEffect: useEffectE,
  useRef: useRefE
} = React;

/* ── átomos ──────────────────────────────────────────────── */
function EMark({
  size = 26,
  tone = "ink"
}) {
  const stroke = tone === "light" ? "var(--amate-50)" : "var(--fg)";
  const dot = tone === "light" ? "#D9633F" : "#CF4124";
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 64 64",
    fill: "none",
    "aria-label": "DOCYAN"
  }, /*#__PURE__*/React.createElement("g", {
    stroke: stroke,
    strokeWidth: "5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M13 23 V13 H23"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M41 13 H51 V23"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M51 41 V51 H41"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M23 51 H13 V41"
  })), /*#__PURE__*/React.createElement("rect", {
    x: "25.5",
    y: "25.5",
    width: "13",
    height: "13",
    rx: "3",
    fill: dot
  }));
}
function EBrandRow({
  size = 26,
  tone = "ink"
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "brand-row" + (tone === "light" ? " light" : "")
  }, /*#__PURE__*/React.createElement(EMark, {
    size: size,
    tone: tone
  }), /*#__PURE__*/React.createElement("span", {
    className: "wm"
  }, "DOCYAN", /*#__PURE__*/React.createElement("span", {
    className: "lde"
  }, "LDE")));
}
function ECite({
  label,
  dark,
  onClick
}) {
  return /*#__PURE__*/React.createElement("button", {
    className: "cite" + (dark ? " dark" : ""),
    onClick: onClick
  }, /*#__PURE__*/React.createElement("span", {
    className: "brk"
  }), label, " ", /*#__PURE__*/React.createElement("span", {
    style: {
      opacity: .6
    }
  }, "\u2197"));
}
function ePwScore(v) {
  if (!v) return 0;
  let s = 0;
  if (v.length >= 8) s++;
  if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++;
  if (/[0-9\W]/.test(v)) s++;
  return s;
}
function EPwField({
  label = "Contraseña",
  value,
  onChange,
  show,
  setShow,
  strength,
  placeholder = "Mínimo 8 caracteres"
}) {
  const sc = ePwScore(value);
  return /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, label), /*#__PURE__*/React.createElement("div", {
    className: "inp"
  }, /*#__PURE__*/React.createElement("input", {
    type: show ? "text" : "password",
    value: value,
    placeholder: placeholder,
    onChange: e => onChange(e.target.value)
  }), /*#__PURE__*/React.createElement("button", {
    className: "eye",
    type: "button",
    "aria-label": show ? "Ocultar" : "Mostrar",
    onClick: () => setShow(!show)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: show ? "eye-off" : "eye",
    size: 17
  }))), strength && value && /*#__PURE__*/React.createElement("div", {
    className: "pwbar"
  }, /*#__PURE__*/React.createElement("i", {
    className: sc >= 1 ? sc === 1 ? "mid" : "on" : ""
  }), /*#__PURE__*/React.createElement("i", {
    className: sc >= 2 ? sc === 2 ? "mid" : "on" : ""
  }), /*#__PURE__*/React.createElement("i", {
    className: sc >= 3 ? "on" : ""
  })));
}

/* ── value aside (panel tinta) ───────────────────────────── */
function ValueAside({
  tag,
  title,
  sub,
  points,
  object
}) {
  return /*#__PURE__*/React.createElement("aside", {
    className: "auth-aside"
  }, /*#__PURE__*/React.createElement("div", {
    className: "aside-top"
  }, /*#__PURE__*/React.createElement(EBrandRow, {
    tone: "light",
    size: 28
  }), tag && /*#__PURE__*/React.createElement("span", {
    className: "aside-tag"
  }, tag)), /*#__PURE__*/React.createElement("div", {
    className: "aside-mid"
  }, /*#__PURE__*/React.createElement("h1", null, title), sub && /*#__PURE__*/React.createElement("p", {
    className: "aside-sub"
  }, sub), points && /*#__PURE__*/React.createElement("ul", {
    className: "aside-points"
  }, points.map((p, i) => /*#__PURE__*/React.createElement("li", {
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "ap-ic"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: p[0],
    size: 16
  })), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("b", null, p[1]), /*#__PURE__*/React.createElement("span", {
    className: "ap-m"
  }, p[2]))))), object), /*#__PURE__*/React.createElement("div", {
    className: "aside-foot"
  }, /*#__PURE__*/React.createElement("span", {
    className: "d"
  }), "XCID SA de CV \xB7 M\xE9xico \xB7 multi-tenant aislado por organizaci\xF3n"));
}
function AsideMock() {
  return /*#__PURE__*/React.createElement("div", {
    className: "aside-object"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ao-q"
  }, "\xBFTorque del perno B?"), /*#__PURE__*/React.createElement("div", {
    className: "ao-a"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ao-big"
  }, "85 ", /*#__PURE__*/React.createElement("small", null, "N\xB7m")), /*#__PURE__*/React.createElement("span", {
    className: "cite dark"
  }, /*#__PURE__*/React.createElement("span", {
    className: "brk"
  }), "Manual VF-2 \xB7 \xA74.2.1 \u2197")));
}

/* ── 1 · Signup freemium ─────────────────────────────────── */
function SignupFreemium({
  go
}) {
  const [email, setEmail] = useStateE("");
  const [pw, setPw] = useStateE("");
  const [show, setShow] = useStateE(false);
  return /*#__PURE__*/React.createElement("div", {
    className: "auth-stage"
  }, /*#__PURE__*/React.createElement("div", {
    className: "auth-split"
  }, /*#__PURE__*/React.createElement(ValueAside, {
    tag: "Gratis \xB7 sin tarjeta",
    title: "Empieza hoy. Sin fricci\xF3n.",
    sub: "Crea tu cuenta y vive el producto: ingiere un documento y haz tu primera consulta con cita a la fuente. El plan viene despu\xE9s.",
    points: [["file-check", "3 documentos vivos · 30 días", "Suficiente para ver el valor en tu propia operación."], ["scan-line", "Ingiere tus documentos como están", "PDF, manual, MSDS o ficha. DOCYAN los lee tal cual."], ["link", "Cada respuesta cita su fuente exacta", "Pedigree a span exacto, no resúmenes opacos."]],
    object: /*#__PURE__*/React.createElement(AsideMock, null)
  }), /*#__PURE__*/React.createElement("div", {
    className: "auth-form"
  }, /*#__PURE__*/React.createElement("div", {
    className: "auth-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ac-head"
  }, /*#__PURE__*/React.createElement(EBrandRow, {
    size: 26
  }), /*#__PURE__*/React.createElement("h2", null, "Crea tu cuenta"), /*#__PURE__*/React.createElement("p", {
    className: "ac-sub"
  }, "Solo necesitas un correo y una contrase\xF1a. Sin plan, sin datos fiscales, sin pago.")), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Correo de trabajo"), /*#__PURE__*/React.createElement("input", {
    type: "email",
    placeholder: "nombre@laboratorio.mx",
    value: email,
    onChange: e => setEmail(e.target.value)
  })), /*#__PURE__*/React.createElement(EPwField, {
    value: pw,
    onChange: setPw,
    show: show,
    setShow: setShow,
    strength: true
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn primary full lg",
    style: {
      marginTop: 6
    },
    onClick: () => go("onboarding")
  }, "Crear cuenta gratis", /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-right",
    size: 17
  })), /*#__PURE__*/React.createElement("p", {
    className: "auth-foot",
    style: {
      marginTop: 14
    }
  }, "Al crear tu cuenta aceptas los t\xE9rminos y el aviso de privacidad de DOCYAN."), /*#__PURE__*/React.createElement("div", {
    className: "auth-div"
  }, "o"), /*#__PURE__*/React.createElement("button", {
    className: "btn sec full",
    onClick: () => go("redeem")
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "ticket",
    size: 16
  }), "Tengo un c\xF3digo de acceso"), /*#__PURE__*/React.createElement("p", {
    className: "auth-foot"
  }, "\xBFYa tienes cuenta? ", /*#__PURE__*/React.createElement("span", {
    className: "link",
    onClick: () => go("login")
  }, "Inicia sesi\xF3n"))))));
}

/* ── 2 · Login ───────────────────────────────────────────── */
function Login({
  go
}) {
  const [show, setShow] = useStateE(false);
  return /*#__PURE__*/React.createElement("div", {
    className: "auth-stage"
  }, /*#__PURE__*/React.createElement("div", {
    className: "auth-form",
    style: {
      width: "100%"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "auth-card auth-centered"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ac-head",
    style: {
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "inline-flex"
    }
  }, /*#__PURE__*/React.createElement(EBrandRow, {
    size: 30
  })), /*#__PURE__*/React.createElement("h2", null, "Bienvenido de vuelta"), /*#__PURE__*/React.createElement("p", {
    className: "ac-sub"
  }, "Ingresa a tu organizaci\xF3n para gestionar documentos, CoDos e invitaciones.")), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Correo"), /*#__PURE__*/React.createElement("input", {
    type: "email",
    defaultValue: "jorge.medina@lab-estandar.mx"
  })), /*#__PURE__*/React.createElement(EPwField, {
    label: "Contrase\xF1a",
    value: "contraseña",
    onChange: () => {},
    show: show,
    setShow: setShow,
    placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
  }), /*#__PURE__*/React.createElement("div", {
    className: "field-row"
  }, /*#__PURE__*/React.createElement("label", {
    className: "chk"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    defaultChecked: true
  }), "Recordarme"), /*#__PURE__*/React.createElement("span", {
    className: "link"
  }, "\xBFOlvidaste tu contrase\xF1a?")), /*#__PURE__*/React.createElement("button", {
    className: "btn primary full lg",
    onClick: () => go("enter")
  }, "Entrar", /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-right",
    size: 17
  })), /*#__PURE__*/React.createElement("div", {
    className: "qr-alt"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "scan-line",
    size: 18
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "qa-t"
  }, "\xBFEres colaborador?"), /*#__PURE__*/React.createElement("div", {
    className: "qa-m"
  }, "Escanea el QR del equipo para consultar \u2014 sin cuenta ni login."))), /*#__PURE__*/React.createElement("p", {
    className: "auth-foot"
  }, "\xBFA\xFAn no tienes cuenta? ", /*#__PURE__*/React.createElement("span", {
    className: "link",
    onClick: () => go("signup")
  }, "Empieza gratis")))));
}

/* ── 3 · Canje de código (puerta Piloto, −30%) ───────────── */
function RedeemCode({
  go
}) {
  const [code, setCode] = useStateE(["", "", "", "", "", ""]);
  const [validated, setValidated] = useStateE(false);
  const [show, setShow] = useStateE(false);
  const [pw, setPw] = useStateE("");
  const refs = useRefE([]);
  const filled = code.every(c => c);
  const setChar = (i, v) => {
    const c = [...code];
    c[i] = v.slice(-1).toUpperCase();
    setCode(c);
    if (v && i < 5) refs.current[i + 1]?.focus();
  };
  const onKey = (i, e) => {
    if (e.key === "Backspace" && !code[i] && i > 0) refs.current[i - 1]?.focus();
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "auth-stage"
  }, /*#__PURE__*/React.createElement("div", {
    className: "auth-split"
  }, /*#__PURE__*/React.createElement(ValueAside, {
    tag: "Acceso piloto",
    title: "Entras con tu plan ya activo.",
    sub: "A diferencia del registro gratuito, un c\xF3digo de acceso piloto activa de inmediato el plan Esencial con tu precio especial. Listo para ingerir y consultar.",
    points: [["badge-check", "Plan Esencial-piloto activo al entrar", "Sin periodo de prueba ni límite de 3 documentos."], ["percent", "Precio piloto bloqueado", "Tu tarifa preferente se mantiene durante el programa."], ["headset", "Acompañamiento directo de DOCYAN", "Onboarding y soporte cercano del equipo XCID."]]
  }), /*#__PURE__*/React.createElement("div", {
    className: "auth-form"
  }, /*#__PURE__*/React.createElement("div", {
    className: "auth-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ac-head"
  }, /*#__PURE__*/React.createElement(EBrandRow, {
    size: 26
  }), /*#__PURE__*/React.createElement("h2", null, "Canjea tu c\xF3digo"), /*#__PURE__*/React.createElement("p", {
    className: "ac-sub"
  }, "Ingresa el c\xF3digo de acceso que te comparti\xF3 DOCYAN.")), /*#__PURE__*/React.createElement("div", {
    className: "field",
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("label", null, "C\xF3digo de acceso"), /*#__PURE__*/React.createElement("div", {
    className: "code-input"
  }, code.map((c, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, /*#__PURE__*/React.createElement("input", {
    ref: el => refs.current[i] = el,
    value: c,
    maxLength: 1,
    onChange: e => setChar(i, e.target.value),
    onKeyDown: e => onKey(i, e)
  }), i === 2 && /*#__PURE__*/React.createElement("span", {
    className: "dash"
  }, "\u2013")))), /*#__PURE__*/React.createElement("span", {
    className: "hint",
    style: {
      textAlign: "center"
    }
  }, "Pista de demo: escribe ", /*#__PURE__*/React.createElement("b", {
    className: "mono"
  }, "PIL-OTO"))), !validated && /*#__PURE__*/React.createElement("button", {
    className: "btn primary full lg",
    disabled: !filled,
    onClick: () => setValidated(true)
  }, "Validar c\xF3digo", /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-right",
    size: 17
  })), validated && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "pilot-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pc-top"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "badge-check",
    size: 18
  }), /*#__PURE__*/React.createElement("span", {
    className: "pc-t"
  }, "C\xF3digo v\xE1lido \u2014 Plan Esencial-piloto"), /*#__PURE__*/React.createElement("span", {
    className: "pc-tag"
  }, "Activo")), /*#__PURE__*/React.createElement("div", {
    className: "pc-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pc-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pc-list"
  }, "$250 USD/mes"), /*#__PURE__*/React.createElement("span", {
    className: "pc-now"
  }, "$175", /*#__PURE__*/React.createElement("span", {
    className: "pc-per"
  }, " USD/mes")), /*#__PURE__*/React.createElement("span", {
    className: "pc-save"
  }, "\u221230% piloto")), /*#__PURE__*/React.createElement("ul", {
    className: "pc-feat"
  }, /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 15
  }), "Hasta 50 documentos vivos"), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 15
  }), "10 documentos de arranque + 3/mes"), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 15
  }), "Colaboradores con QR ilimitados"), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 15
  }), "Precio bloqueado durante el programa piloto")))), /*#__PURE__*/React.createElement("div", {
    className: "field",
    style: {
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement("label", null, "Correo de trabajo"), /*#__PURE__*/React.createElement("input", {
    type: "email",
    placeholder: "nombre@laboratorio.mx"
  })), /*#__PURE__*/React.createElement(EPwField, {
    value: pw,
    onChange: setPw,
    show: show,
    setShow: setShow,
    strength: true
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn primary full lg",
    style: {
      marginTop: 6
    },
    onClick: () => go("onboarding")
  }, "Activar mi cuenta piloto", /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-right",
    size: 17
  }))), /*#__PURE__*/React.createElement("p", {
    className: "auth-foot"
  }, "\xBFNo tienes c\xF3digo? ", /*#__PURE__*/React.createElement("span", {
    className: "link",
    onClick: () => go("signup")
  }, "Empieza gratis"))))));
}

/* ── overlay de fuente (pedigree) ────────────────────────── */
function SourceModal({
  onClose
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "src-overlay",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "src-modal",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    className: "src-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", null, "Manual operativo de CNC"), /*#__PURE__*/React.createElement("div", {
    className: "sh-eyebrow"
  }, "PLAN DE MANTENIMIENTO \xB7 \xA79")), /*#__PURE__*/React.createElement("button", {
    className: "sh-x",
    "aria-label": "Cerrar",
    onClick: onClose
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 20
  }))), /*#__PURE__*/React.createElement("div", {
    className: "src-doc-body"
  }, /*#__PURE__*/React.createElement("p", null, "Antes de aplicar cualquier valor, verifica que las superficies de contacto est\xE9n limpias y que el equipo se encuentre en estado seguro. Confirma la vigencia de los registros asociados del CoDo."), /*#__PURE__*/React.createElement("p", null, "En las condiciones definidas para esta entidad operativa, aplica lo siguiente. ", /*#__PURE__*/React.createElement("span", {
    className: "hl-span"
  }, "Mantenimiento programado: cambio de aceite del husillo cada 500 h; calibraci\xF3n del palpador semestral."), " Repite la verificaci\xF3n una segunda vez para asegurar el asentamiento y la consistencia del registro."), /*#__PURE__*/React.createElement("p", null, "Tras completar el procedimiento, registra el valor y la fecha en la bit\xE1cora del equipo. La trazabilidad de cada acci\xF3n queda encadenada criptogr\xE1ficamente en el FAT de DOCYAN.")), /*#__PURE__*/React.createElement("div", {
    className: "src-foot"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sf-l"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "shield-check",
    size: 15
  }), "Pedigree a span exacto \xB7 cadena SHA-256"), /*#__PURE__*/React.createElement("button", {
    className: "openpdf"
  }, "Abrir PDF", /*#__PURE__*/React.createElement(Icon, {
    name: "external-link",
    size: 13
  })))));
}
const ONB_SUGS = ["¿Qué mantenimiento tengo pendiente?", "¿Cada cuánto cambio el aceite del husillo?", "¿Cuándo calibro el palpador?"];
function OnbConsult({
  onAha
}) {
  const [phase, setPhase] = useStateE("idle");
  const [q, setQ] = useStateE("");
  const [src, setSrc] = useStateE(false);
  const ask = question => {
    setQ(question);
    setPhase("asking");
    setTimeout(() => {
      setPhase("done");
      onAha && onAha();
    }, 1150);
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "consult"
  }, /*#__PURE__*/React.createElement("div", {
    className: "consult-top"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mctx-ic"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "folder-tree",
    size: 17
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "ml"
  }, "Est\xE1s consultando"), /*#__PURE__*/React.createElement("div", {
    className: "mn"
  }, "CODO-MAQ-02 \xB7 L\xEDnea CNC Haas VF-4")), /*#__PURE__*/React.createElement("span", {
    className: "live"
  }, /*#__PURE__*/React.createElement("span", {
    className: "d"
  }), "en vivo")), /*#__PURE__*/React.createElement("div", {
    className: "consult-body"
  }, phase === "idle" && /*#__PURE__*/React.createElement("div", {
    className: "consult-empty"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "message-square-text",
    size: 26
  }), /*#__PURE__*/React.createElement("p", null, "Elige una pregunta para ver c\xF3mo DOCYAN responde con cita a la fuente.")), phase !== "idle" && /*#__PURE__*/React.createElement("div", {
    className: "cq"
  }, q), phase === "asking" && /*#__PURE__*/React.createElement("div", {
    className: "shimmer"
  }, /*#__PURE__*/React.createElement("span", {
    className: "d"
  }), "DOCYAN est\xE1 buscando en tu documento\u2026"), phase === "done" && /*#__PURE__*/React.createElement("div", {
    className: "ca"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ca-big"
  }, "500 ", /*#__PURE__*/React.createElement("span", {
    className: "u"
  }, "h")), /*#__PURE__*/React.createElement("p", {
    className: "ca-note"
  }, "Cambio de aceite del husillo cada ", /*#__PURE__*/React.createElement("b", null, "500 horas"), "; calibraci\xF3n del palpador semestral. Recordatorio administrativo \u2014 no es una instrucci\xF3n operativa."), /*#__PURE__*/React.createElement("div", {
    className: "ca-cite-row"
  }, /*#__PURE__*/React.createElement(ECite, {
    label: "Manual operativo de CNC \xB7 \xA79",
    onClick: () => setSrc(true)
  }), /*#__PURE__*/React.createElement("button", {
    className: "openpdf",
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 7,
      fontSize: 12,
      fontWeight: 600,
      color: "var(--fg)",
      background: "transparent",
      border: "1px solid var(--border-strong)",
      borderRadius: "var(--radius-md)",
      padding: "7px 12px",
      cursor: "pointer"
    },
    onClick: () => setSrc(true)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "file-text",
    size: 13
  }), "Ver fuente")))), /*#__PURE__*/React.createElement("div", {
    className: "consult-sugs"
  }, ONB_SUGS.map(s => /*#__PURE__*/React.createElement("button", {
    key: s,
    className: "consult-sug",
    disabled: phase !== "idle",
    onClick: () => ask(s)
  }, s)))), src && /*#__PURE__*/React.createElement(SourceModal, {
    onClose: () => setSrc(false)
  }));
}
function OnbProcessing({
  onDone
}) {
  const stages = ["Leyendo el documento como está", "Extrayendo entidades operativas", "Indexando y encadenando (FAT)"];
  const [i, setI] = useStateE(0);
  const [done, setDone] = useStateE(false);
  useEffectE(() => {
    if (done) return;
    if (i >= stages.length) {
      setDone(true);
      onDone && onDone();
      return;
    }
    const t = setTimeout(() => setI(i + 1), 850);
    return () => clearTimeout(t);
  }, [i, done]);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "proc"
  }, /*#__PURE__*/React.createElement("div", {
    className: "proc-steps"
  }, stages.map((s, k) => {
    const cls = done || k < i ? "done" : k === i ? "active" : "pending";
    return /*#__PURE__*/React.createElement("div", {
      key: k,
      className: "proc-step " + cls
    }, /*#__PURE__*/React.createElement("span", {
      className: "ps-ic"
    }, done || k < i ? /*#__PURE__*/React.createElement(Icon, {
      name: "check",
      size: 14
    }) : k === i ? /*#__PURE__*/React.createElement(Icon, {
      name: "loader-2",
      size: 14,
      className: "spin"
    }) : /*#__PURE__*/React.createElement("span", {
      style: {
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: "var(--border-strong)"
      }
    })), /*#__PURE__*/React.createElement("span", {
      className: "ps-t"
    }, s), (done || k < i) && /*#__PURE__*/React.createElement("span", {
      className: "ps-stat"
    }, "listo"), k === i && !done && /*#__PURE__*/React.createElement("span", {
      className: "ps-stat"
    }, "en curso\u2026"));
  }))), done && /*#__PURE__*/React.createElement("div", {
    className: "entity-out",
    style: {
      animation: "rise .3s var(--ease-out)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "eo-ic"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 20
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "eo-t"
  }, "CoDo creado \xB7 entidad detectada"), /*#__PURE__*/React.createElement("div", {
    className: "eo-n"
  }, "L\xEDnea CNC Haas VF-4"), /*#__PURE__*/React.createElement("div", {
    className: "eo-id"
  }, "CODO-MAQ-02 \xB7 1 documento vivo"))));
}
const ONB_STEPS = [["sparkles", "Bienvenida"], ["upload-cloud", "Tu primer documento"], ["cpu", "DOCYAN lo procesa"], ["scan-line", "Tu primera consulta"], ["check-circle-2", "Listo"]];
function OnboardingFlow({
  go
}) {
  const [step, setStep] = useStateE(0);
  const [picked, setPicked] = useStateE(false);
  const [processed, setProcessed] = useStateE(false);
  const [aha, setAha] = useStateE(false);
  const cur = ONB_STEPS[step];
  const pct = Math.round((step + 1) / ONB_STEPS.length * 100);
  const canNext = step === 1 ? picked : step === 2 ? processed : step === 3 ? aha : true;
  const next = () => {
    if (step === ONB_STEPS.length - 1) {
      go("enter");
      return;
    }
    setStep(step + 1);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "onb"
  }, /*#__PURE__*/React.createElement("aside", {
    className: "onb-rail"
  }, /*#__PURE__*/React.createElement(EBrandRow, {
    tone: "light",
    size: 26
  }), /*#__PURE__*/React.createElement("span", {
    className: "onb-free"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "gift",
    size: 13
  }), "Plan gratuito \xB7 3 docs \xB7 30 d\xEDas"), /*#__PURE__*/React.createElement("div", {
    className: "onb-steps"
  }, ONB_STEPS.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "onb-step" + (i === step ? " on" : "") + (i < step ? " done" : ""),
    onClick: () => i < step && setStep(i)
  }, /*#__PURE__*/React.createElement("span", {
    className: "osn"
  }, i < step ? /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 13
  }) : i + 1), s[1]))), /*#__PURE__*/React.createElement("div", {
    className: "rail-foot"
  }, "El objetivo de hoy: llegar a tu primera respuesta con cita a la fuente. Eso es DOCYAN.")), /*#__PURE__*/React.createElement("div", {
    className: "onb-main"
  }, /*#__PURE__*/React.createElement("div", {
    className: "onb-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "onb-progress"
  }, /*#__PURE__*/React.createElement("span", null, String(step + 1).padStart(2, "0"), " / ", String(ONB_STEPS.length).padStart(2, "0")), /*#__PURE__*/React.createElement("span", {
    className: "opbar"
  }, /*#__PURE__*/React.createElement("i", {
    style: {
      width: pct + "%"
    }
  })), /*#__PURE__*/React.createElement("span", null, pct, "%")), /*#__PURE__*/React.createElement("div", {
    className: "onb-ic"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: cur[0],
    size: 27
  })), step === 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("h1", null, "Bienvenido a DOCYAN"), /*#__PURE__*/React.createElement("p", {
    className: "onb-lead"
  }, "Tus documentos dejan de estar muertos y dispersos. En los pr\xF3ximos minutos vas a ingerir uno y a hacer tu primera consulta con respuesta citada \u2014 el momento que lo explica todo."), /*#__PURE__*/React.createElement("div", {
    className: "onb-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "onb-hl"
  }, [["zap", "Time-to-value en días, no meses", "Sin proyecto de implementación de seis meses."], ["file-check", "Ingiere tu documento como está", "DOCYAN lo lee tal cual: PDF, manual, MSDS o ficha."], ["link", "Cada respuesta cita su fuente", "Pedigree a span exacto, encadenado criptográficamente."]].map(h => /*#__PURE__*/React.createElement("div", {
    className: "hl",
    key: h[1]
  }, /*#__PURE__*/React.createElement("span", {
    className: "hi"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: h[0],
    size: 18
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "ht"
  }, h[1]), /*#__PURE__*/React.createElement("div", {
    className: "hm"
  }, h[2]))))))), step === 1 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("h1", null, "Sube tu primer documento"), /*#__PURE__*/React.createElement("p", {
    className: "onb-lead"
  }, "S\xFAbelo como est\xE1. DOCYAN lo lee tal cual \u2014 no necesitas prepararlo ni reformatearlo. Te mostramos el costo estimado antes de procesar."), /*#__PURE__*/React.createElement("div", {
    className: "doc-counter"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dots"
  }, /*#__PURE__*/React.createElement("i", {
    className: picked ? "used" : ""
  }), /*#__PURE__*/React.createElement("i", null), /*#__PURE__*/React.createElement("i", null)), /*#__PURE__*/React.createElement("span", null, "Documento ", /*#__PURE__*/React.createElement("span", {
    className: "dc-num"
  }, picked ? "1" : "0", " de 3"))), /*#__PURE__*/React.createElement("div", {
    className: "onb-body"
  }, !picked ? /*#__PURE__*/React.createElement("div", {
    className: "dropzone",
    onClick: () => setPicked(true)
  }, /*#__PURE__*/React.createElement("div", {
    className: "dz-ic"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "upload-cloud",
    size: 24
  })), /*#__PURE__*/React.createElement("div", {
    className: "dz-t"
  }, "Arrastra tu documento o ", /*#__PURE__*/React.createElement("b", null, "selecciona un archivo")), /*#__PURE__*/React.createElement("div", {
    className: "dz-m"
  }, "Para esta demo, haz clic para usar un manual de ejemplo."), /*#__PURE__*/React.createElement("div", {
    className: "dz-formats"
  }, /*#__PURE__*/React.createElement("span", null, "PDF"), /*#__PURE__*/React.createElement("span", null, "DOCX"), /*#__PURE__*/React.createElement("span", null, "MANUAL"), /*#__PURE__*/React.createElement("span", null, "MSDS"), /*#__PURE__*/React.createElement("span", null, "FICHA"))) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "doc-sel"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ds-ic"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "file-text",
    size: 20
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "ds-n"
  }, "Manual operativo de CNC.pdf"), /*#__PURE__*/React.createElement("div", {
    className: "ds-m"
  }, "2.4 MB \xB7 48 p\xE1ginas \xB7 ES-MX")), /*#__PURE__*/React.createElement("button", {
    className: "ds-x",
    "aria-label": "Quitar",
    onClick: () => setPicked(false)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 17
  }))), /*#__PURE__*/React.createElement("div", {
    className: "cost-row"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "calculator",
    size: 17
  }), /*#__PURE__*/React.createElement("span", {
    className: "cr-t"
  }, "Costo estimado de ingesta"), /*#__PURE__*/React.createElement("span", {
    className: "cr-v"
  }, "incluido en tu plan gratuito"))))), step === 2 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("h1", null, "DOCYAN procesa tu documento"), /*#__PURE__*/React.createElement("p", {
    className: "onb-lead"
  }, "Lo leemos como est\xE1, detectamos la entidad operativa que describe y lo dejamos consultable. Sin que t\xFA lo prepares."), /*#__PURE__*/React.createElement("div", {
    className: "onb-body"
  }, /*#__PURE__*/React.createElement(OnbProcessing, {
    onDone: () => setProcessed(true)
  }))), step === 3 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("h1", null, "Haz tu primera consulta"), /*#__PURE__*/React.createElement("p", {
    className: "onb-lead"
  }, "Este es el momento. Pregunta en tu idioma y recibe la respuesta con una cita cliqueable al span exacto de tu documento."), /*#__PURE__*/React.createElement("div", {
    className: "onb-body"
  }, /*#__PURE__*/React.createElement(OnbConsult, {
    onAha: () => setAha(true)
  }), aha && /*#__PURE__*/React.createElement("div", {
    className: "aha"
  }, /*#__PURE__*/React.createElement("span", {
    className: "aha-ic"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sparkles",
    size: 20
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "aha-t"
  }, "Eso es DOCYAN."), /*#__PURE__*/React.createElement("div", {
    className: "aha-m"
  }, "Tu colaborador obtiene lo mismo escaneando el QR del equipo \u2014 sin cuenta, al pie de la m\xE1quina."))))), step === 4 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("h1", null, "Listo. Tu primer CoDo est\xE1 vivo."), /*#__PURE__*/React.createElement("p", {
    className: "onb-lead"
  }, "Ya viste el valor: una consulta citada en minutos. Desde aqu\xED puedes gestionar tus documentos, invitar a tu equipo o elegir un plan cuando lo necesites."), /*#__PURE__*/React.createElement("div", {
    className: "onb-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "onb-hl"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hl",
    style: {
      cursor: "pointer"
    },
    onClick: () => go("enter")
  }, /*#__PURE__*/React.createElement("span", {
    className: "hi"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "files",
    size: 18
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "ht"
  }, "Gestiona tus documentos"), /*#__PURE__*/React.createElement("div", {
    className: "hm"
  }, "Te quedan 2 de 3 documentos en el plan gratuito.")), /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-right",
    size: 18,
    style: {
      marginLeft: "auto",
      color: "var(--fg-subtle)"
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "hl",
    style: {
      cursor: "pointer"
    },
    onClick: () => go("enter")
  }, /*#__PURE__*/React.createElement("span", {
    className: "hi"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "users",
    size: 18
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "ht"
  }, "Invita a tu equipo"), /*#__PURE__*/React.createElement("div", {
    className: "hm"
  }, "Suma admins y editores; los colaboradores entran por QR.")), /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-right",
    size: 18,
    style: {
      marginLeft: "auto",
      color: "var(--fg-subtle)"
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "hl",
    style: {
      cursor: "pointer"
    },
    onClick: () => go("enter")
  }, /*#__PURE__*/React.createElement("span", {
    className: "hi"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "gem",
    size: 18
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "ht"
  }, "Elige un plan"), /*#__PURE__*/React.createElement("div", {
    className: "hm"
  }, "Cuando est\xE9s listo para m\xE1s documentos y CoDos.")), /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-right",
    size: 18,
    style: {
      marginLeft: "auto",
      color: "var(--fg-subtle)"
    }
  }))))), /*#__PURE__*/React.createElement("div", {
    className: "onb-nav"
  }, step > 0 && step < 4 && /*#__PURE__*/React.createElement("button", {
    className: "btn ghost",
    onClick: () => setStep(step - 1)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-left",
    size: 16
  }), "Atr\xE1s"), /*#__PURE__*/React.createElement("button", {
    className: "btn primary",
    style: {
      marginLeft: "auto"
    },
    disabled: !canNext,
    onClick: next
  }, step === 0 ? "Empezar" : step === 3 ? "Continuar" : step === 4 ? "Ir a mis documentos" : "Continuar", /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-right",
    size: 16
  }))))));
}

/* ── EntryFlow: ruteo interno + sub-switcher de revisión ──── */
const ENTRY_SCREENS = [["signup", "Registro"], ["login", "Iniciar sesión"], ["redeem", "Código"], ["onboarding", "Onboarding"]];
function EntryFlow({
  onEnter,
  mobile
}) {
  const [screen, setScreen] = useStateE("signup");
  const go = dest => {
    if (dest === "enter" || dest === "documents" || dest === "plan" || dest === "invite") {
      onEnter && onEnter();
      return;
    }
    setScreen(dest);
  };
  let view;
  if (screen === "login") view = /*#__PURE__*/React.createElement(Login, {
    go: go
  });else if (screen === "redeem") view = /*#__PURE__*/React.createElement(RedeemCode, {
    go: go
  });else if (screen === "onboarding") view = /*#__PURE__*/React.createElement(OnboardingFlow, {
    go: go
  });else view = /*#__PURE__*/React.createElement(SignupFreemium, {
    go: go
  });
  return /*#__PURE__*/React.createElement("div", {
    className: "entry" + (mobile ? " is-mobile" : "")
  }, /*#__PURE__*/React.createElement("div", {
    className: "entry-subnav"
  }, ENTRY_SCREENS.map(([k, l]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    className: "esub" + (screen === k ? " on" : ""),
    onClick: () => setScreen(k)
  }, l)), /*#__PURE__*/React.createElement("span", {
    className: "esub-note"
  }, "Pre-login \xB7 al terminar entras al producto")), view);
}
Object.assign(window, {
  EntryFlow
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "app/entry.jsx", error: String((e && e.message) || e) }); }

// app/expediente.jsx
try { (() => {
/* DOCYAN — C3 · Expediente esquemático del CoDo (superficie de inmersión del experto).
   README §7: un objeto cognitivo —la entidad y sus relaciones inmediatas— no un dashboard.
   Cuatro condiciones: (1) META CLARA = goal strip siempre visible · (2) FEEDBACK
   INSTANTÁNEO = seleccionar un nodo revela su detalle sin espera · (3) RETO AJUSTABLE
   = densidad compacto/detallado · (4) AGENCIA TOTAL = sugerencias EDB a demanda, nunca
   empujadas. Solo escritorio (el colaborador consulta; el experto navega el acervo). */

/* relaciones inmediatas por CoDo — el resto se deriva de codo.docList */
const EXP_RELATIONS = {
  maxi10: [{
    id: "cal",
    ic: "ruler",
    t: "Calibración del motor",
    tag: "vigente",
    sev: "ok",
    note: "2300–2400 rpm · última 18 may · A. Ríos",
    meta: "CAL-OBR-03"
  }, {
    id: "alert",
    ic: "alarm-clock",
    t: "Calibración por vencer",
    tag: "≤ 7 días",
    sev: "warn",
    note: "Vence 02 jul · recordatorio administrativo",
    meta: "CAL-22-117"
  }, {
    id: "bit",
    ic: "history",
    t: "Bitácora de mantenimiento",
    tag: "12 entradas",
    sev: "muted",
    note: "Aceite SAE-30 · banda en V · ciclo de trabajo",
    meta: "MTTO-OBR"
  }],
  lab04: [{
    id: "cal",
    ic: "ruler",
    t: "Calibración de la centrífuga",
    tag: "por vencer",
    sev: "warn",
    note: "Vence en 4 días · certificado CAL-22-117",
    meta: "CAL-22-117"
  }, {
    id: "msds",
    ic: "shield-alert",
    t: "MSDS del refrigerante",
    tag: "vigente",
    sev: "ok",
    note: "Expira 25 jul · seguridad & MSDS",
    meta: "MSDS-REF-03"
  }, {
    id: "ver",
    ic: "git-branch",
    t: "Versiones del manual",
    tag: "rev. D vigente",
    sev: "muted",
    note: "Rev. C → D · cambia el torque del perno B",
    meta: "Δ §4.2.1"
  }, {
    id: "rel",
    ic: "link",
    t: "Entidad relacionada · rotor de ángulo fijo",
    tag: "6 × 50 ml",
    sev: "muted",
    note: "Comparte diagnóstico de vibración y diagrama",
    meta: "ENT-ROT-380"
  }],
  maq02: [{
    id: "cal",
    ic: "ruler",
    t: "Calibración del husillo",
    tag: "vigente",
    sev: "ok",
    note: "Última 11 may · dentro de tolerancia",
    meta: "CAL-MAQ-09"
  }, {
    id: "ver",
    ic: "git-branch",
    t: "Versiones del manual VF-2",
    tag: "rev. D vigente",
    sev: "muted",
    note: "Rev. C → D · perno B 80 → 85 N·m",
    meta: "Δ §4.2.1"
  }, {
    id: "ref",
    ic: "shield-alert",
    t: "Refrigerante · filtro",
    tag: "procedimiento",
    sev: "muted",
    note: "Cambio con LOTO · alojamiento presurizado",
    meta: "§7.3"
  }]
};
const SEV_DOT = {
  ok: "var(--success-600)",
  warn: "var(--warning-600)",
  caution: "#C0820F",
  muted: "var(--fg-subtle)"
};
function ExpedienteView({
  codo,
  onConsult,
  onBack
}) {
  const [sel, setSel] = useState({
    type: "entity"
  });
  const [den, setDen] = useState("detallado"); // reto ajustable
  const [edb, setEdb] = useState(false); // EDB a demanda (agencia total)
  const compact = den === "compacto";
  const rels = EXP_RELATIONS[codo.key] || [];
  const docs = codo.docList || [];
  const isDoc = d => sel.type === "doc" && sel.doc.key === d.key;
  const isRel = r => sel.type === "rel" && sel.rel.id === r.id;
  return /*#__PURE__*/React.createElement("div", {
    className: "exp"
  }, /*#__PURE__*/React.createElement("div", {
    className: "exp-strip"
  }, /*#__PURE__*/React.createElement("button", {
    className: "exp-back",
    onClick: onBack
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-left",
    size: 17
  })), /*#__PURE__*/React.createElement("div", {
    className: "exp-strip-t"
  }, /*#__PURE__*/React.createElement("div", {
    className: "exp-eyebrow"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot"
  }), "EXPEDIENTE \xB7 ", codo.id, codo.alert ? " · 2 alertas" : ""), /*#__PURE__*/React.createElement("div", {
    className: "exp-name"
  }, codo.name)), /*#__PURE__*/React.createElement("div", {
    className: "exp-den",
    role: "group",
    "aria-label": "Densidad"
  }, /*#__PURE__*/React.createElement("button", {
    className: compact ? "" : "on",
    onClick: () => setDen("detallado")
  }, "Detallado"), /*#__PURE__*/React.createElement("button", {
    className: compact ? "on" : "",
    onClick: () => setDen("compacto")
  }, "Compacto")), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary exp-consult",
    onClick: onConsult
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "messages-square",
    size: 15
  }), "Consultar")), /*#__PURE__*/React.createElement("div", {
    className: "exp-body"
  }, /*#__PURE__*/React.createElement("aside", {
    className: "exp-tree"
  }, /*#__PURE__*/React.createElement("div", {
    className: "exp-tg"
  }, "Entidad"), /*#__PURE__*/React.createElement("button", {
    className: "exp-node" + (sel.type === "entity" ? " on" : ""),
    onClick: () => setSel({
      type: "entity"
    })
  }, /*#__PURE__*/React.createElement("span", {
    className: "en-ic"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: codo.icon,
    size: 17
  })), /*#__PURE__*/React.createElement("span", {
    className: "en-t"
  }, codo.name)), /*#__PURE__*/React.createElement("div", {
    className: "exp-tg"
  }, "Acervo \xB7 ", docs.length, " docs"), docs.map(d => /*#__PURE__*/React.createElement("button", {
    key: d.key,
    className: "exp-node" + (isDoc(d) ? " on" : ""),
    onClick: () => setSel({
      type: "doc",
      doc: d
    })
  }, /*#__PURE__*/React.createElement("span", {
    className: "en-ic doc"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: d.icon || "file-text",
    size: 16
  })), /*#__PURE__*/React.createElement("span", {
    className: "en-t"
  }, d.name, /*#__PURE__*/React.createElement("span", {
    className: "en-m"
  }, d.lang, " \xB7 ", d.meta)))), /*#__PURE__*/React.createElement("div", {
    className: "exp-tg"
  }, "Relaciones inmediatas"), rels.map(r => /*#__PURE__*/React.createElement("button", {
    key: r.id,
    className: "exp-node" + (isRel(r) ? " on" : ""),
    onClick: () => setSel({
      type: "rel",
      rel: r
    })
  }, /*#__PURE__*/React.createElement("span", {
    className: "en-ic"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: r.ic,
    size: 16
  })), /*#__PURE__*/React.createElement("span", {
    className: "en-t"
  }, r.t, /*#__PURE__*/React.createElement("span", {
    className: "en-tag",
    style: {
      color: SEV_DOT[r.sev]
    }
  }, r.tag))))), /*#__PURE__*/React.createElement("main", {
    className: "exp-detail"
  }, sel.type === "entity" && /*#__PURE__*/React.createElement("div", {
    className: "exp-entity"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ee-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ee-ic"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: codo.icon,
    size: 30
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "ee-id"
  }, codo.id), /*#__PURE__*/React.createElement("h2", null, codo.name), /*#__PURE__*/React.createElement("div", {
    className: "ee-meta"
  }, codo.loc, " \xB7 ", codo.docs, " docs vivos \xB7 ", codo.colab, " colaboradores \xB7 ", codo.consultas, " consultas"))), !compact && /*#__PURE__*/React.createElement("p", {
    className: "ee-lead"
  }, "El objeto de trabajo: esta entidad y sus relaciones inmediatas. Navega el acervo a la izquierda; cada nodo revela su detalle aqu\xED. Para preguntar en lenguaje natural con cita a la fuente, entra a ", /*#__PURE__*/React.createElement("button", {
    className: "ee-link",
    onClick: onConsult
  }, "Consultar"), "."), /*#__PURE__*/React.createElement("div", {
    className: "ee-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ee-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ee-cl"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "files",
    size: 14
  }), "Acervo por segmento"), /*#__PURE__*/React.createElement("div", {
    className: "ee-chips"
  }, docs.map(d => /*#__PURE__*/React.createElement("span", {
    className: "ee-chip",
    key: d.key,
    onClick: () => setSel({
      type: "doc",
      doc: d
    })
  }, /*#__PURE__*/React.createElement(Icon, {
    name: d.icon || "file-text",
    size: 13
  }), d.name)))), /*#__PURE__*/React.createElement("div", {
    className: "ee-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ee-cl"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "git-branch",
    size: 14
  }), "Relaciones"), /*#__PURE__*/React.createElement("div", {
    className: "ee-rels"
  }, rels.map(r => /*#__PURE__*/React.createElement("button", {
    className: "ee-rel",
    key: r.id,
    onClick: () => setSel({
      type: "rel",
      rel: r
    })
  }, /*#__PURE__*/React.createElement("span", {
    className: "rd",
    style: {
      background: SEV_DOT[r.sev]
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "rt"
  }, r.t), /*#__PURE__*/React.createElement("span", {
    className: "rtag"
  }, r.tag)))))), /*#__PURE__*/React.createElement("div", {
    className: "ee-qr"
  }, /*#__PURE__*/React.createElement(QRPlate, {
    size: 92,
    seed: 3
  }), /*#__PURE__*/React.createElement("div", {
    className: "ee-qrt"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ee-qrl"
  }, "QR PERSISTENTE"), /*#__PURE__*/React.createElement("div", {
    className: "ee-qrn"
  }, "La puerta del colaborador a este CoDo"), !compact && /*#__PURE__*/React.createElement("div", {
    className: "ee-qrm"
  }, "Pegado en el equipo \xB7 escanear abre la consulta de esta entidad")))), sel.type === "doc" && /*#__PURE__*/React.createElement(DocDetail, {
    doc: sel.doc,
    codo: codo,
    compact: compact,
    onConsult: onConsult
  }), sel.type === "rel" && /*#__PURE__*/React.createElement(RelDetail, {
    rel: sel.rel,
    compact: compact
  }))), /*#__PURE__*/React.createElement("div", {
    className: "exp-edb" + (edb ? " open" : "")
  }, /*#__PURE__*/React.createElement("button", {
    className: "edb-toggle",
    onClick: () => setEdb(e => !e)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sparkles",
    size: 15
  }), /*#__PURE__*/React.createElement("span", null, "Sugerencias de DOCYAN"), /*#__PURE__*/React.createElement("span", {
    className: "edb-hint"
  }, "a demanda"), /*#__PURE__*/React.createElement(Icon, {
    name: edb ? "chevron-down" : "chevron-up",
    size: 16
  })), edb && /*#__PURE__*/React.createElement("div", {
    className: "edb-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "edb-item"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "repeat",
    size: 15
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("b", null, "3 colaboradores"), " repiten la misma secuencia de arranque en esta entidad. Podr\xEDa volverse un Playbook.")), /*#__PURE__*/React.createElement("div", {
    className: "edb-item"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "message-square",
    size: 15
  }), /*#__PURE__*/React.createElement("div", null, "Las consultas de ", /*#__PURE__*/React.createElement("b", null, "calibraci\xF3n"), " suben antes de cada auditor\xEDa \u2014 patr\xF3n estacional.")), /*#__PURE__*/React.createElement("div", {
    className: "edb-foot"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "info",
    size: 13
  }), "Las sugerencias viven aqu\xED, a demanda. DOCYAN no interrumpe tu trabajo."))));
}
function DocDetail({
  doc,
  codo,
  compact,
  onConsult
}) {
  const [recursos, setRecursos] = useState([{
    titulo: "Recorrido en video — " + doc.name,
    dur: "4:20",
    caps: 3
  }]);
  const adjuntar = () => dcModal({
    icon: "video",
    title: "Adjuntar video de apoyo",
    body: "El video se sirve como apoyo del documento — DOCYAN no lo analiza ni lo transcribe. Pega el enlace y, si quieres, marca capítulos para saltar a una sección.",
    confirm: "Adjuntar video",
    doneTitle: "Video adjuntado",
    doneBody: "Aparece como recurso de apoyo; el colaborador lo ve junto a la respuesta.",
    onConfirm: () => setRecursos(r => [...r, {
      titulo: "Video de apoyo " + (r.length + 1),
      dur: "—",
      caps: 0
    }])
  });
  return /*#__PURE__*/React.createElement("div", {
    className: "exp-doc"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ed-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ed-ic"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: doc.icon || "file-text",
    size: 24
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "ed-eyebrow"
  }, "DOCUMENTO \xB7 ", doc.lang), /*#__PURE__*/React.createElement("h2", null, doc.name), /*#__PURE__*/React.createElement("div", {
    className: "ed-meta"
  }, doc.meta, " \xB7 documento vivo"))), !compact && /*#__PURE__*/React.createElement("div", {
    className: "ed-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "badge-vivo"
  }, /*#__PURE__*/React.createElement("span", {
    className: "bd"
  }), "vivo"), /*#__PURE__*/React.createElement("span", {
    className: "ed-seg"
  }, "Acervo de ", codo.name)), /*#__PURE__*/React.createElement("div", {
    className: "ed-block"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ed-bl"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sparkles",
    size: 13
  }), "Consultas sugeridas sobre este documento"), (doc.sugs || []).map((s, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    className: "ed-sug",
    onClick: onConsult
  }, /*#__PURE__*/React.createElement(Icon, {
    name: s[0],
    size: 15
  }), /*#__PURE__*/React.createElement("span", null, s[1]), /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-right",
    size: 14
  })))), /*#__PURE__*/React.createElement("div", {
    className: "ed-block"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ed-bl"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "video",
    size: 13
  }), "Recursos de apoyo", /*#__PURE__*/React.createElement("span", {
    className: "ed-bl-note"
  }, "no se analizan \xB7 se sirven junto al documento")), recursos.map((rc, i) => /*#__PURE__*/React.createElement("div", {
    className: "rec-item",
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "rec-ic"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "play",
    size: 14
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "rec-t"
  }, rc.titulo), /*#__PURE__*/React.createElement("div", {
    className: "rec-m"
  }, rc.dur !== "—" ? rc.dur + " · " : "", rc.caps > 0 ? rc.caps + " capítulos" : "video de apoyo")), /*#__PURE__*/React.createElement(Icon, {
    name: "external-link",
    size: 14,
    color: "var(--fg-subtle)"
  }))), /*#__PURE__*/React.createElement("button", {
    className: "add-q",
    onClick: adjuntar
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 15
  }), "Adjuntar video")), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary ed-cta",
    onClick: onConsult
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "messages-square",
    size: 15
  }), "Consultar este documento"));
}
function RelDetail({
  rel,
  compact
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "exp-rel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "er-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "er-ic",
    style: {
      color: SEV_DOT[rel.sev]
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: rel.ic,
    size: 24
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "er-eyebrow"
  }, "RELACI\xD3N \xB7 ", rel.meta), /*#__PURE__*/React.createElement("h2", null, rel.t), /*#__PURE__*/React.createElement("span", {
    className: "er-tag",
    style: {
      color: SEV_DOT[rel.sev],
      borderColor: "currentColor"
    }
  }, rel.tag))), !compact && /*#__PURE__*/React.createElement("p", {
    className: "er-note"
  }, rel.note), rel.sev === "warn" && /*#__PURE__*/React.createElement("div", {
    className: "er-banner"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "info",
    size: 14
  }), "Recordatorio administrativo \u2014 no es una instrucci\xF3n operativa."), /*#__PURE__*/React.createElement("div", {
    className: "er-cite"
  }, /*#__PURE__*/React.createElement("span", {
    className: "brk"
  }), rel.meta, " \u2197"));
}
Object.assign(window, {
  ExpedienteView
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "app/expediente.jsx", error: String((e && e.message) || e) }); }

// app/i18n.jsx
try { (() => {
/* DOCYAN — i18n runtime. t({es, en}) lee window.__LANG (puesto por el harness en
   cada render). Cambiar idioma re-renderiza el árbol → t() relee el valor nuevo.
   El swap ES/EN es del COLABORADOR (usuario multilingüe del brief: piso, ES-MX/EN-US);
   el admin opera en el idioma de la organización. La misma infra sirve para el admin. */
window.__LANG = window.__LANG || "es";
function t(o) {
  if (o == null || typeof o !== "object") return o;
  const l = window.__LANG || "es";
  return l in o ? o[l] : o.es;
}
Object.assign(window, {
  t
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "app/i18n.jsx", error: String((e && e.message) || e) }); }

// app/org-views.jsx
try { (() => {
/* DOCYAN — org views restantes: Ingesta · QRs · Usuarios · Alertas · Gobernanza & FAT · Plan */

/* ---------- Ingesta · Cotizador (Modelo Comercial Canónico v1.1) ----------
   Setup por ingesta · Modelo 2: el cliente carga a su ritmo. Cupo del tier
   cubre las primeras N ($0); el excedente se cotiza con la fórmula y se cobra
   al método de pago al confirmar. NADA de saldo prepagado. */

const PHASES = INGEST_PHASES;
function IngestBatch({
  docs,
  onExit
}) {
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT(x => x + 1), 700);
    return () => clearInterval(id);
  }, []);
  const total = docs.length * PHASES.length;
  const done = Math.min(t, total);
  const pct = Math.round(done / total * 100);
  const finished = done >= total;
  const docState = i => {
    const startedAt = i * PHASES.length;
    if (done <= startedAt) return {
      st: "enc",
      phase: null
    };
    if (done >= startedAt + PHASES.length) return {
      st: "done",
      phase: null
    };
    return {
      st: "proc",
      phase: PHASES[done - startedAt]
    };
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, finished ? /*#__PURE__*/React.createElement("div", {
    className: "chain",
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "ci2"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 18
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "ct"
  }, "Lote completado \xB7 ", docs.length, " documentos vivos"), /*#__PURE__*/React.createElement("div", {
    className: "cm"
  }, "Listos para consultar en CODO-OBR-07")), /*#__PURE__*/React.createElement("button", {
    onClick: onExit
  }, "Ver CoDo")) : /*#__PURE__*/React.createElement("div", {
    className: "batch-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bh-row"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "bh-h"
  }, "Ingiriendo lote \xB7 ", docs.length, " documentos"), /*#__PURE__*/React.createElement("div", {
    className: "bh-sub"
  }, "Procesando ", /*#__PURE__*/React.createElement("b", null, docs[Math.min(Math.floor(done / PHASES.length), docs.length - 1)].name))), /*#__PURE__*/React.createElement("div", {
    className: "bh-eta"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bh-eta-big mono"
  }, "~", Math.max(1, Math.round((total - done) * 0.7 / 6)), " min"), /*#__PURE__*/React.createElement("div", {
    className: "bh-eta-sm"
  }, "restante"))), /*#__PURE__*/React.createElement("div", {
    className: "batch-bar"
  }, /*#__PURE__*/React.createElement("i", {
    style: {
      width: pct + "%"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: "var(--fg-muted)",
      display: "flex",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("span", null, pct, "% del lote"), /*#__PURE__*/React.createElement("span", {
    className: "mono"
  }, done, "/", total, " fases"))), docs.map((d, i) => {
    const s = docState(i);
    const sch = SCHEMA_BY_ID[d.tipo];
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      className: "idoc " + (s.st === "done" ? "done" : s.st === "proc" ? "live" : "")
    }, /*#__PURE__*/React.createElement("span", {
      className: "idoc-ic " + (s.st === "done" ? "done" : s.st === "proc" ? "live" : "")
    }, /*#__PURE__*/React.createElement(Icon, {
      name: s.st === "done" ? "check" : "file-text",
      size: 16
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "idoc-name"
    }, d.name), /*#__PURE__*/React.createElement("div", {
      className: "idoc-sub"
    }, sch ? sch.label : "extracción genérica", " \xB7 ", d.fmt, " \xB7 ", d.pages, " ", d.pages === 1 ? "pág" : "págs")), /*#__PURE__*/React.createElement("span", {
      className: "idoc-st " + s.st
    }, s.st === "done" ? "completado" : s.st === "proc" ? s.phase : "en cola"));
  }));
}
const RESUELTO_META = {
  heuristica: {
    ic: "scan-line",
    txt: "clasificado automáticamente"
  },
  usuario: {
    ic: "user-check",
    txt: "corregido por ti"
  },
  worker_generara: {
    ic: "sparkles",
    txt: "el worker generará el schema"
  }
};

/* Una tarjeta de cotización: tipo clasificado + corrección + avisos + precio. */
function CotizaCard({
  cot,
  tipo,
  resuelto,
  onTipo
}) {
  const sch = SCHEMA_BY_ID[tipo];
  const est = sch ? ESTADO_META[sch.estado] : ESTADO_META.falta;
  const sinSchema = !sch || sch.estado === "falta";
  const conf = Math.round(cot.confianza * 100);
  const rmeta = RESUELTO_META[resuelto] || RESUELTO_META.heuristica;
  const opts = SCHEMAS.map(s => ({
    v: s.id,
    l: s.label + (s.estado !== "activo" ? "  · " + ESTADO_META[s.estado].label.toLowerCase() : "")
  }));
  return /*#__PURE__*/React.createElement("div", {
    className: "cot-card" + (cot.excedente ? " excede" : "")
  }, /*#__PURE__*/React.createElement("div", {
    className: "ct-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ct-ic"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "file-text",
    size: 16
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "ct-name"
  }, cot.name), /*#__PURE__*/React.createElement("div", {
    className: "ct-meta"
  }, cot.fmt, " \xB7 ", cot.pages, " ", cot.pages === 1 ? "pág" : "págs", " \xB7 ", cot.mb.toFixed(1), " MB \xB7 ", (cot.tokens / 1000).toFixed(1), "k tokens")), /*#__PURE__*/React.createElement("div", {
    className: "ct-price"
  }, cot.excedente ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    className: "price-chip cobro"
  }, "$", cot.precioSetupUsd.toFixed(2)), /*#__PURE__*/React.createElement("div", {
    className: "ct-price-sub"
  }, "excede el cupo")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    className: "price-chip incluido"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 13
  }), "Incluido"), /*#__PURE__*/React.createElement("div", {
    className: "ct-price-sub"
  }, "en tu plan \xB7 $0")))), /*#__PURE__*/React.createElement("div", {
    className: "ct-type"
  }, /*#__PURE__*/React.createElement("span", {
    className: "type-badge"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sev-dot " + est.sev
  }), /*#__PURE__*/React.createElement("span", {
    className: "tb-label"
  }, sch ? sch.label : "Tipo no reconocido"), /*#__PURE__*/React.createElement("span", {
    className: "tb-fase"
  }, sch ? sch.estado : "genérica")), /*#__PURE__*/React.createElement("span", {
    className: "ct-resuelto"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: rmeta.ic,
    size: 13
  }), rmeta.txt), /*#__PURE__*/React.createElement("span", {
    className: "ct-conf"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ct-conf-bar"
  }, /*#__PURE__*/React.createElement("i", {
    className: conf < 75 ? "lo" : "",
    style: {
      width: conf + "%"
    }
  })), /*#__PURE__*/React.createElement("span", {
    className: "ct-conf-v"
  }, conf, "%"))), /*#__PURE__*/React.createElement("div", {
    className: "ct-correct"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ccl"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "pencil",
    size: 13
  }), "Corregir tipo"), /*#__PURE__*/React.createElement(Dropdown, {
    value: tipo,
    options: opts,
    icon: "shapes",
    onChange: v => onTipo(v)
  })), sinSchema && /*#__PURE__*/React.createElement("div", {
    className: "cot-notice gen"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "alert-triangle",
    size: 15
  }), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("b", null, "Sin schema dedicado todav\xEDa"), " \u2014 se ingiere con ", /*#__PURE__*/React.createElement("b", null, "extracci\xF3n gen\xE9rica"), " y un schema generado al vuelo. Pierdes la ontolog\xEDa normativa espec\xEDfica de este tipo, pero el documento queda consultable con cita a la fuente.")), cot.ocr && /*#__PURE__*/React.createElement("div", {
    className: "cot-notice ocr"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "scan",
    size: 15
  }), /*#__PURE__*/React.createElement("span", null, "Documento escaneado: el extractor ligero pudo subestimar el texto. El worker re-mide con OCR; ", /*#__PURE__*/React.createElement("b", null, "el costo real puede variar"), ".")));
}

/* Modo conectado: elegir una fuente, conectarla y traer documentos (ingest_sources). */
function FuentesPanel({
  fuenteSel,
  setFuenteSel
}) {
  const sel = FUENTES.find(f => f.id === fuenteSel);
  if (sel) {
    const conectado = sel.estado === "conectado";
    return /*#__PURE__*/React.createElement("div", {
      className: "fuente-detail"
    }, /*#__PURE__*/React.createElement("button", {
      className: "fuente-back",
      onClick: () => setFuenteSel(null)
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "arrow-left",
      size: 15
    }), "Fuentes"), /*#__PURE__*/React.createElement("div", {
      className: "fuente-head"
    }, /*#__PURE__*/React.createElement("span", {
      className: "fuente-ic"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: sel.icon,
      size: 20
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "fuente-l"
    }, sel.label), /*#__PURE__*/React.createElement("div", {
      className: "fuente-d"
    }, conectado ? "Conectado · " + sel.cuenta : sel.desc)), /*#__PURE__*/React.createElement("span", {
      className: "badge " + (conectado ? "ok" : "")
    }, conectado ? "Conectado" : "Sin conectar")), conectado ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      className: "sec-h2",
      style: {
        marginTop: 4
      }
    }, /*#__PURE__*/React.createElement("h2", null, "Documentos en la fuente"), /*#__PURE__*/React.createElement("span", {
      className: "cnt"
    }, FUENTE_DOCS.length, " detectados \xB7 ", sel.docs, " en total")), FUENTE_DOCS.map(d => /*#__PURE__*/React.createElement("div", {
      className: "fuente-doc",
      key: d.id
    }, /*#__PURE__*/React.createElement("span", {
      className: "fd-ic"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "file-text",
      size: 15
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0,
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "fd-n"
    }, d.name), /*#__PURE__*/React.createElement("div", {
      className: "fd-m"
    }, d.fmt, " \xB7 ", d.mb.toFixed(1), " MB \xB7 ", /*#__PURE__*/React.createElement("span", {
      className: "mono"
    }, d.ruta))), /*#__PURE__*/React.createElement("button", {
      className: "mini-btn",
      onClick: () => dcModal({
        icon: "calculator",
        title: "Cotizar documento",
        body: "Se trae “" + d.name + "” desde " + sel.label + " y se añade al lote para cotizar antes de ingerir.",
        confirm: "Añadir al lote",
        doneTitle: "Añadido al lote",
        doneBody: "El documento se clasifica y cotiza junto al resto del lote."
      })
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "plus",
      size: 13
    }), "Al lote"))), /*#__PURE__*/React.createElement("div", {
      className: "manual-note",
      style: {
        marginTop: 12
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "info",
      size: 15
    }), "DOCYAN complementa tu repositorio \u2014 ", /*#__PURE__*/React.createElement("b", null, "no lo reemplaza"), ". Trae copias para hacerlas consultables; nada se mueve ni se borra en la fuente.")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      className: "fuente-form"
    }, sel.id === "ftp" ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      className: "field2"
    }, /*#__PURE__*/React.createElement("label", null, "Host"), /*#__PURE__*/React.createElement("input", {
      className: "codigo-input",
      placeholder: "sftp.lab-estandar.mx"
    })), /*#__PURE__*/React.createElement("div", {
      className: "field2"
    }, /*#__PURE__*/React.createElement("label", null, "Usuario"), /*#__PURE__*/React.createElement("input", {
      className: "codigo-input",
      placeholder: "docyan"
    })), /*#__PURE__*/React.createElement("div", {
      className: "field2"
    }, /*#__PURE__*/React.createElement("label", null, "Ruta remota"), /*#__PURE__*/React.createElement("input", {
      className: "codigo-input",
      placeholder: "/documentos/normas"
    }))) : /*#__PURE__*/React.createElement("div", {
      className: "field2"
    }, /*#__PURE__*/React.createElement("label", null, sel.id === "notion" ? "Token de integración" : "Carpeta / biblioteca a monitorear"), /*#__PURE__*/React.createElement("input", {
      className: "codigo-input",
      placeholder: sel.id === "notion" ? "secret_…" : "ID o enlace de la carpeta"
    }))), /*#__PURE__*/React.createElement("button", {
      className: "btn btn-primary",
      style: {
        width: "100%"
      },
      onClick: () => dcModal({
        icon: sel.icon,
        title: "Conectar " + sel.label,
        body: "Se valida la conexión y, al confirmar, DOCYAN lista los documentos de la fuente para cotizarlos. Las credenciales se guardan cifradas.",
        confirm: "Conectar",
        doneTitle: "Fuente conectada",
        doneBody: "Ya puedes traer documentos de " + sel.label + " al lote."
      })
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "plug",
      size: 15
    }), "Conectar ", sel.label), /*#__PURE__*/React.createElement("div", {
      className: "manual-note",
      style: {
        marginTop: 12
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "shield",
      size: 15
    }), "Credenciales cifradas, por tenant. Solo lectura de la carpeta que elijas \u2014 sin acceso al resto.")));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "fuentes-grid"
  }, FUENTES.map(f => /*#__PURE__*/React.createElement("button", {
    key: f.id,
    className: "fuente-card" + (f.estado === "conectado" ? " conectado" : ""),
    onClick: () => setFuenteSel(f.id)
  }, /*#__PURE__*/React.createElement("span", {
    className: "fuente-ic"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: f.icon,
    size: 20
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "fuente-l"
  }, f.label), /*#__PURE__*/React.createElement("div", {
    className: "fuente-d"
  }, f.estado === "conectado" ? sel_resumen(f) : f.desc)), f.estado === "conectado" ? /*#__PURE__*/React.createElement("span", {
    className: "fuente-dot ok",
    title: "Conectado"
  }) : /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-right",
    size: 16,
    color: "var(--fg-subtle)"
  }))));
}
function sel_resumen(f) {
  return "Conectado · " + f.docs + " documentos";
}
function IngestaView() {
  const [started, setStarted] = useState(false);
  const [modo, setModo] = useState("subir"); // "subir" | "conectar"
  const [fuenteSel, setFuenteSel] = useState(null);
  // estado de corrección de tipo por documento (regla transversal #1)
  const [tipos, setTipos] = useState(() => Object.fromEntries(COTIZACIONES.map(c => [c.id, c.tipo])));
  const [resueltos, setResueltos] = useState(() => Object.fromEntries(COTIZACIONES.map(c => [c.id, c.resuelto])));
  const [showFormula, setShowFormula] = useState(false);
  const setTipo = (id, v) => {
    setTipos(s => ({
      ...s,
      [id]: v
    }));
    setResueltos(s => ({
      ...s,
      [id]: "usuario"
    }));
  };
  const incluidas = COTIZACIONES.filter(c => !c.excedente);
  const excedentes = COTIZACIONES.filter(c => c.excedente);
  const totalCobro = excedentes.reduce((a, c) => a + c.precioSetupUsd, 0);
  const cupoTrasLote = Math.max(0, CUPO_DEMO.restante - incluidas.length);
  const docsConTipo = COTIZACIONES.map(c => ({
    ...c,
    tipo: tipos[c.id]
  }));
  if (started) return /*#__PURE__*/React.createElement(IngestBatch, {
    docs: docsConTipo,
    onExit: () => setStarted(false)
  });
  return /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cupo-banner"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cupo-ic"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "package-check",
    size: 20
  })), /*#__PURE__*/React.createElement("div", {
    className: "cupo-main"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cupo-t"
  }, "Tu plan incluye ingestas sin costo \xB7 te quedan ", /*#__PURE__*/React.createElement("b", null, CUPO_DEMO.restante, " de ", CUPO_DEMO.recurrente), " este mes"), /*#__PURE__*/React.createElement("div", {
    className: "cupo-m"
  }, "Las primeras del lote entran en tu cupo; los ", /*#__PURE__*/React.createElement("b", null, "adicionales desde $", SETUP.pisoUsd), " se cotizan antes de cobrar. T\xFA decides cu\xE1ntos documentos cargas y cu\xE1ndo."), /*#__PURE__*/React.createElement("div", {
    className: "cupo-pips"
  }, Array.from({
    length: CUPO_DEMO.recurrente
  }).map((_, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "cupo-pip " + (i < CUPO_DEMO.recurrente - CUPO_DEMO.restante ? "used" : i < CUPO_DEMO.recurrente - cupoTrasLote ? "free" : "")
  })))), /*#__PURE__*/React.createElement("span", {
    className: "cupo-tier"
  }, "Profesional")), /*#__PURE__*/React.createElement("div", {
    className: "ing-grid"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "ing-modes"
  }, /*#__PURE__*/React.createElement("button", {
    className: "ing-mode" + (modo === "subir" ? " on" : ""),
    onClick: () => setModo("subir")
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "upload-cloud",
    size: 15
  }), "Subir documentos"), /*#__PURE__*/React.createElement("button", {
    className: "ing-mode" + (modo === "conectar" ? " on" : ""),
    onClick: () => setModo("conectar")
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plug",
    size: 15
  }), "Conectar una fuente")), modo === "subir" ? /*#__PURE__*/React.createElement("div", {
    className: "dropzone2",
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "upload-cloud",
    size: 26
  }), /*#__PURE__*/React.createElement("div", {
    className: "dz-t"
  }, "Arrastra documentos o ", /*#__PURE__*/React.createElement("b", null, "selecciona")), /*#__PURE__*/React.createElement("div", {
    className: "dz-m"
  }, "PDF \xB7 DOCX \xB7 XLSX \xB7 im\xE1genes con OCR \xB7 hasta 10 por lote")) : /*#__PURE__*/React.createElement(FuentesPanel, {
    fuenteSel: fuenteSel,
    setFuenteSel: setFuenteSel
  }), /*#__PURE__*/React.createElement("div", {
    className: "sec-h2"
  }, /*#__PURE__*/React.createElement("h2", null, "An\xE1lisis del lote"), /*#__PURE__*/React.createElement("span", {
    className: "cnt"
  }, COTIZACIONES.length, " documentos \xB7 MAXI-10ND")), COTIZACIONES.map(c => /*#__PURE__*/React.createElement(CotizaCard, {
    key: c.id,
    cot: c,
    tipo: tipos[c.id],
    resuelto: resueltos[c.id],
    onTipo: v => setTipo(c.id, v)
  }))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sec-h2"
  }, /*#__PURE__*/React.createElement("h2", null, "Resumen de la ingesta")), /*#__PURE__*/React.createElement("div", {
    className: "sum-rows"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sum-row"
  }, /*#__PURE__*/React.createElement("span", null, "Documentos en el lote"), /*#__PURE__*/React.createElement("b", null, COTIZACIONES.length)), /*#__PURE__*/React.createElement("div", {
    className: "sum-row"
  }, /*#__PURE__*/React.createElement("span", null, "Incluidos en tu cupo"), /*#__PURE__*/React.createElement("b", {
    style: {
      color: "var(--success-600)"
    }
  }, incluidas.length, " \xB7 $0")), /*#__PURE__*/React.createElement("div", {
    className: "sum-row"
  }, /*#__PURE__*/React.createElement("span", null, "Adicionales (\xD7 $", SETUP.pisoUsd, " piso)"), /*#__PURE__*/React.createElement("b", null, excedentes.length)), /*#__PURE__*/React.createElement("div", {
    className: "sum-row"
  }, /*#__PURE__*/React.createElement("span", null, "Tiempo estimado"), /*#__PURE__*/React.createElement("b", null, "~", Math.max(1, Math.round(COTIZACIONES.reduce((a, c) => a + c.tiempoSeg, 0) / 60)), " min")), /*#__PURE__*/React.createElement("div", {
    className: "sum-row total"
  }, /*#__PURE__*/React.createElement("span", null, "Total a cobrar"), /*#__PURE__*/React.createElement("b", null, "$", totalCobro.toFixed(2)))), /*#__PURE__*/React.createElement("div", {
    className: "pay-dest"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pdi"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "credit-card",
    size: 16
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "pdn"
  }, COBRO_DOCYAN.metodoDefault), /*#__PURE__*/React.createElement("div", {
    className: "pdm"
  }, "m\xE9todo de pago \xB7 destino del cobro")), /*#__PURE__*/React.createElement("span", {
    className: "pd-edit"
  }, "Cambiar")), /*#__PURE__*/React.createElement("div", {
    className: "manual-note"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "info",
    size: 15
  }), "Cobro ", /*#__PURE__*/React.createElement("b", null, "manual durante el piloto"), "; Stripe se activa tras los primeros clientes. El monto se reserva al confirmar y se liquida al costo real al completar."), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    style: {
      width: "100%"
    },
    onClick: () => setStarted(true)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "play",
    size: 15
  }), "Confirmar e ingerir", totalCobro > 0 ? " — $" + totalCobro.toFixed(2) : " — sin costo"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11.5,
      color: "var(--fg-subtle)",
      lineHeight: 1.5,
      margin: "12px 0 0",
      textAlign: "center"
    }
  }, "Nada se ingiere sin tu confirmaci\xF3n. El precio se ve antes de cobrar."), /*#__PURE__*/React.createElement("div", {
    className: "formula-box"
  }, /*#__PURE__*/React.createElement("button", {
    className: "formula-h",
    onClick: () => setShowFormula(v => !v)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "function-square",
    size: 14
  }), "C\xF3mo se calcula el precio", /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-right",
    size: 15,
    color: "var(--fg-subtle)",
    className: "chev"
  })), showFormula && /*#__PURE__*/React.createElement("div", {
    className: "formula-body"
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 9px"
    }
  }, "El precio se ancla al ", /*#__PURE__*/React.createElement("b", null, "valor"), ", no al c\xF3mputo (centavos por documento). El cupo del plan cubre las primeras; al excedente se le aplica:"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 11px",
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("code", null, "MAX($", SETUP.pisoUsd, ", costo \xD7 ", SETUP.multiplicador, ") \xD7 ", SETUP.factorComplejidad.toFixed(1))), /*#__PURE__*/React.createElement("div", {
    className: "fb-line"
  }, /*#__PURE__*/React.createElement("span", null, "Piso m\xEDnimo"), /*#__PURE__*/React.createElement("b", null, "$", SETUP.pisoUsd, ".00")), /*#__PURE__*/React.createElement("div", {
    className: "fb-line"
  }, /*#__PURE__*/React.createElement("span", null, "Multiplicador sobre costo"), /*#__PURE__*/React.createElement("b", null, "\xD7", SETUP.multiplicador)), /*#__PURE__*/React.createElement("div", {
    className: "fb-line"
  }, /*#__PURE__*/React.createElement("span", null, "Factor de complejidad"), /*#__PURE__*/React.createElement("b", null, SETUP.factorComplejidad.toFixed(1))), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "9px 0 0",
      color: "var(--fg-subtle)"
    }
  }, "Para casi todo gana el piso; solo documentos enormes (300+ p\xE1gs, OCR pesado) activan el \xD7", SETUP.multiplicador, ". El tipo documental no cambia el precio \u2014 el costo se mide por tokens.")))))));
}

/* ---------- Inteligencia organizacional (Playbooks B/C · mo.py) ---------- */
function InteligenciaView() {
  const [sugs, setSugs] = useState(SUGERENCIAS);
  const [pbs, setPbs] = useState(PLAYBOOKS);
  const [runId, setRunId] = useState(null);
  const aceptar = s => dcModal({
    icon: "git-branch",
    title: "Aceptar como Playbook",
    body: "Se crea un Playbook con los " + s.pasos.length + " pasos de esta secuencia. Quedará en tu biblioteca para correrlo cuando lo necesites; cada paso conserva su cita a la fuente.",
    confirm: "Crear Playbook",
    doneTitle: "Playbook creado",
    doneBody: "Lo encuentras abajo, en tu biblioteca de Playbooks.",
    onConfirm: () => {
      setPbs(p => [{
        id: "pbn" + s.id,
        nombre: s.titulo,
        descripcion: s.detalle,
        codo: s.codo,
        origen: "sugerencia",
        corridas: 0,
        pasos: s.pasos
      }, ...p]);
      setSugs(list => list.filter(x => x.id !== s.id));
    }
  });
  const rechazar = s => setSugs(list => list.filter(x => x.id !== s.id));
  const ignorar = s => setSugs(list => list.filter(x => x.id !== s.id));
  const borrarPb = p => dcModal({
    icon: "trash-2",
    title: "Borrar Playbook",
    body: "Se elimina “" + p.nombre + "” de tu biblioteca. Las consultas guardadas que lo componen no se borran.",
    confirm: "Borrar",
    tone: "danger",
    doneTitle: "Playbook borrado",
    onConfirm: () => setPbs(list => list.filter(x => x.id !== p.id))
  });
  const runPb = pbs.find(p => p.id === runId);
  if (runPb) return /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 660
    }
  }, /*#__PURE__*/React.createElement(PlaybookRun, {
    items: runPb.pasos.map(s => ({
      ...s,
      codoId: runPb.codo,
      cite: runPb.codo
    })),
    onBack: () => setRunId(null)
  })));
  return /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "admin-banner"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sparkles",
    size: 15
  }), "Inteligencia a demanda \u2014 DOCYAN detecta patrones de uso, pero ", /*#__PURE__*/React.createElement("b", null, "no interrumpe"), ". T\xFA decides qu\xE9 se vuelve rutina. Nada se ejecuta sin que lo aceptes."), /*#__PURE__*/React.createElement("div", {
    className: "sec-h2",
    style: {
      marginTop: 18
    }
  }, /*#__PURE__*/React.createElement("h2", null, "Sugerencias"), /*#__PURE__*/React.createElement("span", {
    className: "cnt"
  }, sugs.length, " pendientes \xB7 patrones detectados")), sugs.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      textAlign: "center",
      color: "var(--fg-subtle)",
      fontSize: 13.5,
      padding: "26px 16px"
    }
  }, "Sin sugerencias pendientes. Aparecen cuando el grafo detecta un patr\xF3n de uso repetido.") : sugs.map(s => /*#__PURE__*/React.createElement("div", {
    className: "sug-card",
    key: s.id
  }, /*#__PURE__*/React.createElement("span", {
    className: "sug-ic"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: s.icon,
    size: 17
  })), /*#__PURE__*/React.createElement("div", {
    className: "sug-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sug-t"
  }, s.titulo), /*#__PURE__*/React.createElement("div", {
    className: "sug-d"
  }, s.detalle), /*#__PURE__*/React.createElement("div", {
    className: "sug-meta"
  }, /*#__PURE__*/React.createElement("span", {
    className: "codo-pill"
  }, s.codo), /*#__PURE__*/React.createElement("span", {
    className: "sug-ev"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "activity",
    size: 12
  }), s.evidencia), /*#__PURE__*/React.createElement("span", {
    className: "sug-steps"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "list",
    size: 12
  }), s.pasos.length, " pasos"))), /*#__PURE__*/React.createElement("div", {
    className: "sug-acts"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary sm",
    onClick: () => aceptar(s)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "git-branch",
    size: 14
  }), "Aceptar como Playbook"), /*#__PURE__*/React.createElement("div", {
    className: "sug-acts2"
  }, /*#__PURE__*/React.createElement("button", {
    className: "sug-ghost",
    onClick: () => rechazar(s),
    title: "No es \xFAtil \u2014 descartar"
  }, "Rechazar"), /*#__PURE__*/React.createElement("button", {
    className: "sug-ghost",
    onClick: () => ignorar(s),
    title: "Recu\xE9rdame despu\xE9s"
  }, "Ignorar"))))), /*#__PURE__*/React.createElement("div", {
    className: "sec-h2",
    style: {
      marginTop: 22
    }
  }, /*#__PURE__*/React.createElement("h2", null, "Playbooks"), /*#__PURE__*/React.createElement("button", {
    className: "mini-btn",
    style: {
      marginLeft: "auto"
    },
    onClick: () => dcModal({
      icon: "plus",
      title: "Nuevo Playbook",
      body: "Encadena tus consultas guardadas en una secuencia con nombre. También puedes sembrar Playbooks típicos de tu industria.",
      confirm: "Crear desde consultas guardadas",
      doneTitle: "Listo",
      doneBody: "Selecciona las consultas y su orden para componer el Playbook."
    })
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 14
  }), "Nuevo Playbook")), pbs.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      textAlign: "center",
      color: "var(--fg-subtle)",
      fontSize: 13.5,
      padding: "26px 16px"
    }
  }, "A\xFAn no tienes Playbooks. Acepta una sugerencia o crea uno desde tus consultas guardadas.") : /*#__PURE__*/React.createElement("div", {
    className: "pb-grid"
  }, pbs.map(p => /*#__PURE__*/React.createElement("div", {
    className: "pb-card",
    key: p.id
  }, /*#__PURE__*/React.createElement("div", {
    className: "pb-card-h"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pb-card-ic"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "git-branch",
    size: 16
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "pb-card-n"
  }, p.nombre), /*#__PURE__*/React.createElement("div", {
    className: "pb-card-d"
  }, p.descripcion)), p.origen === "sugerencia" && /*#__PURE__*/React.createElement("span", {
    className: "pb-origen",
    title: "Naci\xF3 de una sugerencia aceptada"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sparkles",
    size: 11
  }), "de sugerencia")), /*#__PURE__*/React.createElement("div", {
    className: "pb-steps"
  }, p.pasos.map((s, i) => /*#__PURE__*/React.createElement("div", {
    className: "pb-step-mini",
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "pb-step-n"
  }, i + 1), s.q))), /*#__PURE__*/React.createElement("div", {
    className: "pb-card-foot"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pb-card-meta"
  }, /*#__PURE__*/React.createElement("span", {
    className: "codo-pill"
  }, p.codo), /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 11,
      color: "var(--fg-subtle)"
    }
  }, p.corridas, " corridas")), /*#__PURE__*/React.createElement("div", {
    className: "pb-card-acts"
  }, /*#__PURE__*/React.createElement("button", {
    className: "pb-act",
    title: "Editar",
    onClick: () => dcModal({
      icon: "pencil",
      title: "Editar Playbook",
      body: "Renombra, reordena o quita pasos de “" + p.nombre + "”.",
      confirm: "Guardar cambios",
      doneTitle: "Cambios guardados"
    })
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "pencil",
    size: 14
  })), /*#__PURE__*/React.createElement("button", {
    className: "pb-act danger",
    title: "Borrar",
    onClick: () => borrarPb(p)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "trash-2",
    size: 14
  })), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary sm",
    onClick: () => setRunId(p.id)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "play",
    size: 13
  }), "Correr")))))));
}

/* ---------- Documentos vivos (mis_documentos · B13) ---------- */
function DocumentosView() {
  const [docs, setDocs] = useState(DOCS_VIVOS);
  const borrar = d => dcModal({
    icon: "trash-2",
    title: "Eliminar documento vivo",
    body: "Se elimina “" + d.name + "” del grafo, sin residuo, y se libera una posición de tu cupo. El evento queda en la bitácora FAT (auditoría), aunque el contenido deje de ser consultable. Para reemplazarlo, vuelve a ingerirlo.",
    confirm: "Eliminar y liberar cupo",
    doneTitle: "Documento eliminado",
    doneBody: "Liberaste una posición de cupo. El registro del borrado quedó en el FAT.",
    tone: "danger",
    onConfirm: () => setDocs(ds => ds.filter(x => x.id !== d.id))
  });
  return /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sec-h2"
  }, /*#__PURE__*/React.createElement("h2", null, "Documentos vivos"), /*#__PURE__*/React.createElement("span", {
    className: "cnt"
  }, docs.length, " consultables \xB7 plan Profesional \xB7 cupo ilimitado")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: "var(--fg-muted)",
      margin: "0 0 14px",
      lineHeight: 1.5
    }
  }, "Todo lo que ingieres queda aqu\xED, consultable y citado. Eliminar un documento lo borra del grafo ", /*#__PURE__*/React.createElement("b", null, "sin residuo"), " y libera cupo del plan; el borrado se registra en el FAT."), /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      padding: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "dv-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dv-c-name"
  }, "Documento"), /*#__PURE__*/React.createElement("span", {
    className: "dv-c-tipo"
  }, "Tipo documental"), /*#__PURE__*/React.createElement("span", {
    className: "dv-c-codo"
  }, "CoDo"), /*#__PURE__*/React.createElement("span", {
    className: "dv-c-meta"
  }, "Detalle"), /*#__PURE__*/React.createElement("span", {
    className: "dv-c-act"
  })), docs.map(d => {
    const sch = SCHEMA_BY_ID[d.tipo];
    const est = sch ? ESTADO_META[sch.estado] : null;
    return /*#__PURE__*/React.createElement("div", {
      className: "dv-row",
      key: d.id
    }, /*#__PURE__*/React.createElement("span", {
      className: "dv-c-name"
    }, /*#__PURE__*/React.createElement("span", {
      className: "dv-ic"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "file-text",
      size: 15
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "dv-n"
    }, d.name), /*#__PURE__*/React.createElement("span", {
      className: "dv-sub"
    }, d.lang, " \xB7 ", d.ver, " \xB7 ", d.pages, " ", d.pages === 1 ? "pág" : "págs"))), /*#__PURE__*/React.createElement("span", {
      className: "dv-c-tipo"
    }, sch ? /*#__PURE__*/React.createElement("span", {
      className: "dv-tipo"
    }, /*#__PURE__*/React.createElement("span", {
      className: "sev-dot " + est.sev
    }), sch.label) : /*#__PURE__*/React.createElement("span", {
      className: "dv-tipo muted"
    }, "gen\xE9rico")), /*#__PURE__*/React.createElement("span", {
      className: "dv-c-codo"
    }, /*#__PURE__*/React.createElement("span", {
      className: "codo-pill"
    }, d.codo)), /*#__PURE__*/React.createElement("span", {
      className: "dv-c-meta mono"
    }, d.ts), /*#__PURE__*/React.createElement("span", {
      className: "dv-c-act"
    }, /*#__PURE__*/React.createElement("button", {
      className: "dv-del",
      title: "Eliminar y liberar cupo",
      onClick: () => borrar(d)
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "trash-2",
      size: 15
    }))));
  }), docs.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "28px 16px",
      textAlign: "center",
      color: "var(--fg-subtle)",
      fontSize: 13.5
    }
  }, "No quedan documentos vivos. Ingiere desde ", /*#__PURE__*/React.createElement("b", null, "Ingesta"), " para empezar.")), /*#__PURE__*/React.createElement("div", {
    className: "manual-note",
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "shield-check",
    size: 15
  }), "Reemplazar = eliminar + volver a ingerir. Al borrar liberas cupo; luego cargas otro dentro del l\xEDmite. El rastro auditable se conserva 7 a\xF1os aunque canceles."));
}

/* ---------- Generar QRs ---------- */
function QRsView() {
  const [sel, setSel] = useState(0);
  const [fmt, setFmt] = useState(1);
  const QC = CODOS.map(c => ({
    v: c.id,
    l: c.id + " · " + c.name
  }));
  const [qc, setQc] = useState(CODOS[0].id);
  const FMTS = ["Etiqueta 5×5cm", "Placa 10×10cm", "Lámina A5"];
  return /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ing-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sec-h2"
  }, /*#__PURE__*/React.createElement("h2", null, "Nuevo QR persistente")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: "var(--fg-muted)",
      margin: "0 0 16px",
      lineHeight: 1.5
    }
  }, "El QR es la puerta del colaborador al CoDo. P\xE9galo f\xEDsicamente en el equipo, lugar o proceso."), /*#__PURE__*/React.createElement("div", {
    className: "field2"
  }, /*#__PURE__*/React.createElement("label", null, "CoDo"), /*#__PURE__*/React.createElement(Dropdown, {
    value: qc,
    options: QC,
    onChange: setQc,
    icon: "folder-tree"
  })), /*#__PURE__*/React.createElement("div", {
    className: "field2"
  }, /*#__PURE__*/React.createElement("label", null, "Entidad referenciada"), /*#__PURE__*/React.createElement(Dropdown, {
    value: (CODOS.find(c => c.id === qc) || CODOS[0]).name,
    options: CODOS.map(c => ({
      v: c.name,
      l: c.name
    })),
    icon: "box"
  })), /*#__PURE__*/React.createElement("div", {
    className: "field2"
  }, /*#__PURE__*/React.createElement("label", null, "Formato f\xEDsico"), /*#__PURE__*/React.createElement("div", {
    className: "fmt-seg2"
  }, FMTS.map((o, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    className: fmt === i ? "on" : "",
    onClick: () => setFmt(i)
  }, o)))), /*#__PURE__*/React.createElement("div", {
    className: "qr-acts"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    onClick: () => dcModal({
      icon: "printer",
      title: "Imprimir QR",
      body: "Se enviará el QR de " + qc + " a la cola de impresión en el formato seleccionado.",
      confirm: "Imprimir",
      doneTitle: "Enviado a impresión",
      doneBody: "El QR está en la cola. Pégalo en el equipo cuando salga."
    })
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "printer",
    size: 15
  }), "Imprimir"), /*#__PURE__*/React.createElement("button", {
    className: "mini-btn",
    onClick: () => dcModal({
      icon: "download",
      title: "Descargar QR",
      body: "El QR se guarda listo para imprimir, en PNG y SVG vectorial.",
      confirm: "Descargar PNG / SVG",
      doneTitle: "Descarga lista"
    })
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "download",
    size: 14
  }), "PNG / SVG"))), /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "sec-h2"
  }, /*#__PURE__*/React.createElement("h2", null, "Previsualizaci\xF3n")), /*#__PURE__*/React.createElement("div", {
    style: {
      alignSelf: "center",
      margin: "4px 0 18px"
    }
  }, /*#__PURE__*/React.createElement(QRPlate, {
    seed: 7,
    label: "CODO-OBR-07 \xB7 MAXI-10ND"
  })), /*#__PURE__*/React.createElement("div", {
    className: "sec-h2"
  }, /*#__PURE__*/React.createElement("h2", null, "Generados recientemente")), [["CODO-OBR-07", "Mezcladora MAXI-10ND", 4], ["CODO-LAB-04", "Centrífuga Hettich", 7], ["CODO-MAQ-02", "CNC Haas VF-2", 11]].map((q, i) => /*#__PURE__*/React.createElement("div", {
    className: "qr-item" + (sel === i ? " on" : ""),
    key: i,
    onClick: () => setSel(i)
  }, /*#__PURE__*/React.createElement(QRPlate, {
    size: 40,
    seed: i + 2
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "qi-ent"
  }, q[1]), /*#__PURE__*/React.createElement("div", {
    className: "qi-codo"
  }, q[0], " \xB7 ", q[2], " impresos")), /*#__PURE__*/React.createElement(Icon, {
    name: "printer",
    size: 15,
    color: "var(--fg-subtle)"
  }))))));
}

/* ---------- Usuarios ---------- */
const ADMINS = [["JM", "Jorge Medina", "Admin · propietario", "—"], ["RC", "Rosa Cantú", "Admin", "$12 / mes"]];
const OPERATORS = [["AR", "Andrés Ríos", "ES-MX", true], ["LP", "L. Peña", "ES-MX", true], ["DK", "D. Kim", "EN-US", false]];
function UsuariosView() {
  return /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sec-h2"
  }, /*#__PURE__*/React.createElement("h2", null, "Admins"), /*#__PURE__*/React.createElement("button", {
    className: "mini-btn",
    style: {
      marginLeft: "auto"
    },
    onClick: () => dcModal({
      icon: "user-plus",
      title: "Invitar admin",
      body: "Se enviará una invitación por correo. Cada admin suma un costo de seat según el plan.",
      confirm: "Enviar invitación",
      doneTitle: "Invitación enviada"
    })
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 14
  }), "Invitar admin")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: "var(--fg-muted)",
      margin: "0 0 6px",
      lineHeight: 1.5
    }
  }, "Cada admin adicional suma un costo de seat seg\xFAn el plan. Los colaboradores son ilimitados y sin costo."), ADMINS.map(([av, name, role, cost], i) => /*#__PURE__*/React.createElement("div", {
    className: "urow",
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "uav ink"
  }, av), /*#__PURE__*/React.createElement("div", {
    className: "uinfo"
  }, /*#__PURE__*/React.createElement("div", {
    className: "un"
  }, name), /*#__PURE__*/React.createElement("div", {
    className: "ur"
  }, role)), /*#__PURE__*/React.createElement("span", {
    className: "useat"
  }, cost), /*#__PURE__*/React.createElement(Icon, {
    name: "more-horizontal",
    size: 16,
    color: "var(--fg-subtle)"
  })))), /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "sec-h2"
  }, /*#__PURE__*/React.createElement("h2", null, "Colaboradores ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 12,
      color: "var(--fg-muted)",
      fontWeight: 400
    }
  }, "21")), /*#__PURE__*/React.createElement("button", {
    className: "mini-btn",
    style: {
      marginLeft: "auto"
    },
    onClick: () => dcModal({
      icon: "user-plus",
      title: "Invitar colaborador",
      body: "Entra por QR, sin costo. Recibirá un enlace para activar su cuenta.",
      confirm: "Enviar invitación",
      doneTitle: "Invitación enviada"
    })
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 14
  }), "Invitar colaborador")), OPERATORS.map(([av, name, lang, ai], i) => /*#__PURE__*/React.createElement("div", {
    className: "urow",
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "uav cin"
  }, av), /*#__PURE__*/React.createElement("div", {
    className: "uinfo"
  }, /*#__PURE__*/React.createElement("div", {
    className: "un"
  }, name), /*#__PURE__*/React.createElement("div", {
    className: "ur"
  }, "Colaborador \xB7 entra por QR")), /*#__PURE__*/React.createElement("div", {
    className: "uprefs"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pref"
  }, lang), /*#__PURE__*/React.createElement("span", {
    className: "pref" + (ai ? " on" : "")
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sparkles",
    size: 12
  }), "IA ", ai ? "on" : "off")), /*#__PURE__*/React.createElement(Icon, {
    name: "more-horizontal",
    size: 16,
    color: "var(--fg-subtle)"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "manual-note",
    style: {
      marginTop: 14,
      marginBottom: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "settings",
    size: 15
  }), "Por usuario: par ling\xFC\xEDstico default, variante regional, permiso de IA proactiva y \"silenciar sugerencias\".")));
}

/* ---------- Alertas ---------- */
const ADMIN_ALERTS = [["warn", "Por vencer · ≤ 7 días", "Calibración — Mezcladora MAXI-10ND", "CODO-OBR-07", "Vence 02 jul · en 4 días", "CAL-22-117"], ["warn", "Por vencer · ≤ 7 días", "Certificado del operador A. Ríos", "Org", "Venció 28 jun", "CERT-OP-AR"], ["caution", "Próximas · ≤ 30 días", "Cambio de aceite SAE-30 programado", "CODO-OBR-07", "En 22 días", "MTTO-OBR-03"], ["caution", "Próximas · ≤ 30 días", "MSDS refrigerante — Centrífuga", "CODO-LAB-04", "Expira 25 jul · en 27 días", "MSDS-REF-03"]];
function AlertasView() {
  const groups = [...new Set(ADMIN_ALERTS.map(a => a[1]))];
  const [cfg, setCfg] = useState(false);
  const [dias, setDias] = useState({
    10: true,
    5: true,
    3: true,
    2: false,
    1: true
  });
  const [mails, setMails] = useState(["jorge@lab-estandar.mx", "rosa@lab-estandar.mx"]);
  const [mailVal, setMailVal] = useState("");
  const [adding, setAdding] = useState(false);
  const toggleDia = d => setDias(s => ({
    ...s,
    [d]: !s[d]
  }));
  const addMail = () => {
    const v = mailVal.trim();
    if (!v || mails.includes(v)) {
      setAdding(false);
      setMailVal("");
      return;
    }
    setMails(m => [...m, v]);
    setMailVal("");
    setAdding(false);
  };
  const delMail = m => setMails(list => list.filter(x => x !== m));
  const diasActivos = Object.keys(dias).filter(d => dias[d]).map(Number).sort((a, b) => b - a);
  return /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "admin-banner"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "info",
    size: 15
  }), "Recordatorio administrativo \u2014 no es una instrucci\xF3n operativa. DOCYAN no emite decisiones cl\xEDnicas u operativas."), /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "alert-cfg-h",
    onClick: () => setCfg(v => !v)
  }, /*#__PURE__*/React.createElement("span", {
    className: "acfg-ic"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "mail",
    size: 16
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      textAlign: "left"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "acfg-t"
  }, "Avisos autom\xE1ticos por correo"), /*#__PURE__*/React.createElement("div", {
    className: "acfg-s"
  }, mails.length, " destinatarios \xB7 ", diasActivos.length ? diasActivos.join(" · ") + " días hábiles antes" : "sin avisos activos")), /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-right",
    size: 16,
    color: "var(--fg-subtle)",
    className: "chev" + (cfg ? " open" : "")
  })), cfg && /*#__PURE__*/React.createElement("div", {
    className: "alert-cfg-body"
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: "var(--fg-muted)",
      margin: "0 0 14px",
      lineHeight: 1.5
    }
  }, "DOCYAN env\xEDa el recordatorio a esta lista, los d\xEDas h\xE1biles que elijas antes de cada vencimiento. Sigue siendo administrativo \u2014 avisa, no instruye."), /*#__PURE__*/React.createElement("div", {
    className: "acfg-field"
  }, /*#__PURE__*/React.createElement("label", null, "Enviar aviso \xB7 d\xEDas h\xE1biles antes del vencimiento"), /*#__PURE__*/React.createElement("div", {
    className: "dias-seg"
  }, [10, 5, 3, 2, 1].map(d => /*#__PURE__*/React.createElement("button", {
    key: d,
    className: "dia-chip" + (dias[d] ? " on" : ""),
    onClick: () => toggleDia(d)
  }, dias[d] && /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 12
  }), d, " ", d === 1 ? "día" : "días")))), /*#__PURE__*/React.createElement("div", {
    className: "acfg-field"
  }, /*#__PURE__*/React.createElement("label", null, "Destinatarios"), /*#__PURE__*/React.createElement("div", {
    className: "mail-list"
  }, mails.map(m => /*#__PURE__*/React.createElement("span", {
    className: "mail-chip",
    key: m
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "user",
    size: 12
  }), m, /*#__PURE__*/React.createElement("button", {
    onClick: () => delMail(m)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 12
  })))), adding ? /*#__PURE__*/React.createElement("span", {
    className: "mail-add"
  }, /*#__PURE__*/React.createElement("input", {
    autoFocus: true,
    type: "email",
    value: mailVal,
    placeholder: "correo@empresa.mx",
    onChange: e => setMailVal(e.target.value),
    onKeyDown: e => {
      if (e.key === "Enter") addMail();
      if (e.key === "Escape") {
        setAdding(false);
        setMailVal("");
      }
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "ok",
    onMouseDown: e => {
      e.preventDefault();
      addMail();
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 14
  }))) : /*#__PURE__*/React.createElement("button", {
    className: "mail-addbtn",
    onClick: () => setAdding(true)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 13
  }), "Agregar correo"))), /*#__PURE__*/React.createElement("div", {
    className: "acfg-foot"
  }, /*#__PURE__*/React.createElement("span", {
    className: "acfg-note"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "info",
    size: 13
  }), "Aplica a todas las alertas por vencer (calibraciones, MSDS, certificados). D\xEDas h\xE1biles: omite fines de semana."), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    onClick: () => dcModal({
      icon: "check",
      title: "Avisos guardados",
      body: "Los avisos se enviarán a " + mails.length + " destinatarios, " + (diasActivos.join(", ") || "—") + " días hábiles antes de cada vencimiento.",
      confirm: "Entendido"
    })
  }, "Guardar avisos")))), groups.map(g => /*#__PURE__*/React.createElement("div", {
    key: g,
    style: {
      marginTop: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "ag-lab"
  }, g), /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      padding: 0
    }
  }, ADMIN_ALERTS.filter(a => a[1] === g).map((a, i) => /*#__PURE__*/React.createElement("div", {
    className: "arow s-" + a[0],
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "aico"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: a[0] === "warn" ? "alarm-clock" : "clock",
    size: 16
  })), /*#__PURE__*/React.createElement("div", {
    className: "ainfo"
  }, /*#__PURE__*/React.createElement("div", {
    className: "at"
  }, a[2]), /*#__PURE__*/React.createElement("div", {
    className: "am"
  }, /*#__PURE__*/React.createElement("span", {
    className: "codo-pill"
  }, a[3]), a[4])), /*#__PURE__*/React.createElement("span", {
    className: "cite-mini"
  }, /*#__PURE__*/React.createElement("span", {
    className: "brk"
  }), a[5], " \u2197"), /*#__PURE__*/React.createElement("div", {
    className: "arow-acts"
  }, /*#__PURE__*/React.createElement("button", null, "Marcar le\xEDda"), /*#__PURE__*/React.createElement("button", null, "Posponer"))))))));
}

/* ---------- Gobernanza & FAT ---------- */
const GRG = [["Seguridad", 0.95, "warn"], ["Regulatorio", 0.90, "warn"], ["Calidad", 0.85, "caution"], ["Operacional", 0.75, "ok"], ["Informativa", 0.60, "ok"]];
const FAT = [["09:14:22", "consulta", "RPM de la olla respondido", "A. Ríos", "CODO-OBR-07", "ok"], ["09:02:10", "gobernanza", "Output bloqueado · confianza 0.71 < 0.95", "sistema", "CODO-OBR-07", "block"], ["08:51:03", "alertas", "Alerta de calibración generada", "sistema", "CODO-OBR-07", "ok"], ["08:40:55", "onboarding", "Colaborador invitado", "J. Medina", "Org", "ok"]];
function GobernanzaView() {
  return /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ing-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sec-h2"
  }, /*#__PURE__*/React.createElement("h2", null, "Configuraci\xF3n GRG"), /*#__PURE__*/React.createElement("span", {
    className: "badge ok",
    style: {
      marginLeft: "auto"
    }
  }, "Tier Profesional")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: "var(--fg-muted)",
      margin: "0 0 10px",
      lineHeight: 1.5
    }
  }, "Umbral de confianza m\xEDnimo para emitir respuesta, por criticidad. Editables por organizaci\xF3n."), GRG.map(([name, th, sev], i) => /*#__PURE__*/React.createElement("div", {
    className: "grg-row",
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "sev-dot " + sev
  }), /*#__PURE__*/React.createElement("span", {
    className: "grg-name"
  }, name), /*#__PURE__*/React.createElement("div", {
    className: "grg-bar"
  }, /*#__PURE__*/React.createElement("i", {
    style: {
      width: th * 100 + "%"
    }
  })), /*#__PURE__*/React.createElement("span", {
    className: "grg-th"
  }, "\u2265", th.toFixed(2))))), /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sec-h2"
  }, /*#__PURE__*/React.createElement("h2", null, "Eventos en cuarentena"), /*#__PURE__*/React.createElement("span", {
    className: "badge warn",
    style: {
      marginLeft: "auto"
    }
  }, "1")), /*#__PURE__*/React.createElement("div", {
    className: "quar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "quar-h"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "shield-alert",
    size: 16
  }), /*#__PURE__*/React.createElement("span", null, "Output bloqueado por el GRG")), /*#__PURE__*/React.createElement("p", {
    className: "quar-q"
  }, "\"\xBFPuedo operar la mezcladora sin la guarda de la olla?\""), /*#__PURE__*/React.createElement("div", {
    className: "quar-meta"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", null, "Regla"), /*#__PURE__*/React.createElement("b", null, "Seguridad \u2265 0.95")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", null, "Confianza"), /*#__PURE__*/React.createElement("b", {
    className: "mono"
  }, "0.71")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", null, "Motivo"), /*#__PURE__*/React.createElement("b", null, "Bajo umbral + tema de seguridad"))), /*#__PURE__*/React.createElement("div", {
    className: "quar-acts"
  }, /*#__PURE__*/React.createElement("button", {
    className: "link-btn"
  }, "Ver razonamiento"), /*#__PURE__*/React.createElement("button", {
    className: "link-btn"
  }, "Escalar a admin"))))), /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "sec-h2"
  }, /*#__PURE__*/React.createElement("h2", null, "FAT \u2014 bit\xE1cora de auditor\xEDa"), /*#__PURE__*/React.createElement("div", {
    className: "exports"
  }, ["PDF", "XML", "JSON", "CSV"].map(f => /*#__PURE__*/React.createElement("button", {
    key: f,
    className: "exp-btn",
    onClick: () => dcModal({
      icon: "download",
      title: "Exportar FAT · " + f,
      body: "Se exporta la bitácora de auditoría completa en " + f + ", con la cadena SHA-256 incluida.",
      confirm: "Exportar " + f,
      doneTitle: "Exportación lista"
    })
  }, f)))), /*#__PURE__*/React.createElement("table", {
    className: "mini-tbl"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Hora"), /*#__PURE__*/React.createElement("th", null, "Familia"), /*#__PURE__*/React.createElement("th", null, "Evento"), /*#__PURE__*/React.createElement("th", null, "Actor"), /*#__PURE__*/React.createElement("th", null, "Entidad"), /*#__PURE__*/React.createElement("th", null))), /*#__PURE__*/React.createElement("tbody", null, FAT.map((r, i) => /*#__PURE__*/React.createElement("tr", {
    key: i
  }, /*#__PURE__*/React.createElement("td", {
    className: "mono"
  }, r[0]), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("span", {
    className: "fam"
  }, r[1])), /*#__PURE__*/React.createElement("td", null, r[2]), /*#__PURE__*/React.createElement("td", null, r[3]), /*#__PURE__*/React.createElement("td", {
    className: "mono"
  }, r[4]), /*#__PURE__*/React.createElement("td", null, r[5] === "block" ? /*#__PURE__*/React.createElement("span", {
    className: "badge warn"
  }, "bloqueado") : /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 14,
    color: "var(--success-600)"
  })))))), /*#__PURE__*/React.createElement("div", {
    className: "chain",
    style: {
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "ci2"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "shield-check",
    size: 18
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "ct"
  }, "Cadena criptogr\xE1fica"), /*#__PURE__*/React.createElement("div", {
    className: "cm"
  }, "SHA-256 \xB7 \xEDntegra \xB7 8,412 eventos encadenados")), /*#__PURE__*/React.createElement("button", {
    onClick: () => dcModal({
      icon: "shield-check",
      title: "Verificar cadena",
      body: "DOCYAN recomputa el hash SHA-256 de los 8,412 eventos y lo compara con el sello.",
      confirm: "Verificar ahora",
      doneTitle: "Cadena íntegra",
      doneBody: "Los 8,412 eventos verifican. Ningún evento fue alterado."
    })
  }, "Verificar"))));
}

/* ---------- Plan ---------- */
function PlanView({
  plan,
  setPlan
}) {
  const actual = plan === "free" ? "free" : "pro";
  const [metodos, setMetodos] = useState(METODOS_PAGO);
  const [addCard, setAddCard] = useState(false);
  const [form, setForm] = useState({
    titular: "",
    num: "",
    exp: "",
    cvv: ""
  });
  const setPrincipal = id => setMetodos(ms => ms.map(m => ({
    ...m,
    principal: m.id === id
  })));
  const delMetodo = m => {
    if (m.principal) {
      dcModal({
        icon: "info",
        title: "No se puede eliminar",
        body: "Es tu método principal. Marca otro como principal antes de eliminar este.",
        confirm: "Entendido"
      });
      return;
    }
    dcModal({
      icon: "trash-2",
      title: "Eliminar método de pago",
      body: "Se elimina “" + m.marca + (m.num ? " ···· " + m.num : "") + "” de tu cuenta.",
      confirm: "Eliminar",
      tone: "danger",
      doneTitle: "Método eliminado",
      onConfirm: () => setMetodos(ms => ms.filter(x => x.id !== m.id))
    });
  };
  const guardarCard = () => {
    const num = form.num.replace(/\s/g, "").slice(-4);
    if (num.length < 4) {
      setAddCard(false);
      return;
    }
    setMetodos(ms => [...ms, {
      id: "mp" + Date.now(),
      tipo: "card",
      marca: "Tarjeta",
      num,
      exp: form.exp || "—",
      titular: form.titular || "—",
      principal: false
    }]);
    setForm({
      titular: "",
      num: "",
      exp: "",
      cvv: ""
    });
    setAddCard(false);
  };
  const planActualLabel = actual === "pro" ? "Profesional" : "Gratuito";
  const [banda, setBanda] = useState(BANDA_DEFAULT);
  const b = BANDAS[banda];
  const precioTier = p => p.tier ? b.tiers[p.tier] : 0;
  return /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sec-h2"
  }, /*#__PURE__*/React.createElement("h2", null, "Tu plan"), /*#__PURE__*/React.createElement("span", {
    className: "cnt"
  }, "Por documentos vivos, no por usuarios \xB7 ", PLAN_ADICIONAL)), /*#__PURE__*/React.createElement("div", {
    className: "banda-bar"
  }, /*#__PURE__*/React.createElement("span", {
    className: "banda-lab"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "globe",
    size: 14
  }), "Banda de precio"), /*#__PURE__*/React.createElement("div", {
    className: "banda-seg"
  }, Object.values(BANDAS).map(bn => /*#__PURE__*/React.createElement("button", {
    key: bn.key,
    className: "banda-chip" + (banda === bn.key ? " on" : ""),
    onClick: () => setBanda(bn.key)
  }, bn.key, " \xB7 ", bn.regions)))), /*#__PURE__*/React.createElement("div", {
    className: "planes4"
  }, PLANES.map(p => {
    const esActual = p.id === "free" && actual === "free" || p.id === "pro" && actual === "pro";
    const precio = precioTier(p);
    return /*#__PURE__*/React.createElement("div", {
      className: "plan4" + (p.rec ? " rec" : "") + (esActual ? " on" : ""),
      key: p.id
    }, p.rec && !esActual && /*#__PURE__*/React.createElement("span", {
      className: "p4-tag rec"
    }, "M\xE1s elegido"), esActual && /*#__PURE__*/React.createElement("span", {
      className: "p4-tag"
    }, "Tu plan"), /*#__PURE__*/React.createElement("div", {
      className: "p4-name"
    }, p.label), /*#__PURE__*/React.createElement("div", {
      className: "p4-docs"
    }, p.docs), /*#__PURE__*/React.createElement("div", {
      className: "p4-price"
    }, p.id === "free" ? /*#__PURE__*/React.createElement(React.Fragment, null, "$0", /*#__PURE__*/React.createElement("small", null, "/mes")) : /*#__PURE__*/React.createElement(React.Fragment, null, p.from && /*#__PURE__*/React.createElement("span", {
      className: "p4-from"
    }, "desde"), fmtUSDDocyan(precio), /*#__PURE__*/React.createElement("small", null, "/mes"))), /*#__PURE__*/React.createElement("div", {
      className: "p4-band"
    }, "Banda ", b.key, " \xB7 ", b.regions), /*#__PURE__*/React.createElement("div", {
      className: "p4-cupo"
    }, p.cupo === null ? "Sin cupo de ingestas" : p.cupo === "negociado" ? "Cupo de ingestas negociado" : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("b", null, p.cupo[0]), " de arranque + ", /*#__PURE__*/React.createElement("b", null, p.cupo[1]), "/mes")), /*#__PURE__*/React.createElement("div", {
      className: "p4-blurb"
    }, p.blurb), /*#__PURE__*/React.createElement("div", {
      className: "p4-feats"
    }, p.feats.map((f, i) => /*#__PURE__*/React.createElement("div", {
      className: "p4-f",
      key: i
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "check",
      size: 14
    }), f))), esActual ? /*#__PURE__*/React.createElement("button", {
      className: "btn btn-ghost",
      style: {
        width: "100%"
      },
      disabled: true
    }, "Plan actual") : p.from ? /*#__PURE__*/React.createElement("button", {
      className: "btn btn-ghost",
      style: {
        width: "100%"
      },
      onClick: () => dcModal({
        icon: "layers",
        title: "Hablar con ventas",
        body: "Enterprise se cotiza a la medida: documentos vivos, cupo de ingestas, SSO/SAML, residencia de datos y on-premise.",
        confirm: "Contactar a ventas",
        doneTitle: "Solicitud enviada"
      })
    }, "Hablar con ventas") : /*#__PURE__*/React.createElement("button", {
      className: "btn " + (p.rec ? "btn-primary" : "btn-ghost"),
      style: {
        width: "100%"
      },
      onClick: () => setPlan(p.id === "free" ? "free" : "pro")
    }, p.id === "free" ? "Cambiar a Gratuito" : p.rec ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Icon, {
      name: "gem",
      size: 15
    }), "Subir a ", p.label) : "Cambiar a " + p.label));
  })), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: "var(--fg-subtle)",
      textAlign: "center",
      margin: "12px 0 0",
      lineHeight: 1.5
    }
  }, "Los tres planes consultan igual de bien. La diferencia es cu\xE1ntos documentos viven en tu entorno. Banda seg\xFAn regi\xF3n \xB7 precios en USD/mes por organizaci\xF3n."), /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      marginTop: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "sec-h2"
  }, /*#__PURE__*/React.createElement("h2", null, "M\xE9todo de pago"), /*#__PURE__*/React.createElement("button", {
    className: "mini-btn",
    style: {
      marginLeft: "auto"
    },
    onClick: () => setAddCard(v => !v)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: addCard ? "x" : "plus",
    size: 14
  }), addCard ? "Cancelar" : "Agregar tarjeta")), addCard && /*#__PURE__*/React.createElement("div", {
    className: "mp-form"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mp-form-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "field2",
    style: {
      gridColumn: "1 / -1"
    }
  }, /*#__PURE__*/React.createElement("label", null, "Titular (nombre completo)"), /*#__PURE__*/React.createElement("input", {
    className: "codigo-input",
    placeholder: "Nombre del titular",
    value: form.titular,
    onChange: e => setForm(f => ({
      ...f,
      titular: e.target.value
    }))
  })), /*#__PURE__*/React.createElement("div", {
    className: "field2",
    style: {
      gridColumn: "1 / -1"
    }
  }, /*#__PURE__*/React.createElement("label", null, "N\xFAmero de tarjeta"), /*#__PURE__*/React.createElement("input", {
    className: "codigo-input",
    placeholder: "4242 4242 4242 4242",
    value: form.num,
    onChange: e => setForm(f => ({
      ...f,
      num: e.target.value
    }))
  })), /*#__PURE__*/React.createElement("div", {
    className: "field2"
  }, /*#__PURE__*/React.createElement("label", null, "Vencimiento"), /*#__PURE__*/React.createElement("input", {
    className: "codigo-input",
    placeholder: "MM/AA",
    value: form.exp,
    onChange: e => setForm(f => ({
      ...f,
      exp: e.target.value
    }))
  })), /*#__PURE__*/React.createElement("div", {
    className: "field2"
  }, /*#__PURE__*/React.createElement("label", null, "CVV"), /*#__PURE__*/React.createElement("input", {
    className: "codigo-input",
    placeholder: "3 d\xEDgitos",
    inputMode: "numeric",
    maxLength: 4,
    value: form.cvv,
    onChange: e => setForm(f => ({
      ...f,
      cvv: e.target.value
    }))
  }))), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    onClick: guardarCard
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 15
  }), "Guardar tarjeta")), metodos.map(m => /*#__PURE__*/React.createElement("div", {
    className: "mp-row",
    key: m.id
  }, /*#__PURE__*/React.createElement("span", {
    className: "mp-ic"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: m.tipo === "card" ? "credit-card" : "building-2",
    size: 16
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "mp-n"
  }, m.marca, m.num ? " ···· " + m.num : ""), /*#__PURE__*/React.createElement("div", {
    className: "mp-m"
  }, m.tipo === "card" ? "Vence " + m.exp + " · " + m.titular : m.detalle)), m.principal ? /*#__PURE__*/React.createElement("span", {
    className: "badge ok"
  }, "Principal") : /*#__PURE__*/React.createElement("button", {
    className: "mp-link",
    onClick: () => setPrincipal(m.id)
  }, "Hacer principal"), /*#__PURE__*/React.createElement("button", {
    className: "mp-del",
    title: "Eliminar",
    onClick: () => delMetodo(m)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "trash-2",
    size: 14
  })))), /*#__PURE__*/React.createElement("div", {
    className: "mp-info"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "info",
    size: 15
  }), "Aceptamos tarjeta, SPEI y OXXO. El cobro de ingestas (Modelo 2: cupo + excedente desde $15) y la suscripci\xF3n se cargan a tu m\xE9todo principal. Durante el piloto el cobro es manual.")), /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "sec-h2"
  }, /*#__PURE__*/React.createElement("h2", null, "C\xF3digo de acceso"), /*#__PURE__*/React.createElement("span", {
    className: "badge ok",
    style: {
      marginLeft: "auto"
    }
  }, "Piloto \u221230%")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: "var(--fg-muted)",
      margin: "0 0 12px",
      lineHeight: 1.5
    }
  }, "\xBFTienes un c\xF3digo de piloto? Canj\xE9alo para activar el plan ", /*#__PURE__*/React.createElement("b", null, "Esencial con \u221230%"), " por 60 d\xEDas, con cupo de ingestas incluido (10 + 3/mes)."), /*#__PURE__*/React.createElement("div", {
    className: "codigo-row"
  }, /*#__PURE__*/React.createElement("input", {
    className: "codigo-input",
    placeholder: "DOCYAN-PILOTO-XXXX"
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-ghost",
    onClick: () => dcModal({
      icon: "ticket",
      title: "Canjear código de acceso",
      body: "Se valida el código y, si es válido, activa el plan piloto (Esencial −30%) con su cupo de ingestas y ventana de 60 días.",
      confirm: "Canjear código",
      doneTitle: "Código canjeado",
      doneBody: "Plan piloto activo. Tu cupo de ingestas ya está disponible en Ingesta."
    })
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "ticket",
    size: 15
  }), "Canjear"))));
}
Object.assign(window, {
  IngestaView,
  QRsView,
  UsuariosView,
  AlertasView,
  GobernanzaView,
  PlanView
});
function SchemasView() {
  const counts = SCHEMAS.reduce((a, s) => {
    a[s.estado] = (a[s.estado] || 0) + 1;
    return a;
  }, {});
  const renderLabel = {
    info: "info_card",
    steps: "procedure_card",
    alerts: "alerts",
    history: "timeline",
    troubleshoot: "árbol del manual",
    bilingual: "vista bilingüe",
    diagram: "diagrama",
    video: "video",
    compare: "comparativa"
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sch-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "sh-t"
  }, "Cat\xE1logo normativo de schemas"), /*#__PURE__*/React.createElement("div", {
    className: "sh-m"
  }, "14 tipos documentales, cerrados, organizados por fase del ciclo de vida del activo. Cada schema se deriva de la norma que rige el documento \u2014 la ontolog\xEDa de extracci\xF3n es lo que la norma exige, ni m\xE1s ni menos.")), /*#__PURE__*/React.createElement("div", {
    className: "sch-legend"
  }, Object.entries(ESTADO_META).map(([k, m]) => /*#__PURE__*/React.createElement("span", {
    className: "sl",
    key: k
  }, /*#__PURE__*/React.createElement("span", {
    className: "sev-dot " + m.sev
  }), m.label, " \xB7 ", counts[k] || 0)))), /*#__PURE__*/React.createElement("div", {
    className: "admin-banner",
    style: {
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "info",
    size: 15
  }), "L\xEDnea absoluta \u2014 DOCYAN presenta lo que el documento dice (vencimientos, faltantes, fechas: s\xED). Diagn\xF3stico, decisi\xF3n cl\xEDnica/operativa o asesor\xEDa legal: jam\xE1s. El profesional decide."), FASES.map(f => {
    const items = SCHEMAS.filter(s => s.fase === f.key);
    if (!items.length) return null;
    return /*#__PURE__*/React.createElement("div", {
      className: "sch-fase",
      key: f.key
    }, /*#__PURE__*/React.createElement("div", {
      className: "sch-fase-h"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: f.icon,
      size: 15
    }), /*#__PURE__*/React.createElement("span", {
      className: "sf-l"
    }, f.label), /*#__PURE__*/React.createElement("span", {
      className: "sf-q"
    }, f.q)), /*#__PURE__*/React.createElement("div", {
      className: "sch-grid"
    }, items.map(s => {
      const est = ESTADO_META[s.estado];
      return /*#__PURE__*/React.createElement("div", {
        className: "sch-card " + s.estado,
        key: s.id
      }, /*#__PURE__*/React.createElement("div", {
        className: "sch-card-h"
      }, /*#__PURE__*/React.createElement("span", {
        className: "sc-id"
      }, s.id)), /*#__PURE__*/React.createElement("div", {
        className: "sch-card-h",
        style: {
          marginTop: -4
        }
      }, /*#__PURE__*/React.createElement("span", {
        className: "sc-l"
      }, s.label), /*#__PURE__*/React.createElement("span", {
        className: "badge " + est.sev
      }, /*#__PURE__*/React.createElement("span", {
        className: "sev-dot " + est.sev
      }), est.label)), /*#__PURE__*/React.createElement("div", {
        className: "sch-norma"
      }, s.norma), s.nota && /*#__PURE__*/React.createElement("div", {
        className: "sch-nota"
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "alert-circle",
        size: 14
      }), s.nota), /*#__PURE__*/React.createElement("div", {
        className: "sch-onto"
      }, s.ontologia.map((o, i) => /*#__PURE__*/React.createElement("span", {
        className: "onto-chip",
        key: i
      }, o))), /*#__PURE__*/React.createElement("div", {
        className: "sch-foot"
      }, s.render.map((r, i) => /*#__PURE__*/React.createElement("span", {
        className: "sf-render",
        key: i
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "layout-template",
        size: 11
      }), renderLabel[r] || r)), /*#__PURE__*/React.createElement("span", {
        className: "sf-prio"
      }, "prioridad ", s.prioridad)));
    })));
  }));
}

/* ---------- Glosario terminológico + lock ---------- */
function GlosTerm({
  g
}) {
  const [vars, setVars] = useState(g.variantes);
  const [canon, setCanon] = useState(g.canonica);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [editIx, setEditIx] = useState(-1);
  const [editVal, setEditVal] = useState("");
  const ob = g.modal ? OBLIGATORIEDAD[g.modal] : null;
  const orig = GLOSARIO_ORIGEN[origenCanonico({
    ...g,
    variantes: vars
  }, canon)] || GLOSARIO_ORIGEN.cliente;
  const addOwn = () => {
    const t = draft.trim();
    if (!t) {
      setAdding(false);
      return;
    }
    if (!vars.some(v => v.t === t)) setVars([...vars, {
      t,
      o: "cliente"
    }]);
    setCanon(t);
    setDraft("");
    setAdding(false);
  };
  const saveEdit = i => {
    const t = editVal.trim();
    if (!t) {
      setEditIx(-1);
      return;
    }
    const prev = vars[i].t;
    // renombrar = localizar → pasa a ser nomenclatura validada por el cliente
    setVars(vars.map((v, k) => k === i ? {
      t,
      o: "cliente"
    } : v));
    if (canon === prev) setCanon(t);
    setEditIx(-1);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "glos-row" + (g.critico ? " critico" : "")
  }, /*#__PURE__*/React.createElement("div", {
    className: "gr-src"
  }, /*#__PURE__*/React.createElement("span", {
    className: "gr-lock",
    title: "T\xE9rmino gobernado \u2014 el lock lo impone como restricci\xF3n dura"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "lock",
    size: 12
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "gr-term"
  }, g.src), /*#__PURE__*/React.createElement("div", {
    className: "gr-lang"
  }, GLOSARIO_PAR.src))), /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-right",
    size: 16,
    color: "var(--fg-subtle)"
  }), /*#__PURE__*/React.createElement("div", {
    className: "gr-tgt"
  }, /*#__PURE__*/React.createElement("div", {
    className: "gr-variants"
  }, vars.map((v, i) => editIx === i ? /*#__PURE__*/React.createElement("span", {
    className: "gr-edit",
    key: i
  }, /*#__PURE__*/React.createElement("input", {
    autoFocus: true,
    className: "gr-input",
    value: editVal,
    onChange: e => setEditVal(e.target.value),
    onKeyDown: e => {
      if (e.key === "Enter") saveEdit(i);
      if (e.key === "Escape") setEditIx(-1);
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "gr-ic ok",
    onMouseDown: e => {
      e.preventDefault();
      saveEdit(i);
    },
    title: "Guardar"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 13
  })), /*#__PURE__*/React.createElement("button", {
    className: "gr-ic",
    onMouseDown: e => {
      e.preventDefault();
      setEditIx(-1);
    },
    title: "Cancelar"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 13
  }))) : /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "gr-var o-" + v.o + (v.t === canon ? " on" : "")
  }, /*#__PURE__*/React.createElement("button", {
    className: "gr-var-pick",
    onClick: () => setCanon(v.t),
    title: v.t === canon ? "Variante canónica del tenant" : "Fijar como canónica"
  }, /*#__PURE__*/React.createElement("span", {
    className: "gr-vdot",
    title: GLOSARIO_ORIGEN[v.o].label
  }), v.t === canon && /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 12
  }), v.t), /*#__PURE__*/React.createElement("button", {
    className: "gr-var-edit",
    onClick: () => {
      setEditIx(i);
      setEditVal(v.t);
    },
    title: "Editar / renombrar"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "pencil",
    size: 11
  })))), adding ? /*#__PURE__*/React.createElement("span", {
    className: "gr-edit add"
  }, /*#__PURE__*/React.createElement("input", {
    autoFocus: true,
    className: "gr-input",
    placeholder: "tu t\xE9rmino\u2026",
    value: draft,
    onChange: e => setDraft(e.target.value),
    onKeyDown: e => {
      if (e.key === "Enter") addOwn();
      if (e.key === "Escape") {
        setAdding(false);
        setDraft("");
      }
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "gr-ic ok",
    onMouseDown: e => {
      e.preventDefault();
      addOwn();
    },
    title: "Agregar"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 13
  })), /*#__PURE__*/React.createElement("button", {
    className: "gr-ic",
    onMouseDown: e => {
      e.preventDefault();
      setAdding(false);
      setDraft("");
    },
    title: "Cancelar"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 13
  }))) : /*#__PURE__*/React.createElement("button", {
    className: "gr-add",
    onClick: () => setAdding(true),
    title: "Agregar tu t\xE9rmino propio (validado por el cliente)"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 12
  }), "t\xE9rmino propio")), /*#__PURE__*/React.createElement("div", {
    className: "gr-tgt-lang"
  }, GLOSARIO_PAR.tgt, " \xB7 el lock impone ", /*#__PURE__*/React.createElement("b", null, canon), " en cada consulta")), /*#__PURE__*/React.createElement("div", {
    className: "gr-meta"
  }, /*#__PURE__*/React.createElement("span", {
    className: "gr-dom"
  }, g.dom), /*#__PURE__*/React.createElement("span", {
    className: "gr-origen " + orig.sev,
    title: orig.desc
  }, /*#__PURE__*/React.createElement("span", {
    className: "sev-dot " + orig.sev
  }), orig.label), /*#__PURE__*/React.createElement("span", {
    className: "gr-anillo",
    title: g.anillo === 1 ? "Anillo 1 — NOM pública, sembrable" : "Anillo 2 — norma licenciada, confinada al tenant"
  }, "Anillo ", g.anillo), ob && /*#__PURE__*/React.createElement("span", {
    className: "gr-modal " + ob.sev,
    title: ob.regla
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "shield-alert",
    size: 11
  }), ob.label)));
}
function GlosarioView() {
  const counts = GLOSARIO.reduce((a, g) => {
    const o = origenCanonico(g);
    a[o] = (a[o] || 0) + 1;
    return a;
  }, {});
  const conVariantes = GLOSARIO.filter(g => g.variantes.length > 1).length;
  const regulatorios = GLOSARIO.filter(g => g.modal).length;
  return /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sch-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "sh-t"
  }, "Glosario terminol\xF3gico \xB7 lock de consulta"), /*#__PURE__*/React.createElement("div", {
    className: "sh-m"
  }, "Los t\xE9rminos gobernados de tu organizaci\xF3n. Antes de mostrar un fragmento traducido al idioma del usuario, el ", /*#__PURE__*/React.createElement("b", null, "lock"), " impone estos t\xE9rminos al modelo como restricci\xF3n dura \u2014 no como sugerencia. El cliente fija su nomenclatura una vez; DOCYAN la respeta en todas las consultas.")), /*#__PURE__*/React.createElement("div", {
    className: "sch-legend"
  }, Object.entries(GLOSARIO_ORIGEN).map(([k, m]) => /*#__PURE__*/React.createElement("span", {
    className: "sl",
    key: k
  }, /*#__PURE__*/React.createElement("span", {
    className: "sev-dot " + m.sev
  }), m.label, " \xB7 ", counts[k] || 0)))), /*#__PURE__*/React.createElement("div", {
    className: "glos-toolbar"
  }, /*#__PURE__*/React.createElement(Dropdown, {
    value: GLOSARIO_PAR.label,
    options: [{
      v: GLOSARIO_PAR.label,
      l: GLOSARIO_PAR.label
    }, {
      v: "es",
      l: "Español (MX) → Inglés"
    }],
    icon: "languages",
    onChange: () => {}
  }), /*#__PURE__*/React.createElement("div", {
    className: "glos-stats"
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("b", null, GLOSARIO.length), " t\xE9rminos"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("b", null, conVariantes), " con variantes"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("b", null, regulatorios), " con carga regulatoria"))), /*#__PURE__*/React.createElement("div", {
    className: "glos-hint"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "info",
    size: 13
  }), "Cada variante muestra su origen \u2014 ", /*#__PURE__*/React.createElement("span", {
    className: "gh-dot o-publico"
  }), "p\xFAblico (NOM) \xB7 ", /*#__PURE__*/React.createElement("span", {
    className: "gh-dot o-grafo"
  }), "del grafo \xB7 ", /*#__PURE__*/React.createElement("span", {
    className: "gh-dot o-cliente"
  }), "tuyo. Elige la can\xF3nica, ", /*#__PURE__*/React.createElement("b", null, "agrega tu t\xE9rmino propio"), " o ren\xF3mbralo: editar una sugerida la convierte en nomenclatura validada por ti."), /*#__PURE__*/React.createElement("div", {
    className: "admin-banner",
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "shield-alert",
    size: 15
  }), "Carga de obligatoriedad \u2014 ", /*#__PURE__*/React.createElement("b", null, "shall"), " \u2260 ", /*#__PURE__*/React.createElement("b", null, "should"), ". Colapsar una obligaci\xF3n en recomendaci\xF3n (o al rev\xE9s) en un MSDS o una NOM cambia el significado regulatorio. El lock preserva la carga; es obligatorio, no opcional."), /*#__PURE__*/React.createElement("div", {
    className: "glos-list"
  }, GLOSARIO.map(g => /*#__PURE__*/React.createElement(GlosTerm, {
    key: g.id,
    g: g
  }))), /*#__PURE__*/React.createElement("div", {
    className: "glos-foot"
  }, /*#__PURE__*/React.createElement("div", {
    className: "glos-foot-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "gf-h"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "git-compare",
    size: 15
  }), "No es una CAT tool"), /*#__PURE__*/React.createElement("p", null, "Una CAT tool gobierna la terminolog\xEDa de un proyecto de traducci\xF3n cerrado, para producir un documento entregable. El lock de DOCYAN gobierna la terminolog\xEDa de una ", /*#__PURE__*/React.createElement("b", null, "consulta viva"), " en el punto de uso \u2014 el operador lee el fragmento con su fuente al lado, v\xEDa QR. Distinta naturaleza, no \"mejor lock\".")), /*#__PURE__*/React.createElement("div", {
    className: "glos-foot-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "gf-h"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "badge-alert",
    size: 15
  }), "Informa, no certifica"), /*#__PURE__*/React.createElement("p", null, "El render asistido siempre lleva su marca ", /*#__PURE__*/React.createElement("span", {
    className: "mono"
  }, "\"traducci\xF3n asistida \u2014 fuente en [idioma]\""), ". Para criticidad alta \u2014valores de seguridad, l\xEDmites de exposici\xF3n, obligaciones normativas\u2014 se muestra ", /*#__PURE__*/React.createElement("b", null, "junto"), " al original, nunca en reemplazo."))));
}
Object.assign(window, {
  IngestaView,
  QRsView,
  UsuariosView,
  AlertasView,
  GobernanzaView,
  PlanView,
  SchemasView,
  GlosarioView,
  DocumentosView,
  InteligenciaView
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "app/org-views.jsx", error: String((e && e.message) || e) }); }

// app/org.jsx
try { (() => {
/* DOCYAN — org views: CoDos list + placeholders (vistas profundas: después) */

function CodosEmpty({
  isFree,
  onNew
}) {
  const steps = [["pencil", "Nombra la entidad", "El equipo, lugar o proceso: una mezcladora, una celda CNC, una centrífuga."], ["upload", "Vincula sus documentos", "Sube manuales, fichas, MSDS y registros como están — DOCYAN los deja consultables."], ["qr-code", "Genera su QR persistente", "Pégalo en el equipo. El colaborador escanea y pregunta, con cita a la fuente."]];
  return /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "codo-empty"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ce-mark"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: isFree ? "files" : "folder-tree",
    size: 30
  })), /*#__PURE__*/React.createElement("h2", null, isFree ? "Aún no tienes documentos vivos" : "Crea tu primer CoDo"), /*#__PURE__*/React.createElement("p", {
    className: "ce-lead"
  }, "Un ", /*#__PURE__*/React.createElement("b", null, "CoDo"), " (Contexto Documental) agrupa los documentos de una entidad en su contexto. Es la unidad con la que tu organizaci\xF3n vuelve consultable su conocimiento."), /*#__PURE__*/React.createElement("div", {
    className: "ce-steps"
  }, steps.map((s, i) => /*#__PURE__*/React.createElement("div", {
    className: "ce-step",
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "ce-n"
  }, i + 1), /*#__PURE__*/React.createElement("span", {
    className: "ce-ic"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: s[0],
    size: 18
  })), /*#__PURE__*/React.createElement("div", {
    className: "ce-st"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ce-stt"
  }, s[1]), /*#__PURE__*/React.createElement("div", {
    className: "ce-stm"
  }, s[2]))))), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary ce-cta",
    onClick: onNew
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 16
  }), isFree ? "Crear mi primer documento vivo" : "Crear mi primer CoDo"), isFree && /*#__PURE__*/React.createElement("div", {
    className: "ce-note"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "gem",
    size: 14
  }), "Plan gratuito \xB7 hasta 3 CoDos. Colaboradores ilimitados, sin costo.")));
}
function CodosList({
  plan,
  openCodo,
  onNew
}) {
  const isFree = plan === "free";
  if (!CODOS.length) return /*#__PURE__*/React.createElement(CodosEmpty, {
    isFree: isFree,
    onNew: onNew
  });
  return /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "list-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lh-t"
  }, /*#__PURE__*/React.createElement("h2", null, isFree ? "Documentos vivos" : "CoDos"), /*#__PURE__*/React.createElement("p", null, isFree ? "Tus documentos consultables, agrupados por entidad." : "Cada CoDo agrupa los documentos de una entidad. Ábrelo para ver su expediente o créalo desde cero.")), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    onClick: onNew
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 16
  }), "Nuevo CoDo")), isFree && /*#__PURE__*/React.createElement("div", {
    className: "usage"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "ut"
  }, "Plan gratuito"), /*#__PURE__*/React.createElement("div", {
    className: "um"
  }, "Te queda 1 CoDo \xB7 27 d\xEDas")), /*#__PURE__*/React.createElement("div", {
    className: "track"
  }, /*#__PURE__*/React.createElement("i", {
    style: {
      width: "66%"
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "num"
  }, /*#__PURE__*/React.createElement("b", null, "2"), " / 3")), /*#__PURE__*/React.createElement("div", {
    className: "codo-grid"
  }, CODOS.map(c => /*#__PURE__*/React.createElement("div", {
    key: c.key,
    className: "codo-card",
    onClick: () => openCodo(c)
  }, /*#__PURE__*/React.createElement("div", {
    className: "ch"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ci"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: c.icon,
    size: 21
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "cid"
  }, c.id), /*#__PURE__*/React.createElement("div", {
    className: "cn"
  }, c.name)), c.alert ? /*#__PURE__*/React.createElement("span", {
    className: "badge warn"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "alarm-clock",
    size: 12
  }), "2 alertas") : /*#__PURE__*/React.createElement("span", {
    className: "badge ok"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 12
  }), "Al d\xEDa")), /*#__PURE__*/React.createElement("div", {
    className: "crow"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cstat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cv"
  }, c.docs), /*#__PURE__*/React.createElement("div", {
    className: "cl"
  }, "docs vivos")), /*#__PURE__*/React.createElement("div", {
    className: "cstat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cv"
  }, c.consultas), /*#__PURE__*/React.createElement("div", {
    className: "cl"
  }, "consultas / 30d")), /*#__PURE__*/React.createElement("div", {
    className: "cstat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cv"
  }, c.colab), /*#__PURE__*/React.createElement("div", {
    className: "cl"
  }, "colaboradores"))))), /*#__PURE__*/React.createElement("div", {
    className: "codo-card new-codo",
    onClick: onNew
  }, /*#__PURE__*/React.createElement("span", {
    className: "ni"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 21
  })), /*#__PURE__*/React.createElement("div", {
    className: "nt"
  }, "Nuevo CoDo"), /*#__PURE__*/React.createElement("div", {
    className: "nm"
  }, "Nombra una entidad, vincula sus documentos y genera su QR."))));
}
function Placeholder({
  eyebrow,
  title,
  lead,
  icon,
  exists,
  feats
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ph-view"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ph-eyebrow"
  }, eyebrow), /*#__PURE__*/React.createElement("h2", null, title), /*#__PURE__*/React.createElement("p", {
    className: "lead"
  }, lead), /*#__PURE__*/React.createElement("div", {
    className: "ph-box"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pic"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 24
  })), /*#__PURE__*/React.createElement("div", {
    className: "pt"
  }, "Vista pendiente de desarrollo"), /*#__PURE__*/React.createElement("div", {
    className: "pm"
  }, "Esta es la siguiente capa del prototipo. Aqu\xED entra el detalle de esta secci\xF3n \u2014 la dejamos como placeholder hasta validar el ensamble general."), feats && /*#__PURE__*/React.createElement("div", {
    className: "ph-feat"
  }, feats.map((f, i) => /*#__PURE__*/React.createElement("span", {
    key: i
  }, f))), exists && /*#__PURE__*/React.createElement("div", {
    className: "exists"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check-circle-2",
    size: 13
  }), "Ya existe en el kit PWA \xB7 ", exists))));
}
const ORG_PLACEHOLDERS = {
  resumen: {
    eyebrow: "Operación",
    title: "Resumen general",
    icon: "layout-dashboard",
    lead: "El pulso de la organización: CoDos activos, hit-rate de caché, costo por consulta y latencia P95.",
    exists: "ResumenView",
    feats: ["KPIs (hit-rate, costo, P95)", "CoDos destacados", "Patrones detectados", "Cupo de ingestas"]
  },
  alertas: {
    eyebrow: "Operación",
    title: "Alertas administrativas",
    icon: "bell",
    lead: "Recordatorios administrativos por vencer — nunca instrucciones operativas. Cada alerta cita su fuente.",
    exists: "AdminAlertsView",
    feats: ["Por vencer ≤7d / ≤30d", "Banner administrativo obligatorio", "Cita por alerta", "Marcar / posponer"]
  },
  ingesta: {
    eyebrow: "Administración",
    title: "Ingesta de documentos",
    icon: "upload",
    lead: "Sube documentos como están: clasificación + cotización por documento, cupo del plan y progreso en vivo por fases.",
    exists: "IngestaView + IngestBatch",
    feats: ["Clasificación + corrección de tipo", "Cupo del plan · fórmula al excedente", "Progreso 5 fases en vivo", "OCR para PDFs de imagen"]
  },
  gobernanza: {
    eyebrow: "Administración",
    title: "Gobernanza & FAT",
    icon: "shield-check",
    lead: "Umbrales de confianza por criticidad, eventos en cuarentena y bitácora de auditoría encadenada con SHA-256.",
    exists: "GobernanzaView",
    feats: ["Umbrales GRG por criticidad", "Cuarentena de outputs", "FAT exportable (PDF/XML/JSON/CSV)", "Cadena criptográfica"]
  },
  qrs: {
    eyebrow: "Administración",
    title: "Generar QRs",
    icon: "qr-code",
    lead: "El QR persistente es la puerta del colaborador al CoDo. Genéralo por entidad y formato físico.",
    exists: "QRsView",
    feats: ["Selección CoDo + entidad", "Formato físico (etiqueta/placa/lámina)", "Imprimir · PNG/SVG", "Generados recientes"]
  },
  usuarios: {
    eyebrow: "Administración",
    title: "Usuarios",
    icon: "users",
    lead: "Admins (con costo de seat) y colaboradores (ilimitados, entran por QR). Preferencias por usuario.",
    exists: "UsuariosView",
    feats: ["Admins + seats", "Colaboradores ilimitados", "Par lingüístico por usuario", "IA proactiva on/off"]
  },
  plan: {
    eyebrow: "Cuenta",
    title: "Plan y facturación",
    icon: "gem",
    lead: "Tu plan, consumo de documentos y opciones para crecer de freemium a profesional.",
    exists: null,
    feats: ["Plan actual + límites", "Consumo de CoDos", "Cupo de ingestas", "Código de acceso · piloto"]
  }
};
function CuentaOrg({
  plan,
  setPlan
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "acct"
  }, /*#__PURE__*/React.createElement("h2", null, "Mi cuenta"), /*#__PURE__*/React.createElement("p", {
    className: "lead"
  }, "Tu perfil, tu organizaci\xF3n y tu seguridad."), /*#__PURE__*/React.createElement("div", {
    className: "acct-sec"
  }, /*#__PURE__*/React.createElement("h3", null, "Perfil"), /*#__PURE__*/React.createElement("div", {
    className: "acct-prof"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pav"
  }, "JM"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "pn"
  }, "Jorge Medina"), /*#__PURE__*/React.createElement("div", {
    className: "pe"
  }, "jorge.medina@lab-estandar.mx"), /*#__PURE__*/React.createElement("div", {
    className: "pr"
  }, "ADMIN \xB7 PROPIETARIO")))), /*#__PURE__*/React.createElement("div", {
    className: "acct-sec"
  }, /*#__PURE__*/React.createElement("h3", null, "Organizaci\xF3n"), /*#__PURE__*/React.createElement("div", {
    className: "acct-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "l"
  }, "Organizaci\xF3n"), /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, "Laboratorio Est\xE1ndar SA de CV")), /*#__PURE__*/React.createElement("div", {
    className: "acct-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "l"
  }, "Par ling\xFC\xEDstico default"), /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, "ES-MX \xB7 EN-US")), /*#__PURE__*/React.createElement("div", {
    className: "acct-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "l"
  }, "Plan"), /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, plan === "free" ? "Gratuito · 2 de 3 CoDos" : "Profesional"), /*#__PURE__*/React.createElement("button", {
    className: "btn-sec",
    onClick: () => setPlan(plan === "free" ? "pro" : "free")
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "gem",
    size: 15
  }), plan === "free" ? "Subir a Profesional" : "Gestionar en módulo Plan"))), /*#__PURE__*/React.createElement("div", {
    className: "acct-sec"
  }, /*#__PURE__*/React.createElement("h3", null, "Seguridad"), /*#__PURE__*/React.createElement("div", {
    className: "acct-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "l"
  }, "Contrase\xF1a"), /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"), /*#__PURE__*/React.createElement("button", {
    className: "btn-sec"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "key-round",
    size: 15
  }), "Cambiar")), /*#__PURE__*/React.createElement("div", {
    className: "acct-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "l"
  }, "Sesi\xF3n"), /*#__PURE__*/React.createElement("span", {
    className: "v"
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn-logout-lg"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "log-out",
    size: 15
  }), "Cerrar sesi\xF3n")))));
}
Object.assign(window, {
  CodosList,
  Placeholder,
  ORG_PLACEHOLDERS,
  CuentaOrg
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "app/org.jsx", error: String((e && e.message) || e) }); }

// app/parts.jsx
try { (() => {
/* DOCYAN — shared parts: Icon, Mark, QR plate */
const {
  useState,
  useEffect,
  useRef
} = React;
function Icon({
  name,
  size = 18,
  color
}) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !window.lucide) return;
    el.innerHTML = "";
    const i = document.createElement("i");
    i.setAttribute("data-lucide", name);
    el.appendChild(i);
    try {
      window.lucide.createIcons();
    } catch (e) {}
  }, [name]);
  return /*#__PURE__*/React.createElement("span", {
    className: "lic",
    ref: ref,
    style: {
      width: size,
      height: size,
      color
    }
  });
}
function Mark({
  size = 24
}) {
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 64 64",
    fill: "none",
    "aria-label": "DOCYAN",
    style: {
      flex: "none"
    }
  }, /*#__PURE__*/React.createElement("g", {
    stroke: "var(--ink-900)",
    strokeWidth: "5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    fill: "none"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M13 23 V13 H23"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M41 13 H51 V23"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M51 41 V51 H41"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M23 51 H13 V41"
  })), /*#__PURE__*/React.createElement("rect", {
    x: "25.5",
    y: "25.5",
    width: "13",
    height: "13",
    rx: "3",
    fill: "#CF4124"
  }));
}
function qrCells(seed) {
  const n = 21,
    on = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const finder = (fx, fy) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7;
    const isFinder = finder(0, 0) || finder(n - 7, 0) || finder(0, n - 7);
    if (isFinder) {
      const rx = x >= n - 7 ? x - (n - 7) : x,
        ry = y >= n - 7 ? y - (n - 7) : y;
      const cx = x < 7 ? x : rx,
        cy = y < 7 ? y : ry;
      const ring = cx === 0 || cx === 6 || cy === 0 || cy === 6,
        core = cx >= 2 && cx <= 4 && cy >= 2 && cy <= 4;
      on.push(ring || core);
    } else on.push((x * 73 + y * 151 + seed * 31 + x * y) % 7 < 3);
  }
  return on;
}
function QRPlate({
  size = 188,
  seed = 7,
  label
}) {
  const cells = qrCells(seed);
  return /*#__PURE__*/React.createElement("div", {
    className: "qr-plate",
    style: {
      width: size + 36
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "qr-frame",
    style: {
      width: size,
      height: size
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "qb tl"
  }), /*#__PURE__*/React.createElement("span", {
    className: "qb tr"
  }), /*#__PURE__*/React.createElement("span", {
    className: "qb bl"
  }), /*#__PURE__*/React.createElement("span", {
    className: "qb br"
  }), /*#__PURE__*/React.createElement("div", {
    className: "qr-grid",
    style: {
      width: size - 30,
      height: size - 30
    }
  }, cells.map((c, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: c ? "m on" : "m"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "qr-logo"
  }, /*#__PURE__*/React.createElement(Mark, {
    size: Math.round(size * 0.15)
  }))), label && /*#__PURE__*/React.createElement("div", {
    className: "qr-cap"
  }, label));
}
Object.assign(window, {
  Icon,
  Mark,
  QRPlate,
  qrCells
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "app/parts.jsx", error: String((e && e.message) || e) }); }

// app/playbook.jsx
try { (() => {
/* DOCYAN — Momento Playbook (capa de apropiación · valor #2).
   Naming PROGRESIVO: la palabra "Playbook" NO aparece hasta que se gana
   (≥2 consultas guardadas del mismo equipo). Antes solo "consulta guardada".
   Compartido por la Guardadas de escritorio (colab.jsx) y móvil (colab-mobile.jsx). */

const {
  useState: usePbState,
  useEffect: usePbEffect
} = React;
const PB_MIN = 2; // umbral para "ganar" el Playbook

/* nudge que introduce el término por primera vez, con su línea explicativa */
function PlaybookNudge({
  onRun
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "pb-nudge"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pb-nh"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "git-branch",
    size: 17
  }), t({
    es: "Secuencia detectada",
    en: "Sequence detected"
  })), /*#__PURE__*/React.createElement("p", null, t({
    es: "Estas consultas tocan el mismo equipo. Un ",
    en: "These queries touch the same equipment. A "
  }), /*#__PURE__*/React.createElement("strong", null, "Playbook"), t({
    es: " es una secuencia que repites como rutina — DOCYAN puede unirlas en una.",
    en: " is a sequence you repeat as a routine — DOCYAN can join them into one."
  })), /*#__PURE__*/React.createElement("button", {
    className: "pb-cta",
    onClick: onRun
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "play",
    size: 15
  }), t({
    es: "Ejecutar como Playbook",
    en: "Run as Playbook"
  })));
}

/* ejecución: la página se compone en tiempo real, paso a paso, con cita por paso */
function PlaybookRun({
  items,
  onBack
}) {
  const [shown, setShown] = usePbState(0);
  usePbEffect(() => {
    if (shown >= items.length) return;
    const id = setTimeout(() => setShown(s => s + 1), shown === 0 ? 240 : 560);
    return () => clearTimeout(id);
  }, [shown, items.length]);
  const codoId = items[0] ? items[0].codoId : "rutina";
  return /*#__PURE__*/React.createElement("div", {
    className: "pb-run"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pb-run-head"
  }, /*#__PURE__*/React.createElement("button", {
    className: "pb-back",
    onClick: onBack
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-left",
    size: 18
  })), /*#__PURE__*/React.createElement("div", {
    className: "pb-run-t"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pb-eyebrow"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "git-branch",
    size: 13
  }), "PLAYBOOK \xB7 ", codoId), /*#__PURE__*/React.createElement("div", {
    className: "pb-run-name"
  }, t({
    es: "Rutina de " + items.length + " pasos",
    en: "Routine of " + items.length + " steps"
  })))), /*#__PURE__*/React.createElement("p", {
    className: "pb-run-sub"
  }, t({
    es: "Se compone en tiempo real, paso a paso. Cada paso conserva su cita a la fuente.",
    en: "It composes in real time, step by step. Each step keeps its citation to the source."
  })), items.slice(0, shown).map((it, i) => /*#__PURE__*/React.createElement("div", {
    className: "pb-step",
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    className: "pb-step-h"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pb-num"
  }, i + 1), /*#__PURE__*/React.createElement("span", {
    className: "pb-q"
  }, it.q)), /*#__PURE__*/React.createElement("div", {
    className: "pb-step-body"
  }, ANSWERS[it.key] ? /*#__PURE__*/React.createElement(AnswerBody, {
    a: ANSWERS[it.key]
  }) : /*#__PURE__*/React.createElement("div", {
    className: "dc-answer"
  }, /*#__PURE__*/React.createElement("div", {
    className: "acard"
  }, /*#__PURE__*/React.createElement("div", {
    className: "q"
  }, it.q), /*#__PURE__*/React.createElement("p", {
    className: "note",
    style: {
      color: "var(--fg)"
    }
  }, t({
    es: "Respuesta consolidada con su cita a la fuente.",
    en: "Consolidated answer with its citation to the source."
  })), /*#__PURE__*/React.createElement("div", {
    className: "citerow"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cite2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "brk"
  }), it.cite, " \u2197"))))))), shown < items.length && /*#__PURE__*/React.createElement("div", {
    className: "pb-composing"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "loader",
    size: 15
  }), t({
    es: "Componiendo paso " + (shown + 1) + " de " + items.length + "\u2026",
    en: "Composing step " + (shown + 1) + " of " + items.length + "\u2026"
  })), shown >= items.length && items.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "pb-done"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check-circle",
    size: 16
  }), t({
    es: "Playbook completo · " + items.length + " consultas encadenadas con su cita",
    en: "Playbook complete · " + items.length + " queries chained with their citations"
  })));
}
Object.assign(window, {
  PlaybookNudge,
  PlaybookRun,
  PB_MIN
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "app/playbook.jsx", error: String((e && e.message) || e) }); }

// app/resumen.jsx
try { (() => {
/* DOCYAN — Resumen (home admin) */

const STATS = [["folder", "CoDos activos", "3", "22 documentos vivos"], ["zap", "Hit-rate caché", "86%", "▲ 4% vs. mes pasado", "up"], ["coins", "Costo / consulta", "$0.011", "promedio 30 días"], ["timer", "Latencia P95", "1.4s", "P50 · 0.3s"]];
const PATTERNS = [["repeat", "3 colaboradores repiten la misma secuencia de arranque en la MAXI-10ND", "Sugerencia de Playbook · últimos 14 días"], ["message-square", "Las consultas de calibración suben antes de cada auditoría", "Patrón estacional · CODO-LAB-04"], ["file-warning", "2 personas anotaron holgura en el mismo acople", "Observación recurrente · 30 días"]];
function ResumenView({
  go,
  openCodo
}) {
  const [verified, setVerified] = useState(false);
  return /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stats"
  }, STATS.map((s, i) => /*#__PURE__*/React.createElement("div", {
    className: "stat",
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    className: "sl"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: s[0],
    size: 12
  }), s[1]), /*#__PURE__*/React.createElement("div", {
    className: "sv"
  }, s[2]), /*#__PURE__*/React.createElement("div", {
    className: "sd"
  }, s[4] === "up" ? /*#__PURE__*/React.createElement("span", {
    className: "up"
  }, s[3].split(" ")[0], " ") : null, s[4] === "up" ? s[3].split(" ").slice(1).join(" ") : s[3])))), /*#__PURE__*/React.createElement("div", {
    className: "sec-h"
  }, /*#__PURE__*/React.createElement("h2", null, "CoDos"), /*#__PURE__*/React.createElement("span", {
    className: "more",
    onClick: () => go("codos")
  }, "Ver todos \u2192")), /*#__PURE__*/React.createElement("div", {
    className: "codo-grid",
    style: {
      marginBottom: 22
    }
  }, CODOS.slice(0, 2).map(c => /*#__PURE__*/React.createElement("div", {
    key: c.key,
    className: "codo-card",
    onClick: () => openCodo(c)
  }, /*#__PURE__*/React.createElement("div", {
    className: "ch"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ci"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: c.icon,
    size: 21
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "cid"
  }, c.id), /*#__PURE__*/React.createElement("div", {
    className: "cn"
  }, c.name)), c.alert ? /*#__PURE__*/React.createElement("span", {
    className: "badge warn"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "alarm-clock",
    size: 12
  }), "2 alertas") : /*#__PURE__*/React.createElement("span", {
    className: "badge ok"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 12
  }), "Al d\xEDa")), /*#__PURE__*/React.createElement("div", {
    className: "crow"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cstat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cv"
  }, c.docs), /*#__PURE__*/React.createElement("div", {
    className: "cl"
  }, "docs vivos")), /*#__PURE__*/React.createElement("div", {
    className: "cstat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cv"
  }, c.consultas), /*#__PURE__*/React.createElement("div", {
    className: "cl"
  }, "consultas / 30d")), /*#__PURE__*/React.createElement("div", {
    className: "cstat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cv"
  }, c.colab), /*#__PURE__*/React.createElement("div", {
    className: "cl"
  }, "colaboradores")))))), /*#__PURE__*/React.createElement("div", {
    className: "two"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sec-h"
  }, /*#__PURE__*/React.createElement("h2", null, "Patrones detectados")), PATTERNS.map((p, i) => /*#__PURE__*/React.createElement("div", {
    className: "pattern",
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    className: "pic"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: p[0],
    size: 16
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "pt"
  }, p[1]), /*#__PURE__*/React.createElement("div", {
    className: "pm"
  }, p[2]))))), /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sec-h"
  }, /*#__PURE__*/React.createElement("h2", null, "Cupo de ingestas"), /*#__PURE__*/React.createElement("span", {
    className: "more",
    onClick: () => go("ingesta")
  }, "Ir a ingesta \u2192")), /*#__PURE__*/React.createElement("div", {
    className: "bal-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "bv"
  }, CUPO_DEMO.restante), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: "var(--fg-muted)"
    }
  }, "de ", CUPO_DEMO.recurrente, " incluidas este mes")), /*#__PURE__*/React.createElement("div", {
    className: "bar"
  }, /*#__PURE__*/React.createElement("i", {
    style: {
      width: 100 * (CUPO_DEMO.recurrente - CUPO_DEMO.restante) / CUPO_DEMO.recurrente + "%"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: "var(--fg-muted)",
      marginTop: 7
    }
  }, "Plan Profesional \xB7 adicionales desde $", SETUP.pisoUsd, ", cotizados antes de cobrar"), /*#__PURE__*/React.createElement("div", {
    className: "chain"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ci2"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "shield-check",
    size: 18
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "ct"
  }, "Cadena criptogr\xE1fica"), /*#__PURE__*/React.createElement("div", {
    className: "cm"
  }, verified ? "SHA-256 · íntegra · 8,412 eventos" : "FAT · SHA-256")), /*#__PURE__*/React.createElement("button", {
    onClick: () => setVerified(true)
  }, verified ? "✓ Verificada" : "Verificar")))));
}
Object.assign(window, {
  ResumenView
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "app/resumen.jsx", error: String((e && e.message) || e) }); }

// app/schemas.jsx
try { (() => {
/* DOCYAN — Modelo canónico de SCHEMAS DOCUMENTALES + ECONOMÍA DE INGESTA.
   ───────────────────────────────────────────────────────────────────────────
   FUENTE DE VERDAD para la implementación (Opus / VS Code). Derivado de:
     · Catálogo Normativo de Schemas v2 — 14 tipos por fase del ciclo de vida.
     · Modelo Comercial Canónico v1.1 — cupo de ingestas + fórmula de setup.
     · Repo docyan-lde-core — cotizador.py · quota_manager.py · pricing_table.py
       · schemas_documentales/ · ingesta.py.

   DOS EJES ORTOGONALES (no confundir):
     A) TIPO DOCUMENTAL (este archivo, SCHEMAS) — qué ontología se extrae según
        la norma que rige el documento. 14 tipos cerrados.
     B) RENDER POR INTENCIÓN (answers.jsx) — cómo se pinta una respuesta.
        Relación muchos-a-muchos: un tipo asigna 1..n renders (campo `render`).

   Línea absoluta (cruza todo): administrativo sí (vencimientos, faltantes);
   diagnóstico / decisión clínica-operativa / asesoría legal, jamás.
   ─────────────────────────────────────────────────────────────────────────── */

/* ╔═══════════════════════════════════════════════════════════════════════╗
   ║  1 · ECONOMÍA DE INGESTA  (Modelo Comercial Canónico v1.1)              ║
   ╚═══════════════════════════════════════════════════════════════════════╝ */

/* Precios públicos vigentes de los modelos (USD por 1M de tokens). pricing_table.py */
const PRICING = {
  asOf: "2026-05-28",
  geminiFlash: {
    in: 0.30,
    out: 2.50
  },
  // extracción / resolución
  gpt4oMini: {
    in: 0.15,
    out: 0.60
  },
  // QA / consulta
  bgeM3PerM: 0.01 // embeddings self-host (cómputo propio)
};

/* Modelo de uso del pipeline: por cada token de documento, cuántos factura cada fase.
   Calibrado contra baselines del PoC (NOM 32pp ≈ $0.036). pricing_table.py */
const USAGE = {
  extractionIn: 1.0,
  extractionOut: 0.5,
  qaIn: 0.3,
  qaOut: 0.1,
  secondsPer1kTokens: 642.0 / 22.4 // ≈ 28.7 s/1k (PoC NOM 32pp ≈ 22.4k tok)
};

/* Cupo de ingestas incluido por tier (setup $0 dentro del cupo). quota_manager.py
   [cupoInicial mes 1, cupoRecurrenteMensual]. Enterprise = negociado. */
const TIERS = {
  freemium: {
    label: "Gratuito",
    cupo: null,
    docLimit: 3,
    ventanaDias: 30,
    saldoCortesiaUsd: 2.0
  },
  esencial: {
    label: "Esencial",
    cupo: [10, 3],
    docLimit: 50
  },
  profesional: {
    label: "Profesional",
    cupo: [30, 10],
    docLimit: null /* ilimitado */
  },
  enterprise: {
    label: "Enterprise",
    cupo: null /* negociado */,
    docLimit: null,
    negociado: true
  },
  piloto: {
    label: "Piloto",
    cupo: [10, 3],
    docLimit: 50,
    descuento: 0.30,
    ventanaDias: 60
  } // Esencial −30%
};

/* Fórmula de cobro de setup — SOLO al excedente del cupo. pricing_table.precio_setup
   precio = MAX(piso, costo_base_real × multiplicador) × factor_complejidad
   Para casi todo gana el PISO ($15); solo documentos monstruosos activan ×25. */
const SETUP = {
  pisoUsd: 15.0,
  multiplicador: 25.0,
  factorComplejidad: 1.0
};

/* Ciclo de vida de impago (Modelo Comercial §4). Días desde el vencimiento. */
const LIFECYCLE = {
  graciaDias: 7,
  // entorno funcional, recordatorios
  suspensionDias: 60,
  // dormido, datos a salvo (acumula a 67)
  cancelacionDia: 67,
  // eliminación del contenido consultable
  retencionFatAnios: 7 // el rastro auditable se retiene aunque se cancele
};

/* Cobro: manual durante el piloto; Stripe tras 3-5 clientes (Modelo Comercial §5.3). */
const COBRO = {
  modo: "manual",
  proveedorDiferido: "stripe",
  metodoDefault: "Visa ···· 4421"
};

/* costo_base_real (USD) de un documento a partir de sus tokens estimados (tiktoken). */
function costoBase(tokens) {
  const m = n => n / 1_000_000;
  const extr = m(tokens * USAGE.extractionIn) * PRICING.geminiFlash.in + m(tokens * USAGE.extractionOut) * PRICING.geminiFlash.out;
  const qa = m(tokens * USAGE.qaIn) * PRICING.gpt4oMini.in + m(tokens * USAGE.qaOut) * PRICING.gpt4oMini.out;
  const emb = m(tokens) * PRICING.bgeM3PerM;
  return extr + qa + emb;
}
/* precio de setup del excedente (gana el piso salvo documentos caros). */
function precioSetup(costoBaseReal, factor) {
  const f = factor == null ? SETUP.factorComplejidad : factor;
  return Math.round(Math.max(SETUP.pisoUsd, costoBaseReal * SETUP.multiplicador) * f * 100) / 100;
}
function tiempoSegPorTokens(tokens) {
  return Math.round(tokens / 1000 * USAGE.secondsPer1kTokens);
}

/* ╔═══════════════════════════════════════════════════════════════════════╗
   ║  2 · FASES DEL CICLO DE VIDA  (eje organizador del catálogo)            ║
   ╚═══════════════════════════════════════════════════════════════════════╝ */
const FASES = [{
  key: "identidad",
  label: "Identidad / especificación",
  q: "¿qué es, qué características tiene?",
  icon: "file-text"
}, {
  key: "instalacion",
  label: "Instalación",
  q: "¿cómo se instala / configura?",
  icon: "wrench"
}, {
  key: "operacion",
  label: "Operación",
  q: "¿cómo se usa / opera?",
  icon: "play"
}, {
  key: "manten",
  label: "Mantenimiento",
  q: "¿cómo se mantiene / repara, cada cuánto?",
  icon: "settings"
}, {
  key: "calibracion",
  label: "Calibración / verificación",
  q: "¿está calibrado, hasta cuándo, con qué trazabilidad?",
  icon: "ruler"
}, {
  key: "calidad",
  label: "Calidad / inspección",
  q: "¿qué se controla, con qué criterio?",
  icon: "shield-check"
}, {
  key: "seguridad",
  label: "Seguridad",
  q: "¿qué peligros, qué protección?",
  icon: "shield-alert"
}, {
  key: "normativo",
  label: "Normativo",
  q: "¿qué exige la ley / norma?",
  icon: "scale"
}, {
  key: "historico",
  label: "Histórico / registro",
  q: "¿qué ha pasado en el tiempo?",
  icon: "history"
}, {
  key: "linguistico",
  label: "Activo lingüístico",
  q: "¿equivalente de término, segmento previo?",
  icon: "languages"
}];

/* ╔═══════════════════════════════════════════════════════════════════════╗
   ║  3 · LOS 14 TIPOS DOCUMENTALES (cerrados)                               ║
   ╚═══════════════════════════════════════════════════════════════════════╝
   estado:  activo  → schema liberado y funcionando en el repo.
            parcial → existe pero pendiente de refinar / subdividir.
            falta   → schema por construir (entra como extracción genérica + aviso).
   render:  keys de answer-kind de answers.jsx (info · steps · alerts · history · bilingual).
   prioridad: orden de implementación aprobado (Catálogo §Prioridad). */
const SCHEMAS = [{
  id: "ficha_tecnica",
  fase: "identidad",
  label: "Ficha técnica",
  estado: "activo",
  prioridad: 5,
  audiencia: "Usuario / técnico",
  norma: "Hoja del fabricante · ASTM/ISO de materiales según producto.",
  ontologia: ["Especificacion (parámetro→valor→unidad→tolerancia)", "Condiciones de prueba", "NormaReferencia"],
  render: ["info"],
  consultas: ["¿valor de X?", "¿tolerancia?", "¿bajo qué norma?"]
}, {
  id: "especificacion",
  fase: "identidad",
  label: "Especificación de ingeniería",
  estado: "activo",
  prioridad: 5,
  audiencia: "Ingeniería / calidad",
  norma: "Especificación de ingeniería · ISO/ASTM del dominio.",
  ontologia: ["Especificacion (requisito)", "Característica (crítica/significativa)", "Método de verificación", "Norma aplicable"],
  render: ["info"],
  consultas: ["¿requisito de X?", "¿cómo se verifica?", "¿es característica crítica?"]
}, {
  id: "instructivo",
  fase: "instalacion",
  label: "Instructivo de producto",
  estado: "falta",
  prioridad: 4,
  audiencia: "Usuario final",
  norma: "IEC/IEEE 82079-1 · NOM-018-STPS · NOM-024-SCFI (instructivos y garantías, MX).",
  ontologia: ["Procedimiento→Paso (uso/instalación)", "Advertencia", "Requisito previo", "Símbolos de seguridad"],
  render: ["steps"],
  consultas: ["¿cómo se configura / instala?", "¿qué advertencia aplica?", "¿qué requiere antes de usar?"]
}, {
  id: "manual_instalacion",
  fase: "instalacion",
  label: "Manual de instalación",
  estado: "falta",
  prioridad: 4,
  audiencia: "Equipo de instalación",
  norma: "Fabricante + NOM de instalación del dominio (NOM-001-SEDE eléctrica, gas, etc.).",
  ontologia: ["Especificacion (tolerancias, anclajes)", "Procedimiento→Paso", "Requisitos de sitio/servicios", "Advertencia", "Herramienta"],
  render: ["info", "steps"],
  consultas: ["¿qué requisitos de sitio?", "¿cómo se ancla / conecta?", "¿qué tolerancia de instalación?"]
}, {
  id: "manual_operacion",
  fase: "operacion",
  label: "Manual de operación",
  estado: "parcial",
  prioridad: 1,
  audiencia: "Operador / técnico",
  norma: "Fabricante + IEC 82079-1 · residual-risk warnings (directiva de maquinaria).",
  nota: "Subdivisión de manual_tecnico (hoy un solo tipo en el repo). Prioridad 1.",
  ontologia: ["Especificacion (rangos, capacidades)", "Procedimiento→Paso (operación)", "Advertencia / riesgo residual", "Controles / indicadores"],
  render: ["info", "steps"],
  consultas: ["¿rango / capacidad?", "¿cómo se opera X?", "¿qué significa el indicador Y?"]
}, {
  id: "manual_mantenimiento",
  fase: "manten",
  label: "Manual de mantenimiento",
  estado: "parcial",
  prioridad: 1,
  audiencia: "Técnico de mantenimiento",
  norma: "Fabricante + O&M (MIMOSA/ISO 14224) · satisface OSHA/ISO de registros.",
  nota: "Subdivisión de manual_tecnico. Prioridad 1. Troubleshooting = SOLO como lo dice el manual, jamás diagnóstico del caso (línea absoluta).",
  ontologia: ["FechaVencimiento / intervalo (→alertas)", "Procedimiento→Paso (preventivo/correctivo)", "Componente (lubricación/insumos)", "Troubleshooting síntoma→causa→acción (del manual)", "Herramienta", "Refacción"],
  render: ["steps", "alerts", "info", "troubleshoot"],
  consultas: ["¿cada cuánto mantenimiento?", "¿cómo se repara X?", "¿qué dice el manual del síntoma Y?", "¿qué refacción usa?"]
}, {
  id: "instruccion_trabajo",
  fase: "operacion",
  label: "Instrucción de trabajo",
  estado: "falta",
  prioridad: 4,
  audiencia: "Operador en piso, punto de uso",
  norma: "SGC del cliente — ISO 9001 §7.5 + IATF 16949 + NOM-018 seguridad.",
  ontologia: ["Procedimiento→Paso (tarea)", "Responsable / rol por paso", "EquipoProteccion por paso", "Especificacion (criterio de aceptación)", "Registros requeridos", "Documento padre / versión"],
  render: ["steps"],
  consultas: ["¿cómo se hace esta tarea?", "¿quién es responsable?", "¿qué EPP exige?", "¿criterio de aceptación?"]
}, {
  id: "certificado_calibracion",
  fase: "calibracion",
  label: "Certificado de calibración",
  estado: "activo",
  prioridad: 1,
  audiencia: "Metrología / calidad",
  norma: "ISO/IEC 17025:2017 §7.8 · trazabilidad CENAM / acreditación EMA (MX).",
  ontologia: ["Instrumento (marca/modelo/serie)", "MedicionRegistrada (nominal/medido/desviación)", "Especificacion (incertidumbre + factor k)", "TrazabilidadPatron (NIST/CENAM)", "FechaVencimiento / CertificadoVigencia", "Responsable (firmante)"],
  render: ["info", "alerts"],
  consultas: ["¿cuándo vence?", "¿trazable a qué patrón?", "¿incertidumbre?", "¿desviación en X punto?"]
}, {
  id: "plan_control",
  fase: "calidad",
  label: "Plan de control",
  estado: "falta",
  prioridad: 3,
  audiencia: "Calidad / manufactura",
  norma: "IATF 16949 + manual AIAG (Control Plan) · APQP.",
  nota: "Cruce con calibración: instrumento referenciado ↔ certificado vigente (oro para el lab embajador).",
  ontologia: ["Operación / proceso", "Característica con clasificación", "Especificacion (+tolerancia)", "Instrumento (cruce con calibración)", "Frecuencia de inspección", "Plan de reacción (Procedimiento)"],
  render: ["info", "alerts"],
  consultas: ["¿qué se mide en operación X?", "¿con qué instrumento / frecuencia?", "¿tolerancia?", "¿plan de reacción?"]
}, {
  id: "protocolo_inspeccion",
  fase: "calidad",
  label: "Protocolo de inspección",
  estado: "falta",
  prioridad: 5,
  audiencia: "Inspección / calidad",
  norma: "ISO 17020 (organismos de inspección) / protocolos del SGC · checklists.",
  ontologia: ["PuntoInspeccion", "Especificacion (criterio aceptación/rechazo)", "Método / instrumento", "Frecuencia", "Registro de resultado"],
  render: ["info", "steps"],
  consultas: ["¿qué se inspecciona?", "¿criterio de aceptación?", "¿con qué método?"]
}, {
  id: "hoja_seguridad",
  fase: "seguridad",
  label: "Hoja de seguridad (SDS/MSDS)",
  estado: "activo",
  prioridad: 1,
  audiencia: "Operador / EHS",
  norma: "GHS 16 secciones / NOM-018-STPS-2015. Cubre GHS y pre-GHS (hojas viejas ES).",
  nota: "Datos negativos explícitos se extraen como datos (\"punto de inflamación: NINGUNO\") — freno de alucinación. Filtra nombres genéricos (\"El Material\").",
  ontologia: ["Sustancia (comercial/químico/NumeroCAS)", "Componente (% composición)", "Riesgo (categorías GHS)", "Procedimiento (primeros auxilios)", "Especificacion (PEL/TLV/IDLH)", "EquipoProteccion", "Propiedades físicas", "MedidaProteccion"],
  render: ["info", "steps"],
  consultas: ["¿cómo se llama el químico?", "¿PEL?", "¿punto de inflamación?", "¿EPP?", "¿qué hago si derrame?"]
}, {
  id: "norma_ley_reglamento",
  fase: "normativo",
  label: "Norma / ley / reglamento",
  estado: "falta",
  prioridad: 2,
  audiencia: "Cumplimiento / legal",
  norma: "Estructura jurídico-normativa: títulos→capítulos→artículos→fracciones→incisos→transitorios (MX); 29 CFR (OSHA); cláusulas (ISO/NOM).",
  nota: "Habilita el Acervo Normativo precargado (tenant común de solo lectura). Render lleva descargo obligatorio: texto de la norma, no asesoría legal.",
  ontologia: ["Articulo / Clausula (número, texto, jerarquía)", "Obligacion (con sujeto)", "TerminoTecnico (definiciones)", "REFERENCIA_NORMATIVA (cruzadas)", "Vigencia / reformas (fecha DOF)", "Ámbito"],
  render: ["info"],
  consultas: ["¿qué dice el artículo X?", "¿qué obliga a [sujeto]?", "¿cómo define [término]?", "¿vigente?"]
}, {
  id: "registro_historico",
  fase: "historico",
  label: "Registro histórico / bitácora",
  estado: "falta",
  prioridad: 6,
  audiencia: "Operación / calidad",
  norma: "ISO 17025 (registros) / retención del SGC · bitácoras O&M.",
  nota: "Tendencia SOLO como datos presentados (frecuencia-sí / causa-no): muestra la serie citada, jamás \"se está degradando\".",
  ontologia: ["EventoOperativo (serie fechada)", "Activo asociado", "Resultado por evento"],
  render: ["history"],
  consultas: ["¿última / próxima calibración?", "¿historial del activo X?"]
}, {
  id: "memoria_traduccion",
  fase: "linguistico",
  label: "Memoria de traducción",
  estado: "falta",
  prioridad: 6,
  audiencia: "Agencias / lingüístico (Pista B)",
  norma: "Formatos CAT: TMX / XLIFF / TBX / SDLXLIFF / Bilingual DOCX.",
  nota: "Conecta con el sprint de lock terminológico (L2+L3). PTM segregada estricta por par lingüístico.",
  ontologia: ["Segmento origen↔destino (por par lingüístico)", "Término↔equivalente (lock terminológico)", "Metadatos de proyecto"],
  render: ["bilingual"],
  consultas: ["¿equivalente de término X?", "¿segmento previo de Y?"]
}];
const SCHEMA_BY_ID = Object.fromEntries(SCHEMAS.map(s => [s.id, s]));
const ESTADO_META = {
  activo: {
    label: "Activo",
    sev: "ok",
    desc: "Schema liberado y funcionando."
  },
  parcial: {
    label: "Parcial",
    sev: "caution",
    desc: "Existe; pendiente de refinar / subdividir."
  },
  falta: {
    label: "Por construir",
    sev: "warn",
    desc: "Sin schema aún → extracción genérica + aviso honesto."
  }
};

/* ╔═══════════════════════════════════════════════════════════════════════╗
   ║  4 · COTIZACIÓN DEMO — lote MAXI-10ND, tenant Profesional               ║
   ╚═══════════════════════════════════════════════════════════════════════╝
   Reglas transversales en juego:
     #1 tipo declarado = tipo real → el clasificador asigna, el cotizador muestra,
        el usuario corrige (tipoForzado) antes de aprobar.
     #2 tipo sin schema → extracción genérica + aviso honesto pre-ingesta.
   resuelto: "heuristica" | "usuario" | "worker_generara"
   cupo:     true = incluido en el plan ($0) · false = excedente (fórmula). */
const CUPO_DEMO = {
  tier: "profesional",
  restante: 2,
  recurrente: 10,
  inicial: 30
}; // 2 incluidas restantes este mes

function _cot(d) {
  const cb = costoBase(d.tokens);
  const excedente = !d.cupo;
  return {
    ...d,
    costoBaseUsd: Math.round(cb * 10000) / 10000,
    precioSetupUsd: excedente ? precioSetup(cb) : 0,
    tiempoSeg: tiempoSegPorTokens(d.tokens),
    excedente
  };
}
const COTIZACIONES = [_cot({
  id: "c1",
  name: "Instrucciones de operación — MAXI-10ND",
  fmt: "PDF",
  pages: 12,
  mb: 1.2,
  tokens: 6200,
  tipo: "manual_operacion",
  resuelto: "heuristica",
  confianza: 0.92,
  cupo: true
}), _cot({
  id: "c2",
  name: "Lista de partes — MAXI-10ND",
  fmt: "PDF",
  pages: 17,
  mb: 1.6,
  tokens: 8400,
  tipo: "ficha_tecnica",
  resuelto: "heuristica",
  confianza: 0.88,
  cupo: true
}), _cot({
  id: "c3",
  name: "Ficha técnica — MAXI-10ND",
  fmt: "PDF · OCR",
  pages: 1,
  mb: 0.3,
  tokens: 520,
  tipo: "ficha_tecnica",
  resuelto: "heuristica",
  confianza: 0.95,
  cupo: false
}), _cot({
  id: "c4",
  name: "NOM-018-STPS — pictogramas",
  fmt: "PDF escaneado",
  pages: 12,
  mb: 0.7,
  tokens: 5900,
  tipo: "norma_ley_reglamento",
  resuelto: "heuristica",
  confianza: 0.61,
  cupo: false,
  ocr: true
})];

/* Fases del worker al ingerir (progreso). org-views IngestBatch las consume. */
const INGEST_PHASES = ["Descarga", "Conversión", "Extracción", "Escritura a grafo", "Deduplicación"];

/* ╔═══════════════════════════════════════════════════════════════════════╗
   ║  5 · GLOSARIO TERMINOLÓGICO + LOCK  (Lock Terminológico Canónico)       ║
   ╚═══════════════════════════════════════════════════════════════════════╝
   El lock es función del ENTORNO DE CONSULTA (MVP, no Nivel 4): impone el término
   gobernado como restricción DURA sobre el modelo antes de generar el render
   asistido. No es CAT tool, no es sugerencia verbal, no certifica traducción.

   Tres orígenes de las entradas (§1b):
     publico → glosario público (NOM Anillo 1, texto DOF, sembrable).
     grafo   → entidad que el grafo ya extrajo al ingerir (reutiliza ingesta).
     cliente → nomenclatura interna validada por el cliente = FOSO (Nivel 3).
   Anillo (§5): 1 = NOM pública sembrable · 2 = ISO/IATF licenciada, confinada al tenant.
   Obligatoriedad (§4): shall/must → obligación · should → recomendación · may → permiso.
     NUNCA colapsar (shall≠should): cambia el significado regulatorio. */
const GLOSARIO_PAR = {
  src: "EN-US",
  tgt: "ES-MX",
  label: "Inglés → Español (MX)"
};
const GLOSARIO_ORIGEN = {
  publico: {
    label: "Público",
    sev: "info",
    desc: "Glosario público — NOM Anillo 1 (DOF)."
  },
  grafo: {
    label: "Del grafo",
    sev: "caution",
    desc: "Entidad extraída al ingerir el documento."
  },
  cliente: {
    label: "Validado por el cliente",
    sev: "ok",
    desc: "Nomenclatura interna del tenant — activo propietario."
  }
};
const OBLIGATORIEDAD = {
  shall: {
    label: "shall · obligación",
    sev: "warn",
    regla: "→ deberá / debe · NUNCA 'debería'"
  },
  must: {
    label: "must · obligación",
    sev: "warn",
    regla: "→ deberá / debe · NUNCA 'debería'"
  },
  should: {
    label: "should · recomendación",
    sev: "caution",
    regla: "→ debería / se recomienda"
  },
  may: {
    label: "may · permiso",
    sev: "info",
    regla: "→ puede / podrá"
  }
};

/* Entradas del glosario. `variantes` = conjunto (§2), cada una con su ORIGEN
   propio (§1b: publico/grafo/cliente). `canonica` = la elegida por el tenant
   (el lock la impone consistente). El usuario puede AGREGAR su término propio
   (→ origen cliente, el foso) y RENOMBRAR una sugerida (renombrar = localizar =
   pasa a ser validada por el cliente). `modal` = categoría de obligatoriedad. */
const GLOSARIO = [{
  id: "g1",
  src: "torque",
  variantes: [{
    t: "par de apriete",
    o: "cliente"
  }, {
    t: "torsión",
    o: "publico"
  }, {
    t: "torque",
    o: "grafo"
  }],
  canonica: "par de apriete",
  dom: "Norma mecánica",
  anillo: 2,
  modal: null,
  cite: "Manual VF-2 · §4.2 · la planta usa 'par de apriete'"
}, {
  id: "g2",
  src: "shall",
  variantes: [{
    t: "deberá",
    o: "publico"
  }, {
    t: "debe",
    o: "publico"
  }],
  canonica: "deberá",
  dom: "Regulatorio",
  anillo: 1,
  modal: "shall",
  cite: "NOM-018-STPS-2015 · cláusula de obligación"
}, {
  id: "g3",
  src: "should",
  variantes: [{
    t: "debería",
    o: "publico"
  }, {
    t: "se recomienda",
    o: "publico"
  }],
  canonica: "debería",
  dom: "Regulatorio",
  anillo: 1,
  modal: "should",
  cite: "ISO/IEC 82079-1 · recomendación"
}, {
  id: "g4",
  src: "may",
  variantes: [{
    t: "puede",
    o: "publico"
  }, {
    t: "podrá",
    o: "publico"
  }],
  canonica: "puede",
  dom: "Regulatorio",
  anillo: 1,
  modal: "may",
  cite: "NOM-018-STPS-2015 · permiso"
}, {
  id: "g5",
  src: "flammable: NONE",
  variantes: [{
    t: "no inflamable",
    o: "grafo"
  }, {
    t: "ninguno (no inflamable)",
    o: "grafo"
  }],
  canonica: "no inflamable",
  dom: "MSDS / Seguridad",
  anillo: 1,
  modal: null,
  critico: true,
  cite: "SDS MAXI · §9 · dato negativo explícito — no colapsar a 'inflamable'"
}, {
  id: "g6",
  src: "lock-out/tag-out",
  variantes: [{
    t: "bloqueo/etiquetado (LOTO)",
    o: "cliente"
  }, {
    t: "bloqueo y etiquetado",
    o: "publico"
  }],
  canonica: "bloqueo/etiquetado (LOTO)",
  dom: "Seguridad",
  anillo: 2,
  modal: null,
  cite: "Procedimiento de seguridad · cliente fija sigla LOTO"
}, {
  id: "g7",
  src: "bearing",
  variantes: [{
    t: "rodamiento",
    o: "publico"
  }, {
    t: "balero",
    o: "cliente"
  }, {
    t: "cojinete",
    o: "grafo"
  }],
  canonica: "balero",
  dom: "Norma mecánica",
  anillo: 2,
  modal: null,
  cite: "Lista de partes MAXI · la planta usa 'balero'"
}, {
  id: "g8",
  src: "coolant filter",
  variantes: [{
    t: "filtro de refrigerante",
    o: "grafo"
  }, {
    t: "filtro de líquido refrigerante",
    o: "publico"
  }],
  canonica: "filtro de refrigerante",
  dom: "Norma mecánica",
  anillo: 2,
  modal: null,
  cite: "Manual VF-2 · §6 mantenimiento"
}];
/* origen del término actualmente canónico (para el badge/leyenda). */
function origenCanonico(g, canonica) {
  const c = canonica == null ? g.canonica : canonica;
  const v = g.variantes.find(x => x.t === c);
  return v ? v.o : "cliente";
}

/* ╔═══════════════════════════════════════════════════════════════════════╗
   ║  6 · MODO CONECTADO DE INGESTA  (ingest_sources.py)                     ║
   ╚═══════════════════════════════════════════════════════════════════════╝
   Conectar un repositorio del cliente y traer documentos desde ahí. DOCYAN
   complementa el sistema de registro, no lo reemplaza (sin ERP/CRM/email). */
const FUENTES = [{
  id: "google_drive",
  label: "Google Drive",
  icon: "hard-drive",
  desc: "Carpeta o unidad compartida",
  estado: "conectado",
  cuenta: "ops@lab-estandar.mx",
  docs: 38
}, {
  id: "onedrive",
  label: "OneDrive / SharePoint",
  icon: "cloud",
  desc: "Biblioteca de documentos",
  estado: "disponible"
}, {
  id: "ftp",
  label: "FTP / SFTP",
  icon: "server",
  desc: "Servidor de archivos por ruta",
  estado: "disponible"
}, {
  id: "notion",
  label: "Notion",
  icon: "book-open",
  desc: "Wiki como fuente documental",
  estado: "disponible"
}];
/* Documentos detectados en una fuente conectada (listos para cotizar). */
const FUENTE_DOCS = [{
  id: "fd1",
  name: "Manual de mantenimiento — Bomba CIPSA",
  fmt: "PDF",
  mb: 2.1,
  ruta: "/Manuales/2025"
}, {
  id: "fd2",
  name: "Certificado calibración — Báscula B-12",
  fmt: "PDF",
  mb: 0.4,
  ruta: "/Metrología"
}, {
  id: "fd3",
  name: "SDS — Aditivo acelerante",
  fmt: "PDF",
  mb: 0.6,
  ruta: "/Seguridad/SDS"
}];

/* ╔═══════════════════════════════════════════════════════════════════════╗
   ║  7 · DOCUMENTOS VIVOS  (mis_documentos.py · B13)                        ║
   ╚═══════════════════════════════════════════════════════════════════════╝
   Los :DocumentoSource del grafo del tenant. El cliente los lista y los ELIMINA
   (sin residuo → libera cupo del plan). El evento de borrado queda en el FAT
   aunque el contenido consultable se elimine (retención FAT respetada). */
const DOCS_VIVOS = [{
  id: "dv1",
  name: "Instrucciones de operación — MAXI-10ND",
  tipo: "manual_operacion",
  codo: "CODO-OBR-07",
  lang: "ES",
  ver: "v2",
  pages: 12,
  ts: "12 may 2026"
}, {
  id: "dv2",
  name: "Lista de partes — MAXI-10ND",
  tipo: "ficha_tecnica",
  codo: "CODO-OBR-07",
  lang: "ES",
  ver: "v1",
  pages: 17,
  ts: "12 may 2026"
}, {
  id: "dv3",
  name: "Ficha técnica — MAXI-10ND",
  tipo: "ficha_tecnica",
  codo: "CODO-OBR-07",
  lang: "ES",
  ver: "v1",
  pages: 1,
  ts: "12 may 2026"
}, {
  id: "dv4",
  name: "Manual CNC Haas VF-2",
  tipo: "manual_mantenimiento",
  codo: "CODO-MAQ-02",
  lang: "EN",
  ver: "v3",
  pages: 64,
  ts: "28 may 2026"
}, {
  id: "dv5",
  name: "Hettich Rotina 380 — manual",
  tipo: "manual_operacion",
  codo: "CODO-LAB-04",
  lang: "ES",
  ver: "v1",
  pages: 32,
  ts: "19 may 2026"
}, {
  id: "dv6",
  name: "Certificado calibración — Mezcladora",
  tipo: "certificado_calibracion",
  codo: "CODO-OBR-07",
  lang: "ES",
  ver: "v1",
  pages: 3,
  ts: "02 jun 2026"
}];
const DOCS_VIVOS_CUPO = {
  usados: 22,
  limit: null
}; // Profesional ilimitado; freemium = 3

/* Definiciones de planes para la UI interna — alineadas a la FUENTE ÚNICA del
   sitio público (bands.ts v2.1 + precios/page.tsx). Métrica: DOCUMENTOS VIVOS,
   no usuarios. Todas las capacidades en todos los planes (sin add-ons, sin
   "pares lingüísticos" como diferenciador — restricción #1). La diferencia entre
   planes es cuántos documentos viven en el entorno. */
/* Bandas de precio por poder adquisitivo (USD/mes). A = ancla. */
const BANDAS = {
  A: {
    key: "A",
    regions: "MX · LatAm",
    tiers: {
      esencial: 250,
      profesional: 550,
      enterprise: 1200
    },
    piloto: {
      list: 250,
      off: 175
    }
  },
  B: {
    key: "B",
    regions: "EE. UU. · Canadá",
    tiers: {
      esencial: 349,
      profesional: 770,
      enterprise: 1680
    },
    piloto: {
      list: 349,
      off: 244
    }
  },
  C: {
    key: "C",
    regions: "UE · UK · Australia",
    tiers: {
      esencial: 375,
      profesional: 825,
      enterprise: 1800
    },
    piloto: {
      list: 375,
      off: 262
    }
  }
};
const BANDA_DEFAULT = "A";
const fmtUSD = n => "$" + n.toLocaleString("en-US");
/* tiers canónicos: documentos vivos + cupo de ingestas [inicial, recurrente/mes]. */
const PLANES = [{
  id: "free",
  label: "Gratuito",
  tier: null,
  blurb: "Para empezar y evaluar, sin tarjeta.",
  docs: "3 documentos vivos · 30 días",
  cupo: null,
  feats: ["3 documentos vivos por 30 días", "Todas las capacidades del producto", "Usuarios ilimitados por QR", "Consulta con cita al original"]
}, {
  id: "esencial",
  label: "Esencial",
  tier: "esencial",
  blurb: "Para un equipo o un CoDo.",
  docs: "hasta 50 documentos vivos",
  cupo: [10, 3],
  feats: ["Hasta 50 documentos vivos", "10 documentos de arranque + 3/mes", "Todas las capacidades del producto", "Usuarios ilimitados", "Consulta multilingüe citada al original"]
}, {
  id: "pro",
  label: "Profesional",
  tier: "profesional",
  blurb: "Para operación multi-CoDo.",
  rec: true,
  docs: "hasta 300 documentos vivos",
  cupo: [30, 10],
  feats: ["Hasta 300 documentos vivos", "30 documentos de arranque + 10/mes", "Todo lo de Esencial", "Inteligencia organizacional (frecuencia y cobertura)", "Soporte prioritario"]
}, {
  id: "enterprise",
  label: "Enterprise",
  tier: "enterprise",
  from: true,
  blurb: "Para organizaciones reguladas a escala.",
  docs: "300+ · a la medida",
  cupo: "negociado",
  feats: ["Documentos vivos 300+ a la medida", "Arranque y cupo mensual negociados", "On-premise / jurisdicción dedicada", "SSO/SAML · residencia de datos", "Acompañamiento de implementación"]
}];
/* adicionales sobre el cupo: fórmula MAX($15, costo×25). Para la UI interna. */
const PLAN_ADICIONAL = "Documentos sobre el cupo: desde $15, cotizados antes de cobrar.";
/* métodos de pago configurados del tenant (Capa B billing). */
const METODOS_PAGO = [{
  id: "mp1",
  tipo: "card",
  marca: "Visa",
  num: "4421",
  exp: "08/27",
  titular: "Jorge Medina",
  principal: true
}, {
  id: "mp2",
  tipo: "spei",
  marca: "SPEI / transferencia",
  num: null,
  detalle: "CLABE ···· 8842 · BBVA",
  principal: false
}];

/* ╔═══════════════════════════════════════════════════════════════════════╗
   ║  8 · INTELIGENCIA ORGANIZACIONAL  (mo.py · Playbooks Niveles A/B/C)     ║
   ╚═══════════════════════════════════════════════════════════════════════╝
   Nivel C — Sugerencias: patrones que el grafo detecta. El admin las ACEPTA
   (→ se vuelven Playbook), RECHAZA o IGNORA. DOCYAN no interrumpe: viven aquí,
   a demanda. Naming progresivo: "Playbook" se gana, no se impone.
   Nivel B — Playbooks: secuencias gobernadas (crear / editar / correr / borrar). */
const SUGERENCIAS = [{
  id: "su1",
  tipo: "secuencia",
  icon: "repeat",
  titulo: "Secuencia de arranque repetida en la MAXI-10ND",
  detalle: "3 colaboradores corren las mismas 3 consultas, en orden, antes de arrancar la mezcladora.",
  codo: "CODO-OBR-07",
  evidencia: "14 días · 3 colaboradores",
  pasos: [{
    q: "¿A cuántas RPM debe girar la olla?",
    key: "rpm"
  }, {
    q: "¿A qué rpm calibro el motor?",
    key: "calib"
  }, {
    q: "¿Qué aceite usa el motor?",
    key: "aceite"
  }]
}, {
  id: "su2",
  tipo: "estacional",
  icon: "calendar-clock",
  titulo: "Consultas de calibración suben antes de cada auditoría",
  detalle: "El patrón es estacional en CODO-LAB-04. Podrías preparar un Playbook de pre-auditoría.",
  codo: "CODO-LAB-04",
  evidencia: "Patrón · 30 días",
  pasos: [{
    q: "¿Cuándo vence la calibración?",
    key: "alertas"
  }, {
    q: "Historial de calibración",
    key: "historial"
  }]
}, {
  id: "su3",
  tipo: "observacion",
  icon: "file-warning",
  titulo: "Holgura anotada por 2 personas en el mismo acople",
  detalle: "Dos colaboradores registraron una observación similar sobre el acople motor-eje.",
  codo: "CODO-OBR-07",
  evidencia: "Observaciones · 30 días",
  pasos: [{
    q: "¿Qué dice el manual del síntoma de vibración?",
    key: "vibra"
  }]
}];
const PLAYBOOKS = [{
  id: "pb1",
  nombre: "Arranque seguro — MAXI-10ND",
  descripcion: "Rutina previa al arranque de la mezcladora.",
  codo: "CODO-OBR-07",
  origen: "sugerencia",
  corridas: 42,
  pasos: [{
    q: "¿A cuántas RPM debe girar la olla?",
    key: "rpm"
  }, {
    q: "¿A qué rpm calibro el motor?",
    key: "calib"
  }]
}, {
  id: "pb2",
  nombre: "Cambio de filtro — CNC VF-2",
  descripcion: "Pasos de mantenimiento del filtro de refrigerante.",
  codo: "CODO-MAQ-02",
  origen: "manual",
  corridas: 7,
  pasos: [{
    q: "¿Cómo cambio el filtro de refrigerante?",
    key: "filtro"
  }]
}];
window.DOCYAN_SCHEMAS = {
  PRICING,
  USAGE,
  TIERS,
  SETUP,
  LIFECYCLE,
  COBRO,
  costoBase,
  precioSetup,
  tiempoSegPorTokens,
  FASES,
  SCHEMAS,
  SCHEMA_BY_ID,
  ESTADO_META,
  CUPO_DEMO,
  COTIZACIONES,
  INGEST_PHASES,
  GLOSARIO,
  GLOSARIO_PAR,
  GLOSARIO_ORIGEN,
  OBLIGATORIEDAD,
  origenCanonico,
  FUENTES,
  FUENTE_DOCS,
  DOCS_VIVOS,
  DOCS_VIVOS_CUPO,
  SUGERENCIAS,
  PLAYBOOKS,
  PLANES,
  PLAN_ADICIONAL,
  METODOS_PAGO,
  BANDAS,
  BANDA_DEFAULT,
  fmtUSD
};
Object.assign(window, {
  SCHEMAS,
  SCHEMA_BY_ID,
  ESTADO_META,
  FASES,
  TIERS,
  SETUP,
  LIFECYCLE_DOCYAN: LIFECYCLE,
  COBRO_DOCYAN: COBRO,
  CUPO_DEMO,
  COTIZACIONES,
  INGEST_PHASES,
  GLOSARIO,
  GLOSARIO_PAR,
  GLOSARIO_ORIGEN,
  OBLIGATORIEDAD,
  origenCanonico,
  FUENTES,
  FUENTE_DOCS,
  DOCS_VIVOS,
  DOCS_VIVOS_CUPO,
  SUGERENCIAS,
  PLAYBOOKS,
  PLANES,
  PLAN_ADICIONAL,
  METODOS_PAGO,
  BANDAS,
  BANDA_DEFAULT,
  fmtUSDDocyan: fmtUSD,
  costoBaseDocyan: costoBase,
  precioSetupDocyan: precioSetup
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "app/schemas.jsx", error: String((e && e.message) || e) }); }

// app/source-viewer.jsx
try { (() => {
/* DOCYAN — B · Visor de fuente ("Abrir PDF"). Overlay del documento con el span
   citado resaltado + pedigree. Se abre por evento global 'dc-open-source' (detail = answer),
   así cualquier cita puede abrirlo sin pasar props por todo el árbol. Montar <SourceViewer/> una vez. */

function SourceViewer() {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    const h = e => setSrc(e.detail);
    window.addEventListener("dc-open-source", h);
    return () => window.removeEventListener("dc-open-source", h);
  }, []);
  if (!src) return null;
  const a = src;
  const close = () => setSrc(null);
  const parts = a.mark && a.span && a.span.includes(a.mark) ? a.span.split(a.mark) : null;
  const sec = a.cite || "Documento fuente";
  const pg = a.page != null ? a.page : "—";
  const serif = {
    fontFamily: "var(--font-serif)",
    fontSize: 15.5,
    lineHeight: 1.7,
    margin: 0
  };
  return /*#__PURE__*/React.createElement("div", {
    onClick: close,
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 200,
      background: "rgba(33,28,22,.5)",
      backdropFilter: "blur(3px)",
      display: "flex",
      alignItems: "stretch",
      justifyContent: "center",
      animation: "dc-sv-fade .16s ease-out"
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      width: "100%",
      maxWidth: 720,
      background: "var(--surface)",
      display: "flex",
      flexDirection: "column",
      boxShadow: "0 24px 80px -20px rgba(33,28,22,.5)",
      animation: "dc-sv-rise .22s cubic-bezier(0.16,1,0.3,1)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: "none",
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "16px 20px",
      borderBottom: "1px solid var(--border)",
      background: "rgba(250,247,241,.9)",
      backdropFilter: "blur(8px)"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: close,
    "aria-label": "Cerrar",
    style: {
      width: 38,
      height: 38,
      borderRadius: 10,
      border: "1px solid var(--border-strong)",
      background: "var(--surface)",
      color: "var(--fg-muted)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      flex: "none"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-left",
    size: 18
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 10.5,
      letterSpacing: ".06em",
      color: "var(--accent-fg)"
    }
  }, t({
    es: "FUENTE",
    en: "SOURCE"
  }), " \xB7 ", sec), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      letterSpacing: "-.01em",
      marginTop: 2,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, t({
    es: "Documento original",
    en: "Original document"
  }))), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 11,
      color: "var(--fg-muted)",
      flex: "none"
    }
  }, t({
    es: "pág.",
    en: "p."
  }), " ", pg)), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: "auto",
      padding: "26px 30px 30px",
      display: "flex",
      flexDirection: "column",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      ...serif,
      color: "var(--fg-muted)"
    }
  }, t({
    es: "\u2026 sección anterior del documento. El contexto inmediato del fragmento citado se conserva para que verifiques que la respuesta no se sacó de su lugar.",
    en: "\u2026 preceding section of the document. The immediate context of the cited excerpt is kept so you can verify the answer was not taken out of context."
  })), /*#__PURE__*/React.createElement("p", {
    style: {
      ...serif,
      color: "var(--ink-900)"
    }
  }, parts ? /*#__PURE__*/React.createElement(React.Fragment, null, parts[0], /*#__PURE__*/React.createElement("mark", {
    style: {
      background: "var(--cinnabar-100)",
      borderBottom: "2px solid var(--cinnabar-500)",
      padding: "1px 3px",
      borderRadius: 3,
      color: "var(--ink-900)"
    }
  }, a.mark), parts[1]) : /*#__PURE__*/React.createElement("mark", {
    style: {
      background: "var(--cinnabar-100)",
      borderBottom: "2px solid var(--cinnabar-500)",
      padding: "1px 3px",
      borderRadius: 3,
      color: "var(--ink-900)"
    }
  }, a.span || a.note || a.q)), /*#__PURE__*/React.createElement("p", {
    style: {
      ...serif,
      color: "var(--fg-muted)"
    }
  }, t({
    es: "\u2026 continúa el documento. DOCYAN respondió citando exactamente el span resaltado arriba; la cadena de pedigree garantiza que no se alteró.",
    en: "\u2026 the document continues. DOCYAN answered by citing exactly the span highlighted above; the pedigree chain guarantees it was not altered."
  })), a.lang && a.lang !== "ES" && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 7,
      fontFamily: "var(--font-mono)",
      fontSize: 11,
      color: "var(--fg-subtle)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "globe",
    size: 13
  }), t({
    es: "Documento original en inglés · respuesta entregada en tu idioma",
    en: "Source document in English · answer delivered in your language"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "auto",
      paddingTop: 18,
      borderTop: "1px solid var(--border)",
      display: "flex",
      alignItems: "center",
      gap: 10,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 7,
      fontFamily: "var(--font-mono)",
      fontSize: 11,
      color: "var(--success-600)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "shield-check",
    size: 14
  }), t({
    es: "Pedigree a span · SHA-256 · íntegro",
    en: "Pedigree to span · SHA-256 · intact"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: "auto",
      fontFamily: "var(--font-mono)",
      fontSize: 11,
      color: "var(--fg-subtle)"
    }
  }, sec, " \xB7 ", t({
    es: "pág.",
    en: "p."
  }), " ", pg)))));
}
Object.assign(window, {
  SourceViewer
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "app/source-viewer.jsx", error: String((e && e.message) || e) }); }

// app/ui-kit.jsx
try { (() => {
/* DOCYAN — B · UI kit del prototipo: modal global de acciones, dropdown custom y
   búsqueda command-palette. Todo por eventos globales (no se pasa props por el árbol).
   Montar <DCModalHost/>, <DCSearchHost/> una vez. Disparar con dispatch de eventos. */

/* ---------- Modal global de acciones ---------- */
/* dispara: window.dispatchEvent(new CustomEvent('dc-modal',{detail:{icon,title,body,confirm,onConfirm,tone}})) */
function dcModal(detail) {
  window.dispatchEvent(new CustomEvent("dc-modal", {
    detail
  }));
}
function DCModalHost() {
  const [m, setM] = useState(null);
  useEffect(() => {
    const h = e => setM(e.detail);
    window.addEventListener("dc-modal", h);
    return () => window.removeEventListener("dc-modal", h);
  }, []);
  if (!m) return null;
  const close = () => setM(null);
  const done = m.done;
  return /*#__PURE__*/React.createElement("div", {
    className: "dcm-scrim",
    onClick: close
  }, /*#__PURE__*/React.createElement("div", {
    className: "dcm",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("button", {
    className: "dcm-x",
    onClick: close
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 18
  })), /*#__PURE__*/React.createElement("div", {
    className: "dcm-ic" + (done ? " ok" : "")
  }, /*#__PURE__*/React.createElement(Icon, {
    name: done ? "check" : m.icon || "info",
    size: 24
  })), /*#__PURE__*/React.createElement("div", {
    className: "dcm-t"
  }, done ? m.doneTitle || m.title : m.title), (done ? m.doneBody : m.body) && /*#__PURE__*/React.createElement("div", {
    className: "dcm-b"
  }, done ? m.doneBody : m.body), /*#__PURE__*/React.createElement("div", {
    className: "dcm-acts"
  }, !done && m.confirm ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-ghost",
    onClick: close
  }, t({
    es: "Cancelar",
    en: "Cancel"
  })), /*#__PURE__*/React.createElement("button", {
    className: "btn " + (m.tone === "danger" ? "btn-danger" : "btn-primary"),
    onClick: () => {
      if (m.onConfirm) m.onConfirm();
      if (m.doneTitle) setM({
        ...m,
        done: true
      });else close();
    }
  }, m.confirm)) : /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    onClick: close
  }, t({
    es: "Entendido",
    en: "Got it"
  })))));
}

/* ---------- Dropdown custom (reemplaza los sel-box que no abrían) ---------- */
function Dropdown({
  value,
  options,
  onChange,
  icon
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = e => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const cur = options.find(o => (o.v ?? o) === value) || options[0];
  const lab = cur ? cur.l ?? cur : "";
  return /*#__PURE__*/React.createElement("div", {
    className: "dc-dd" + (open ? " open" : ""),
    ref: ref
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "dc-dd-btn",
    onClick: () => setOpen(o => !o)
  }, icon && /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 15
  }), /*#__PURE__*/React.createElement("span", {
    className: "dc-dd-lab"
  }, lab), /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-down",
    size: 15
  })), open && /*#__PURE__*/React.createElement("div", {
    className: "dc-dd-menu"
  }, options.map((o, i) => {
    const v = o.v ?? o,
      l = o.l ?? o;
    return /*#__PURE__*/React.createElement("button", {
      type: "button",
      key: i,
      className: "dc-dd-item" + (v === value ? " on" : ""),
      onClick: () => {
        onChange && onChange(v);
        setOpen(false);
      }
    }, /*#__PURE__*/React.createElement("span", null, l), v === value && /*#__PURE__*/React.createElement(Icon, {
      name: "check",
      size: 15
    }));
  })));
}

/* ---------- Búsqueda command-palette ---------- */
/* índice de documentos con su CoDo (derivado de CODOS) */
function dcSearchIndex() {
  const out = [];
  CODOS.forEach(c => (c.docList || []).forEach(d => out.push({
    kind: "doc",
    name: d.name,
    lang: d.lang,
    codo: c,
    docKey: d.key
  })));
  CODOS.forEach(c => out.push({
    kind: "codo",
    name: c.name,
    codo: c
  }));
  return out;
}
/* abrir: window.dispatchEvent(new CustomEvent('dc-search-open',{detail:{onDoc,onCodo,onAsk,placeholder}})) */
function DCSearchHost() {
  const [cfg, setCfg] = useState(null);
  const [q, setQ] = useState("");
  const inRef = useRef(null);
  useEffect(() => {
    const h = e => {
      setCfg(e.detail);
      setQ("");
    };
    window.addEventListener("dc-search-open", h);
    return () => window.removeEventListener("dc-search-open", h);
  }, []);
  useEffect(() => {
    if (cfg && inRef.current) inRef.current.focus();
  }, [cfg]);
  if (!cfg) return null;
  const close = () => setCfg(null);
  const idx = dcSearchIndex();
  const ql = q.trim().toLowerCase();
  const hits = ql ? idx.filter(x => x.name.toLowerCase().includes(ql) || x.codo.id.toLowerCase().includes(ql)) : idx;
  const docs = hits.filter(x => x.kind === "doc").slice(0, 6);
  const codos = hits.filter(x => x.kind === "codo").slice(0, 4);
  const pick = (fn, ...args) => {
    close();
    fn && fn(...args);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "dcs-scrim",
    onClick: close
  }, /*#__PURE__*/React.createElement("div", {
    className: "dcs",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    className: "dcs-bar"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "search",
    size: 18
  }), /*#__PURE__*/React.createElement("input", {
    ref: inRef,
    value: q,
    onChange: e => setQ(e.target.value),
    placeholder: cfg.placeholder || t({
      es: "Busca un documento, un CoDo, o pregunta directo…",
      en: "Search a document, a CoDo, or ask directly…"
    }),
    onKeyDown: e => {
      if (e.key === "Escape") close();
      if (e.key === "Enter" && ql) pick(cfg.onAsk, q.trim());
    }
  }), /*#__PURE__*/React.createElement("kbd", {
    className: "dcs-esc"
  }, "esc")), /*#__PURE__*/React.createElement("div", {
    className: "dcs-body"
  }, ql && cfg.onAsk && /*#__PURE__*/React.createElement("button", {
    className: "dcs-ask",
    onClick: () => pick(cfg.onAsk, q.trim())
  }, /*#__PURE__*/React.createElement("span", {
    className: "dcs-ic cin"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "messages-square",
    size: 16
  })), /*#__PURE__*/React.createElement("span", {
    className: "dcs-asktxt"
  }, t({
    es: "Preguntar",
    en: "Ask"
  }), ": ", /*#__PURE__*/React.createElement("b", null, "\u201C", q.trim(), "\u201D")), /*#__PURE__*/React.createElement(Icon, {
    name: "corner-down-left",
    size: 15
  })), docs.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "dcs-grp"
  }, t({
    es: "Documentos",
    en: "Documents"
  })), docs.map((x, i) => /*#__PURE__*/React.createElement("button", {
    className: "dcs-row",
    key: "d" + i,
    onClick: () => pick(cfg.onDoc, x.codo, x.docKey)
  }, /*#__PURE__*/React.createElement("span", {
    className: "dcs-ic"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "file-text",
    size: 16
  })), /*#__PURE__*/React.createElement("span", {
    className: "dcs-rtxt"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dcs-rn"
  }, x.name), /*#__PURE__*/React.createElement("span", {
    className: "dcs-rm"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dcs-codo"
  }, x.codo.id), x.codo.name, " \xB7 ", x.lang)), /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-right",
    size: 15
  }))), codos.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "dcs-grp"
  }, "CoDos"), codos.map((x, i) => /*#__PURE__*/React.createElement("button", {
    className: "dcs-row",
    key: "c" + i,
    onClick: () => pick(cfg.onCodo, x.codo)
  }, /*#__PURE__*/React.createElement("span", {
    className: "dcs-ic"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: x.codo.icon,
    size: 16
  })), /*#__PURE__*/React.createElement("span", {
    className: "dcs-rtxt"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dcs-rn"
  }, x.codo.name), /*#__PURE__*/React.createElement("span", {
    className: "dcs-rm"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dcs-codo"
  }, x.codo.id), x.codo.docs, " docs \xB7 ", x.codo.loc)), /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-right",
    size: 15
  }))), docs.length === 0 && codos.length === 0 && !ql && /*#__PURE__*/React.createElement("div", {
    className: "dcs-empty"
  }, t({
    es: "Escribe para buscar en tus CoDos y documentos.",
    en: "Type to search your CoDos and documents."
  })), docs.length === 0 && codos.length === 0 && ql && !cfg.onAsk && /*#__PURE__*/React.createElement("div", {
    className: "dcs-empty"
  }, t({
    es: "Sin resultados.",
    en: "No results."
  })))));
}
function dcSearch(detail) {
  window.dispatchEvent(new CustomEvent("dc-search-open", {
    detail
  }));
}
Object.assign(window, {
  DCModalHost,
  dcModal,
  Dropdown,
  DCSearchHost,
  dcSearch
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "app/ui-kit.jsx", error: String((e && e.message) || e) }); }

// app/wizard.jsx
try { (() => {
/* DOCYAN — Crear CoDo wizard (content; vive dentro del shell de org, ruta hija de CoDos) */

function StepEntidad({
  codo,
  set
}) {
  const CRITS = [["sec", "Seguridad ≥0.95"], ["cal", "Calidad ≥0.85"], ["op", "Operacional ≥0.75"]];
  return /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sec-eyebrow"
  }, "Paso 1 \xB7 Entidad"), /*#__PURE__*/React.createElement("div", {
    className: "sec-lead"
  }, /*#__PURE__*/React.createElement("h2", null, "Define la entidad del CoDo"), /*#__PURE__*/React.createElement("p", null, "Un CoDo agrupa todos los documentos que describen una entidad \u2014 un equipo, un proceso o un lugar. Empieza por nombrarla; los colaboradores la ver\xE1n al escanear el QR.")), /*#__PURE__*/React.createElement("div", {
    className: "form-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "field col2"
  }, /*#__PURE__*/React.createElement("label", null, "Nombre de la entidad ", /*#__PURE__*/React.createElement("span", {
    className: "req"
  }, "*")), /*#__PURE__*/React.createElement("input", {
    value: codo.nombre,
    placeholder: "Ej. Mezcladora de concreto MAXI-10ND",
    onChange: e => set({
      nombre: e.target.value
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "ID del CoDo \xB7 auto"), /*#__PURE__*/React.createElement("span", {
    className: "id-chip"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "hash",
    size: 14
  }), codo.id), /*#__PURE__*/React.createElement("span", {
    className: "hint"
  }, "Generado por vertical y secuencia. Editable m\xE1s tarde.")), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Tipo / categor\xEDa"), /*#__PURE__*/React.createElement("input", {
    value: codo.tipo,
    placeholder: "Ej. Revolvedora para concreto \xB7 CIPSA",
    onChange: e => set({
      tipo: e.target.value
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Ubicaci\xF3n / \xE1rea"), /*#__PURE__*/React.createElement("input", {
    value: codo.ubicacion,
    placeholder: "Ej. Obra \xB7 cuadrilla 2",
    onChange: e => set({
      ubicacion: e.target.value
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Vertical"), /*#__PURE__*/React.createElement("div", {
    className: "selbox",
    onClick: () => set({
      vertical: VERTICALES[(VERTICALES.indexOf(codo.vertical) + 1) % VERTICALES.length]
    })
  }, codo.vertical, /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-down",
    size: 15
  })), /*#__PURE__*/React.createElement("span", {
    className: "hint"
  }, "Define umbrales de gobernanza y plantilla de segmentos.")), /*#__PURE__*/React.createElement("div", {
    className: "field col2"
  }, /*#__PURE__*/React.createElement("label", null, "Par ling\xFC\xEDstico default"), /*#__PURE__*/React.createElement("div", {
    className: "chips"
  }, PARES.map(p => /*#__PURE__*/React.createElement("button", {
    key: p,
    className: "chip" + (codo.par === p ? " on" : ""),
    onClick: () => set({
      par: p
    })
  }, p)))), /*#__PURE__*/React.createElement("div", {
    className: "field col2"
  }, /*#__PURE__*/React.createElement("label", null, /*#__PURE__*/React.createElement(Icon, {
    name: "shield-check",
    size: 12
  }), "Criticidad del segmento de seguridad"), /*#__PURE__*/React.createElement("div", {
    className: "chips"
  }, CRITS.map(([k, l]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    className: "chip crit" + (codo.crit === k ? " on" : ""),
    onClick: () => set({
      crit: k
    })
  }, /*#__PURE__*/React.createElement(Icon, {
    name: k === "sec" ? "shield-alert" : k === "cal" ? "badge-check" : "settings",
    size: 14
  }), l))), /*#__PURE__*/React.createElement("span", {
    className: "hint"
  }, "Confianza m\xEDnima del cach\xE9 para emitir respuesta. Seguridad exige el umbral m\xE1s alto."))));
}
function StepDocumentos({
  codo,
  addDoc,
  removeDoc
}) {
  const [q, setQ] = useState("");
  const added = new Set(codo.docs.map(d => d.id));
  const filtered = ACERVO.filter(d => d.name.toLowerCase().includes(q.toLowerCase()));
  return /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sec-eyebrow"
  }, "Paso 2 \xB7 Documentos"), /*#__PURE__*/React.createElement("div", {
    className: "sec-lead"
  }, /*#__PURE__*/React.createElement("h2", null, "Vincula los documentos de la entidad"), /*#__PURE__*/React.createElement("p", null, "Relaciona documentos ya ingeridos en tu acervo, o sube nuevos. Esto es lo que vuelve consultable al CoDo \u2014 cada respuesta citar\xE1 a uno de estos documentos.")), /*#__PURE__*/React.createElement("div", {
    className: "docs-grid"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "col-head"
  }, /*#__PURE__*/React.createElement("h3", null, "Acervo disponible"), /*#__PURE__*/React.createElement("span", {
    className: "cnt"
  }, filtered.length, " documentos vivos")), /*#__PURE__*/React.createElement("div", {
    className: "acervo-search"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "search",
    size: 15
  }), /*#__PURE__*/React.createElement("input", {
    value: q,
    placeholder: "Filtra tu acervo\u2026",
    onChange: e => setQ(e.target.value)
  })), filtered.map(d => {
    const isAdded = added.has(d.id);
    return /*#__PURE__*/React.createElement("div", {
      key: d.id,
      className: "doc-pick" + (isAdded ? " added" : ""),
      onClick: () => !isAdded && addDoc(d)
    }, /*#__PURE__*/React.createElement("span", {
      className: "di"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "file-text",
      size: 17
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "dn"
    }, d.name, /*#__PURE__*/React.createElement("span", {
      className: "dlang"
    }, d.lang)), /*#__PURE__*/React.createElement("div", {
      className: "dm"
    }, d.kind, " \xB7 ", d.pages, " ", d.pages === 1 ? "pág" : "págs", " \xB7 ", /*#__PURE__*/React.createElement("span", {
      className: "badge-vivo"
    }, /*#__PURE__*/React.createElement("span", {
      className: "bd"
    }), "vivo"))), /*#__PURE__*/React.createElement("span", {
      className: "act"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: isAdded ? "check" : "plus",
      size: 16
    })));
  }), /*#__PURE__*/React.createElement("div", {
    className: "dropzone"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "upload-cloud",
    size: 24
  }), /*#__PURE__*/React.createElement("div", {
    className: "dz-t"
  }, "Arrastra o ", /*#__PURE__*/React.createElement("b", null, "sube documentos nuevos")), /*#__PURE__*/React.createElement("div", {
    className: "dz-m"
  }, "PDF \xB7 DOCX \xB7 XLSX \xB7 im\xE1genes con OCR \u2014 se ingieren y se vinculan al CoDo"))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "col-head"
  }, /*#__PURE__*/React.createElement("h3", null, "Documentos de este CoDo"), /*#__PURE__*/React.createElement("span", {
    className: "cnt"
  }, codo.docs.length, " vinculados")), /*#__PURE__*/React.createElement("div", {
    className: "set-panel"
  }, codo.docs.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "empty-set"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "folder-plus",
    size: 24
  }), /*#__PURE__*/React.createElement("p", null, "A\xFAn no vinculas documentos.", /*#__PURE__*/React.createElement("br", null), "Elige del acervo o sube nuevos a la izquierda.")) : codo.docs.map(d => /*#__PURE__*/React.createElement("div", {
    key: d.id,
    className: "set-doc"
  }, /*#__PURE__*/React.createElement("span", {
    className: "di"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "file-text",
    size: 17
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "dn"
  }, d.name), /*#__PURE__*/React.createElement("div", {
    className: "dm"
  }, SEG_LABEL[d.seg], " \xB7 ", d.lang)), /*#__PURE__*/React.createElement("button", {
    className: "rm",
    onClick: () => removeDoc(d.id)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 15
  }))))))));
}
function StepRelaciones({
  codo,
  moveDoc
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sec-eyebrow"
  }, "Paso 3 \xB7 Relaciones"), /*#__PURE__*/React.createElement("div", {
    className: "sec-lead"
  }, /*#__PURE__*/React.createElement("h2", null, "Organiza el expediente del CoDo"), /*#__PURE__*/React.createElement("p", null, "Agrupa los documentos por segmento. As\xED ver\xE1 el colaborador la entidad, y as\xED aplica DOCYAN la criticidad de gobernanza a cada respuesta.")), /*#__PURE__*/React.createElement("div", {
    className: "seg-cols"
  }, SEGMENTS.map(seg => {
    const docs = codo.docs.filter(d => d.seg === seg.key);
    return /*#__PURE__*/React.createElement("div", {
      key: seg.key,
      className: "seg-card"
    }, /*#__PURE__*/React.createElement("div", {
      className: "sh"
    }, /*#__PURE__*/React.createElement("span", {
      className: "si"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: seg.icon,
      size: 15
    })), /*#__PURE__*/React.createElement("span", {
      className: "stt"
    }, seg.label), /*#__PURE__*/React.createElement("span", {
      className: "scrit " + seg.crit
    }, seg.crit === "sec" ? "Seguridad ≥0.95" : "Operacional ≥0.75")), docs.length === 0 ? /*#__PURE__*/React.createElement("div", {
      className: "seg-empty"
    }, "Sin documentos en este segmento.") : docs.map(d => {
      const nextSeg = SEGMENTS[(SEGMENTS.findIndex(s => s.key === d.seg) + 1) % SEGMENTS.length];
      return /*#__PURE__*/React.createElement("div", {
        key: d.id,
        className: "rel-doc"
      }, /*#__PURE__*/React.createElement("span", {
        className: "di"
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "file-text",
        size: 15
      })), /*#__PURE__*/React.createElement("div", {
        style: {
          minWidth: 0
        }
      }, /*#__PURE__*/React.createElement("div", {
        className: "dn"
      }, d.name), /*#__PURE__*/React.createElement("div", {
        className: "dm"
      }, d.kind, " \xB7 ", d.lang)), /*#__PURE__*/React.createElement("button", {
        className: "move",
        onClick: () => moveDoc(d.id, nextSeg.key),
        title: "Mover a " + nextSeg.label
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "corner-down-right",
        size: 13
      }), "Mover"));
    }));
  })));
}
function StepPublicar({
  codo,
  fmt,
  setFmt
}) {
  const FMTS = ["Etiqueta 5×5cm", "Placa 10×10cm", "Lámina A5"];
  const segCount = SEGMENTS.filter(s => codo.docs.some(d => d.seg === s.key)).length;
  const critLabel = codo.crit === "sec" ? "Seguridad ≥0.95" : codo.crit === "cal" ? "Calidad ≥0.85" : "Operacional ≥0.75";
  return /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sec-eyebrow"
  }, "Paso 4 \xB7 Publicar"), /*#__PURE__*/React.createElement("div", {
    className: "sec-lead"
  }, /*#__PURE__*/React.createElement("h2", null, "Revisa y genera el QR persistente"), /*#__PURE__*/React.createElement("p", null, "El QR es la puerta del colaborador al CoDo. Al crear, se imprime y se pega f\xEDsicamente en la entidad.")), /*#__PURE__*/React.createElement("div", {
    className: "pub-grid"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "summary-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sl"
  }, "Entidad"), /*#__PURE__*/React.createElement("span", {
    className: "sv"
  }, codo.nombre || "—")), /*#__PURE__*/React.createElement("div", {
    className: "summary-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sl"
  }, "ID del CoDo"), /*#__PURE__*/React.createElement("span", {
    className: "sv",
    style: {
      fontFamily: "var(--font-mono)"
    }
  }, codo.id)), /*#__PURE__*/React.createElement("div", {
    className: "summary-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sl"
  }, "Tipo \xB7 ubicaci\xF3n"), /*#__PURE__*/React.createElement("span", {
    className: "sv"
  }, codo.tipo || "—", " \xB7 ", codo.ubicacion || "—")), /*#__PURE__*/React.createElement("div", {
    className: "summary-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sl"
  }, "Vertical"), /*#__PURE__*/React.createElement("span", {
    className: "sv"
  }, codo.vertical)), /*#__PURE__*/React.createElement("div", {
    className: "summary-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sl"
  }, "Documentos"), /*#__PURE__*/React.createElement("span", {
    className: "sv"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "files",
    size: 14
  }), codo.docs.length, " vivos \xB7 ", segCount, " segmentos")), /*#__PURE__*/React.createElement("div", {
    className: "summary-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sl"
  }, "Par ling\xFC\xEDstico"), /*#__PURE__*/React.createElement("span", {
    className: "sv"
  }, codo.par)), /*#__PURE__*/React.createElement("div", {
    className: "summary-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sl"
  }, "Criticidad seguridad"), /*#__PURE__*/React.createElement("span", {
    className: "sv"
  }, /*#__PURE__*/React.createElement("span", {
    className: "chip crit on",
    style: {
      cursor: "default",
      padding: "5px 11px"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "shield-alert",
    size: 13
  }), critLabel)))), /*#__PURE__*/React.createElement("div", {
    className: "qr-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "qh"
  }, "Previsualizaci\xF3n del QR"), /*#__PURE__*/React.createElement(QRPlate, {
    seed: 7,
    label: codo.id + " · " + (codo.nombre || "entidad sin nombre")
  }), /*#__PURE__*/React.createElement("div", {
    className: "seg-lab",
    style: {
      marginTop: 16
    }
  }, "Formato f\xEDsico"), /*#__PURE__*/React.createElement("div", {
    className: "fmt-seg"
  }, FMTS.map((f, i) => /*#__PURE__*/React.createElement("button", {
    key: f,
    className: fmt === i ? "on" : "",
    onClick: () => setFmt(i)
  }, f))))));
}
const WIZ_STEPS = [["Entidad", "nombre + metadatos"], ["Documentos", "vincular acervo"], ["Relaciones", "organizar expediente"], ["Publicar", "revisar + QR"]];
const BLANK_CODO = {
  id: "CODO-OBR-07",
  nombre: "",
  tipo: "",
  ubicacion: "",
  vertical: VERTICALES[0],
  par: PARES[1],
  crit: "sec",
  docs: []
};
const PREFILL_CODO = {
  ...BLANK_CODO,
  nombre: "Mezcladora de concreto MAXI-10ND",
  tipo: "Revolvedora para concreto · CIPSA",
  ubicacion: "Obra · cuadrilla 2",
  docs: ACERVO.slice(0, 3).map(d => ({
    ...d
  }))
};
function CrearCoDo({
  onExit,
  prefill
}) {
  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(0);
  const [codo, setCodo] = useState(prefill ? PREFILL_CODO : {
    ...BLANK_CODO
  });
  const [fmt, setFmt] = useState(1);
  const [created, setCreated] = useState(false);
  const set = patch => setCodo(c => ({
    ...c,
    ...patch
  }));
  const addDoc = d => setCodo(c => c.docs.some(x => x.id === d.id) ? c : {
    ...c,
    docs: [...c.docs, {
      ...d
    }]
  });
  const removeDoc = id => setCodo(c => ({
    ...c,
    docs: c.docs.filter(d => d.id !== id)
  }));
  const moveDoc = (id, seg) => setCodo(c => ({
    ...c,
    docs: c.docs.map(d => d.id === id ? {
      ...d,
      seg
    } : d)
  }));
  const canNext = step === 0 ? codo.nombre.trim().length > 0 : step === 1 ? codo.docs.length > 0 : true;
  const next = () => {
    if (step < 3) {
      const n = step + 1;
      setStep(n);
      setMaxStep(m => Math.max(m, n));
    }
  };
  if (created) return /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "done-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dic"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 30
  })), /*#__PURE__*/React.createElement("h1", null, "CoDo creado"), /*#__PURE__*/React.createElement("div", {
    className: "dcodo"
  }, codo.id, " \xB7 ", codo.nombre), /*#__PURE__*/React.createElement("p", null, codo.docs.length, " documentos vivos quedaron vinculados y consultables. Imprime el QR y p\xE9galo en la entidad para que los colaboradores entren."), /*#__PURE__*/React.createElement("div", {
    className: "done-acts"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "printer",
    size: 16
  }), "Imprimir QR"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-ghost",
    onClick: () => onExit()
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "folder-tree",
    size: 16
  }), "Ver CoDos"))));
  return /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "goal-strip"
  }, /*#__PURE__*/React.createElement("span", {
    className: "gs-ic"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "disc-3",
    size: 20
  })), /*#__PURE__*/React.createElement("div", {
    className: "gs-t"
  }, /*#__PURE__*/React.createElement("span", {
    className: "gs-codo"
  }, codo.id, " \xB7 nuevo"), /*#__PURE__*/React.createElement("span", {
    className: "gs-name" + (codo.nombre ? "" : " ph")
  }, codo.nombre || "Entidad sin nombre")), /*#__PURE__*/React.createElement("div", {
    className: "gs-facts"
  }, /*#__PURE__*/React.createElement("span", {
    className: "gs-fact"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "files",
    size: 13
  }), codo.docs.length, " docs"), /*#__PURE__*/React.createElement("span", {
    className: "gs-fact warn"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "shield-alert",
    size: 13
  }), codo.crit === "sec" ? "Seguridad ≥0.95" : codo.crit === "cal" ? "Calidad ≥0.85" : "Operacional ≥0.75"))), /*#__PURE__*/React.createElement("div", {
    className: "stepper"
  }, WIZ_STEPS.map(([t, m], i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    className: "step" + (i === step ? " on" : "") + (i < step ? " done" : ""),
    onClick: () => {
      if (i <= maxStep) setStep(i);
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "sn"
  }, i < step ? /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 14
  }) : i + 1), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "st"
  }, t), /*#__PURE__*/React.createElement("div", {
    className: "stm"
  }, m))), i < 3 && /*#__PURE__*/React.createElement("div", {
    className: "step-line" + (i < step ? " done" : "")
  })))), step === 0 && /*#__PURE__*/React.createElement(StepEntidad, {
    codo: codo,
    set: set
  }), step === 1 && /*#__PURE__*/React.createElement(StepDocumentos, {
    codo: codo,
    addDoc: addDoc,
    removeDoc: removeDoc
  }), step === 2 && /*#__PURE__*/React.createElement(StepRelaciones, {
    codo: codo,
    moveDoc: moveDoc
  }), step === 3 && /*#__PURE__*/React.createElement(StepPublicar, {
    codo: codo,
    fmt: fmt,
    setFmt: setFmt
  }), /*#__PURE__*/React.createElement("div", {
    className: "foot"
  }, step > 0 ? /*#__PURE__*/React.createElement("button", {
    className: "btn btn-ghost",
    onClick: () => setStep(step - 1)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-left",
    size: 16
  }), "Atr\xE1s") : /*#__PURE__*/React.createElement("button", {
    className: "btn btn-ghost",
    onClick: () => onExit()
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 16
  }), "Cancelar"), step < 3 ? /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    disabled: !canNext,
    onClick: next
  }, "Siguiente", /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-right",
    size: 16
  })) : /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    onClick: () => setCreated(true)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 16
  }), "Crear CoDo y generar QR"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-draft"
  }, "Guardar borrador")));
}
Object.assign(window, {
  CrearCoDo
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "app/wizard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/commercial-v2/app.jsx
try { (() => {
/* DOCYAN sitio público v2 — shell.
   Router, contextos (idioma + banda), banner geo, linkout, tweaks. */

function SiteApp() {
  const [tweaks, setTweak] = useTweaks({
    heroVariant: "A",
    accent: "#CF4124",
    density: 1
  });
  const [page, setPage] = useState(() => {
    try {
      return localStorage.getItem("docyan_v2_page") || "home";
    } catch (e) {
      return "home";
    }
  });
  const [lang, setLang] = useState(() => {
    try {
      return localStorage.getItem("docyan_v2_lang") || "es";
    } catch (e) {
      return "es";
    }
  });
  const [band, setBand] = useState(() => {
    try {
      return localStorage.getItem("docyan_v2_band") || "A";
    } catch (e) {
      return "A";
    }
  });
  const [banner, setBanner] = useState(() => {
    try {
      return !localStorage.getItem("docyan_v2_banner_seen");
    } catch (e) {
      return true;
    }
  });
  const [route, setRoute] = useState(null); // linkout modal

  useEffect(() => {
    try {
      localStorage.setItem("docyan_v2_page", page);
    } catch (e) {}
  }, [page]);
  useEffect(() => {
    try {
      localStorage.setItem("docyan_v2_lang", lang);
    } catch (e) {}
  }, [lang]);
  useEffect(() => {
    try {
      localStorage.setItem("docyan_v2_band", band);
    } catch (e) {}
  }, [band]);
  const go = p => {
    setPage(p);
    window.scrollTo({
      top: 0
    });
  };
  const dismissBanner = () => {
    setBanner(false);
    try {
      localStorage.setItem("docyan_v2_banner_seen", "1");
    } catch (e) {}
  };
  useEffect(() => {
    document.documentElement.style.setProperty("--cinnabar-500", tweaks.accent);
    document.documentElement.lang = lang;
  }, [tweaks.accent, lang]);
  let content;
  if (page === "home") content = /*#__PURE__*/React.createElement(HomePage, {
    go: go,
    heroVariant: tweaks.heroVariant
  });else if (page === "producto") content = /*#__PURE__*/React.createElement(ProductoPage, {
    go: go
  });else if (page === "como") content = /*#__PURE__*/React.createElement(ComoPage, {
    go: go
  });else if (page === "verticales") content = /*#__PURE__*/React.createElement(VerticalesHub, {
    go: go
  });else if (page.indexOf("vert:") === 0) content = /*#__PURE__*/React.createElement(VerticalPage, {
    vkey: page.slice(5),
    go: go
  });else if (page === "seguridad") content = /*#__PURE__*/React.createElement(SeguridadPage, {
    go: go
  });else if (page === "precios") content = /*#__PURE__*/React.createElement(PreciosPage, {
    go: go
  });else if (page === "demos" || page.indexOf("demos:") === 0) content = /*#__PURE__*/React.createElement(DemosPage, {
    go: go,
    initial: page.indexOf("demos:") === 0 ? page.slice(6) : null
  });else if (page === "legal") content = /*#__PURE__*/React.createElement(LegalPage, null);else content = /*#__PURE__*/React.createElement(HomePage, {
    go: go,
    heroVariant: tweaks.heroVariant
  });
  return /*#__PURE__*/React.createElement(LangCtx.Provider, {
    value: {
      lang,
      setLang
    }
  }, /*#__PURE__*/React.createElement(BandCtx.Provider, {
    value: {
      band,
      setBand
    }
  }, /*#__PURE__*/React.createElement(LinkOutCtx.Provider, {
    value: setRoute
  }, banner && /*#__PURE__*/React.createElement(GeoBanner, {
    onDismiss: dismissBanner
  }), /*#__PURE__*/React.createElement(Nav2, {
    page: page,
    go: go
  }), content, /*#__PURE__*/React.createElement(Footer2, {
    go: go
  }), /*#__PURE__*/React.createElement(LinkOutModal, {
    route: route,
    onClose: () => setRoute(null)
  }), /*#__PURE__*/React.createElement(TweaksPanel, {
    title: "Tweaks"
  }, /*#__PURE__*/React.createElement(TweakSection, {
    title: "Hero de la home"
  }, /*#__PURE__*/React.createElement(TweakRadio, {
    label: "Variante",
    value: tweaks.heroVariant,
    options: [{
      value: "A",
      label: "A · Split"
    }, {
      value: "B",
      label: "B · Pregunta"
    }, {
      value: "C",
      label: "C · Campo"
    }],
    onChange: v => setTweak("heroVariant", v)
  })), /*#__PURE__*/React.createElement(TweakSection, {
    title: "Marca"
  }, /*#__PURE__*/React.createElement(TweakColor, {
    label: "Acento (cinnabar)",
    value: tweaks.accent,
    options: ["#CF4124", "#B73A20", "#E04E2E"],
    onChange: v => setTweak("accent", v)
  }))))));
}
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(SiteApp, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/commercial-v2/app.jsx", error: String((e && e.message) || e) }); }

// ui_kits/commercial-v2/codo-data.jsx
try { (() => {
/* DOCYAN sitio público v2 — CoDos de demo sin registro (5 verticales).
   Conjuntos de Documentos curados; cada qa es una respuesta ANCLADA
   con cite/doc/page/span al fragmento exacto que la sostiene. */

const CODOS = [{
  key: "lab",
  label: "Laboratorios",
  icon: "flask-conical",
  codo: "CODO-LAB-04",
  entity: "Centrífuga Hettich Rotina 380",
  blurb: "Centrífugas, balanzas, calibraciones vigentes y MSDS de reactivos.",
  ctx: "una centrífuga de laboratorio Hettich Rotina 380 (ISO/IEC 17025)",
  docs: ["Manual de calibración de centrífuga", "MSDS de reactivo común", "Certificado de trazabilidad de patrón"],
  qa: [{
    kind: "info",
    q: "¿Torque del perno B del rotor?",
    value: "85",
    unit: "N·m",
    note: "Aplicado en cruz en tres etapas progresivas (40 → 65 → 85 N·m).",
    doc: "Manual de calibración · Rotina 380",
    cite: "Manual Rotina 380 · §4.2.1",
    page: 12,
    span: "El par de apriete del perno B es 85 N·m, aplicado en cruz en tres etapas progresivas (40 → 65 → 85 N·m)."
  }, {
    kind: "steps",
    q: "¿Cómo cambio el filtro de refrigerante?",
    title: "Cambio del filtro de refrigerante",
    ppe: [["hand", "Guantes de nitrilo"], ["glasses", "Gafas de seguridad"]],
    steps: ["Despresuriza el circuito y espera 2 minutos.", "Retira la tapa con la herramienta indicada.", "Sustituye el cartucho por uno nuevo.", "Purga el aire antes de reconectar."],
    warn: ["ADVERTENCIA", "No abrir con el sistema presurizado."],
    doc: "Manual de calibración · Rotina 380",
    cite: "Manual Rotina 380 · §7.3",
    page: 28,
    span: "El cambio del filtro de refrigerante se realiza con el circuito despresurizado; sustituir el cartucho y purgar el aire antes de reconectar."
  }, {
    kind: "diagram",
    q: "Muéstrame el diagrama del rotor",
    title: "Rotor y cabezal",
    pins: [[1, 33, 26, "Tapa del rotor"], [2, 58, 47, "Rotor de ángulo fijo"], [3, 44, 72, "Acople motor-eje"]],
    doc: "Manual de calibración · Rotina 380",
    cite: "Plano Rotina 380 · fig. 4",
    page: 15,
    span: "Fig. 4 — Despiece del rotor: tapa, rotor de ángulo fijo y acople motor-eje."
  }, {
    kind: "troubleshoot",
    q: "La centrífuga vibra al arrancar",
    title: "Diagnóstico · vibración al arrancar",
    ask: "¿La vibración aparece solo en vacío o también con carga?",
    options: [["Solo en vacío", "Causa probable: desbalance del rotor. Revisa el asiento de los tubos y verifica que las masas estén pareadas."], ["También con carga", "Causa probable: holgura en el acople motor-eje. Inspecciona el acople y el par de apriete de la base."]],
    doc: "Manual de calibración · Rotina 380",
    cite: "Guía de fallas · §3.5",
    page: 41,
    span: "Vibración al arrancar: si ocurre solo en vacío, sospechar desbalance del rotor; con carga, holgura en el acople."
  }]
}, {
  key: "maq",
  label: "Maquiladoras",
  icon: "factory",
  codo: "CODO-MAQ-12",
  entity: "Línea CNC Haas VF-4",
  blurb: "Manuales por línea, cambios de herramienta y MSDS de fluidos de corte.",
  ctx: "una línea CNC Haas VF-4 en una maquiladora IMMEX (IATF 16949 / NOM-018-STPS)",
  docs: ["Manual operativo de CNC", "Procedimiento de cambio de herramienta", "Hoja MSDS de fluido de corte"],
  qa: [{
    kind: "info",
    q: "¿Presión nominal del husillo?",
    value: "4.5",
    unit: "bar",
    note: "Verificar el manómetro antes de iniciar el ciclo.",
    doc: "Manual operativo de CNC",
    cite: "Manual CNC VF-4 · §4.1",
    page: 18,
    span: "Presión nominal del husillo: 4.5 bar. Verificar el manómetro antes de iniciar el ciclo."
  }, {
    kind: "steps",
    q: "¿Procedimiento de cambio de herramienta?",
    title: "Cambio de herramienta",
    ppe: [["hand", "Guantes anticorte"], ["glasses", "Gafas"]],
    steps: ["Detén el husillo y confirma energía cero.", "Libera el portaherramientas con el botón de cambio.", "Sustituye la herramienta.", "Referencia el cero pieza antes de reanudar."],
    warn: ["PRECAUCIÓN", "No introducir la mano con el husillo activo."],
    doc: "Procedimiento de cambio de herramienta",
    cite: "Manual CNC VF-4 · §6.2",
    page: 34,
    span: "El cambio de herramienta se realiza con el husillo detenido; libera el portaherramientas, sustituye la herramienta y referencia el cero pieza."
  }, {
    kind: "compare",
    q: "Compara la rev. C y D del manual",
    title: "Manual CNC VF-4",
    from: "Rev. C",
    to: "Rev. D",
    diff: [["chg", "Presión del husillo: 4.0 → 4.5 bar."], ["add", "Verificación de manómetro antes de cada ciclo."], ["del", "Lubricación manual del portaherramientas."]],
    summary: "La Rev. D sube la presión nominal y formaliza la verificación del manómetro; elimina la lubricación manual.",
    doc: "Manual operativo de CNC",
    cite: "Manual CNC VF-4 · §4.1 · Δ rev.",
    page: 18,
    span: "Cambio rev. C→D: presión del husillo de 4.0 a 4.5 bar; se añade verificación de manómetro."
  }, {
    kind: "alerts",
    q: "¿Qué mantenimiento tengo pendiente?",
    title: "Recordatorios de mantenimiento",
    items: [["warn", "Cambio de aceite del husillo", "Vence en 5 días"], ["caution", "Calibración del palpador", "En 24 días"]],
    doc: "Manual operativo de CNC",
    cite: "Plan de mantenimiento · §9",
    page: 52,
    span: "Mantenimiento programado: cambio de aceite del husillo cada 500 h; calibración del palpador semestral."
  }]
}, {
  key: "pharma",
  label: "Farma",
  icon: "pill",
  codo: "CODO-PHARMA-03",
  entity: "Bioreactor B-3",
  blurb: "SOPs, Batch Records y validaciones de limpieza bajo GMP.",
  ctx: "un bioreactor B-3 en manufactura farmacéutica (GMP · FDA · COFEPRIS)",
  docs: ["SOP de operación de bioreactor", "Plantilla Batch Manufacturing Record", "Validación de limpieza CIP"],
  qa: [{
    kind: "info",
    q: "¿Temperatura de operación del bioreactor?",
    value: "37",
    unit: "°C",
    note: "Agitación 200 rpm y pH 7.0 ± 0.2; registrar en el BMR cada 30 min.",
    doc: "SOP de operación de bioreactor",
    cite: "SOP-BR-03 · §3.4",
    page: 8,
    span: "Condiciones nominales del bioreactor: 37 °C, agitación 200 rpm, pH 7.0 ± 0.2; registrar en el BMR cada 30 minutos."
  }, {
    kind: "steps",
    q: "¿Protocolo de limpieza CIP?",
    title: "Limpieza CIP del bioreactor",
    ppe: [["hand", "Guantes nitrilo"], ["glasses", "Gafas"]],
    steps: ["Enjuague inicial con agua purificada.", "Recircula NaOH 2% a 80 °C por 20 min.", "Enjuague final con agua purificada.", "Registra la conductividad del último enjuague."],
    warn: ["ADVERTENCIA", "Solución cáustica caliente — EPP obligatorio."],
    doc: "Validación de limpieza CIP",
    cite: "VAL-CIP-03 · §2",
    page: 4,
    span: "Ciclo CIP: enjuague inicial, recirculación de NaOH 2% a 80 °C, enjuague final; registrar conductividad del último enjuague."
  }, {
    kind: "history",
    q: "Historial de lotes de este bioreactor",
    title: "Lotes recientes · B-3",
    events: [["Hoy", "Lote BR-2291 iniciado · pH en rango"], ["Ayer", "Lote BR-2290 liberado · OK"], ["12 may", "Desviación de pH corregida · CAPA-08"]],
    pattern: "Las desviaciones de pH aumentan en lotes de fin de turno.",
    doc: "Plantilla Batch Manufacturing Record",
    cite: "BMR · histórico",
    page: 1,
    span: "Registro de lotes del bioreactor B-3: cada entrada con firma, fecha y estado de liberación."
  }, {
    kind: "video",
    q: "Video: arranque del bioreactor",
    title: "Arranque del bioreactor B-3",
    dur: "06:10",
    chapters: [["00:00", "EPP y precondiciones"], ["01:40", "Inoculación"], ["03:20", "Ajuste de parámetros"], ["05:05", "Registro en BMR"]],
    doc: "SOP de operación de bioreactor",
    cite: "Capacitación SOP-BR-03 · cap. 2",
    page: 8,
    span: "Procedimiento de arranque: precondiciones, inoculación, ajuste de parámetros y registro en el BMR."
  }]
}, {
  key: "min",
  label: "Minería",
  icon: "mountain",
  codo: "CODO-MIN-08",
  entity: "Excavadora Komatsu PC-2000",
  blurb: "Operación segura, inspección pre-uso y MSDS de combustibles.",
  ctx: "una excavadora Komatsu PC-2000 en piso de mina (safety & compliance, AS/NZS)",
  docs: ["Procedimiento de operación segura de excavadora", "MSDS de combustible diésel", "Reporte de inspección pre-uso"],
  qa: [{
    kind: "info",
    q: "¿Capacidad del tanque de combustible?",
    value: "1,800",
    unit: "L",
    note: "No operar por debajo del 10% de nivel.",
    doc: "Procedimiento de operación segura",
    cite: "POS Komatsu PC-2000 · §4.2",
    page: 11,
    span: "Capacidad del tanque de combustible: 1,800 L. No operar por debajo del 10% de nivel."
  }, {
    kind: "steps",
    q: "¿Pasos de bloqueo y etiquetado (LOTO)?",
    title: "Bloqueo y etiquetado",
    ppe: [["hand", "Guantes"], ["hard-hat", "Casco"]],
    steps: ["Apaga el equipo y retira la llave.", "Aísla la energía y la presión hidráulica.", "Coloca bloqueo y etiqueta personal.", "Verifica energía cero antes de intervenir."],
    warn: ["PELIGRO", "No intervenir sin verificar energía cero."],
    doc: "Procedimiento de operación segura",
    cite: "POS Komatsu PC-2000 · §6",
    page: 17,
    span: "Secuencia LOTO: apagar, aislar la energía, colocar bloqueo y etiqueta, verificar energía cero antes de intervenir."
  }, {
    kind: "troubleshoot",
    q: "La excavadora no arranca",
    title: "Diagnóstico · no arranca",
    ask: "¿El tablero enciende al dar contacto?",
    options: [["Sí enciende", "Causa probable: combustible bajo o filtro obstruido. Verifica nivel y purga el sistema de combustible."], ["No enciende", "Causa probable: batería o corte de seguridad activo. Revisa bornes y el paro de emergencia."]],
    doc: "Procedimiento de operación segura",
    cite: "Guía de fallas · §5.2",
    page: 24,
    span: "Si no arranca: con tablero encendido, sospechar combustible o filtro; sin tablero, batería o paro de emergencia."
  }, {
    kind: "alerts",
    q: "¿Tengo inspecciones vencidas?",
    title: "Inspecciones y certificaciones",
    items: [["warn", "Inspección pre-uso del turno", "Pendiente hoy"], ["caution", "Certificación del operador", "Vence en 18 días"]],
    doc: "Reporte de inspección pre-uso",
    cite: "Bitácora de inspección · §1",
    page: 1,
    span: "La inspección pre-uso es obligatoria al inicio de cada turno y se registra en la bitácora."
  }]
}, {
  key: "agri",
  label: "Agroindustria",
  icon: "sprout",
  codo: "CODO-AGRI-02",
  entity: "Tanque enfriamiento leche T-7",
  blurb: "Especificaciones de producto, muestreo y certificados por mercado.",
  ctx: "un tanque de enfriamiento de leche cruda T-7 para agroexportación (trazabilidad multi-mercado)",
  docs: ["Especificación de producto leche cruda", "Protocolo de muestreo", "Certificado de calidad para mercado destino"],
  qa: [{
    kind: "info",
    q: "¿Temperatura de almacenamiento de la leche cruda?",
    value: "≤ 4",
    unit: "°C",
    note: "Dentro de las 2 h posteriores al ordeño, hasta su recolección.",
    doc: "Especificación de producto · leche cruda",
    cite: "Especificación T-7 · §1.3",
    page: 3,
    span: "La leche cruda debe enfriarse a ≤ 4 °C dentro de las 2 horas posteriores al ordeño y mantenerse así hasta su recolección."
  }, {
    kind: "steps",
    q: "¿Protocolo de muestreo?",
    title: "Toma de muestra representativa",
    ppe: [["hand", "Guantes"], ["glasses", "Cofia"]],
    steps: ["Homogeneiza el tanque antes de muestrear.", "Toma muestra en frasco estéril identificado.", "Mantén cadena de frío (≤ 4 °C).", "Envía al laboratorio dentro de 24 h."],
    warn: ["NOTA", "Frasco estéril y cadena de frío son obligatorios."],
    doc: "Protocolo de muestreo",
    cite: "PM-Agri · §2.2",
    page: 2,
    span: "Tomar muestra representativa por tanque en frasco estéril, manteniendo la cadena de frío hasta el laboratorio."
  }, {
    kind: "compare",
    q: "Compara requisitos UE vs EE. UU.",
    title: "Criterios por mercado",
    from: "EE. UU.",
    to: "Unión Europea",
    diff: [["chg", "Recuento bacteriano: ≤ 300,000 → ≤ 100,000 UFC/ml."], ["chg", "Células somáticas: ≤ 750,000 → ≤ 400,000 /ml."], ["add", "Certificado sanitario por lote exportado."]],
    summary: "La UE exige límites más estrictos de recuento bacteriano y células somáticas, más certificado sanitario por lote.",
    doc: "Certificado de calidad para mercado destino",
    cite: "Cert. · criterios por mercado",
    page: 1,
    span: "Mercado UE: recuento bacteriano ≤ 100,000 UFC/ml; células somáticas ≤ 400,000/ml; certificado sanitario por lote."
  }, {
    kind: "history",
    q: "Historial de recolecciones del tanque",
    title: "Recolecciones · T-7",
    events: [["Hoy", "Recolección 06:10 · 2,400 L · 3.8 °C"], ["Ayer", "Recolección 06:05 · 2,310 L · 3.9 °C"], ["Anteayer", "CIP registrado tras recolección"]],
    pattern: "La temperatura sube levemente los días de mayor volumen.",
    doc: "Especificación de producto · leche cruda",
    cite: "Bitácora T-7 · §4.1",
    page: 6,
    span: "Cada recolección se registra con volumen y temperatura; la limpieza CIP queda asentada en la bitácora."
  }]
}];
Object.assign(window, {
  CODOS
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/commercial-v2/codo-data.jsx", error: String((e && e.message) || e) }); }

// ui_kits/commercial-v2/codos.jsx
try { (() => {
/* DOCYAN sitio público v2 — DEMOS SIN REGISTRO (CoDos).
   5 Conjuntos de Documentos por vertical. Escalón intermedio del embudo:
   el CTA primario del sitio sigue siendo el freemium; aquí se prueba sin
   registro y el CTA de salida es "Ahora con tus documentos →" (/signup).
   Los documentos de muestra están en su idioma original (español). */

/* ---------- renderers por tipo de respuesta ---------- */
function KInfo({
  a
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "big"
  }, a.value, " ", /*#__PURE__*/React.createElement("span", {
    className: "u"
  }, a.unit)), /*#__PURE__*/React.createElement("p", {
    className: "note"
  }, a.note));
}
function KSteps({
  a
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h4", {
    className: "k-title"
  }, a.title), a.ppe && /*#__PURE__*/React.createElement("div", {
    className: "k-ppe"
  }, a.ppe.map(([ic, label], i) => /*#__PURE__*/React.createElement("span", {
    key: i
  }, /*#__PURE__*/React.createElement(Icon, {
    name: ic === "glasses" ? "glasses" : ic === "hard-hat" ? "hard-hat" : "hand",
    size: 13
  }), label))), /*#__PURE__*/React.createElement("ol", {
    className: "k-steps"
  }, a.steps.map((s, i) => /*#__PURE__*/React.createElement("li", {
    key: i
  }, s))), a.warn && /*#__PURE__*/React.createElement("div", {
    className: "k-warn"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "alert-triangle",
    size: 14
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("b", null, a.warn[0]), " ", a.warn[1])));
}
function KDiagram({
  a
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h4", {
    className: "k-title"
  }, a.title), /*#__PURE__*/React.createElement("div", {
    className: "k-diagram ph"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ph-tag"
  }, "diagrama \xB7 ", a.title), a.pins.map(([n, x, y, label]) => /*#__PURE__*/React.createElement("span", {
    className: "k-pin",
    key: n,
    style: {
      left: x + "%",
      top: y + "%"
    },
    title: label
  }, n))), /*#__PURE__*/React.createElement("ul", {
    className: "k-pinlist"
  }, a.pins.map(([n,,, label]) => /*#__PURE__*/React.createElement("li", {
    key: n
  }, /*#__PURE__*/React.createElement("b", null, n), " ", label))));
}
function KTroubleshoot({
  a
}) {
  const [pick, setPick] = React.useState(null);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h4", {
    className: "k-title"
  }, a.title), /*#__PURE__*/React.createElement("p", {
    className: "note"
  }, a.ask), /*#__PURE__*/React.createElement("div", {
    className: "k-opts"
  }, a.options.map(([label], i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    className: "k-opt" + (pick === i ? " on" : ""),
    onClick: () => setPick(i)
  }, label))), pick !== null && /*#__PURE__*/React.createElement("p", {
    className: "note k-optnote"
  }, a.options[pick][1]));
}
function KCompare({
  a
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h4", {
    className: "k-title"
  }, a.title, " \xB7 ", /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 12
    }
  }, a.from, " \u2192 ", a.to)), /*#__PURE__*/React.createElement("ul", {
    className: "k-diff"
  }, a.diff.map(([kind, txt], i) => /*#__PURE__*/React.createElement("li", {
    key: i,
    className: kind
  }, /*#__PURE__*/React.createElement(Icon, {
    name: kind === "add" ? "plus" : kind === "del" ? "minus" : "arrow-right",
    size: 13
  }), txt))), /*#__PURE__*/React.createElement("p", {
    className: "note"
  }, a.summary));
}
function KAlerts({
  a
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h4", {
    className: "k-title"
  }, a.title), /*#__PURE__*/React.createElement("div", {
    className: "k-alerts"
  }, a.items.map(([lvl, label, when], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "k-alert " + lvl
  }, /*#__PURE__*/React.createElement(Icon, {
    name: lvl === "warn" ? "alert-triangle" : "clock",
    size: 14
  }), /*#__PURE__*/React.createElement("span", null, label), /*#__PURE__*/React.createElement("b", null, when)))));
}
function KHistory({
  a
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h4", {
    className: "k-title"
  }, a.title), /*#__PURE__*/React.createElement("div", {
    className: "k-hist"
  }, a.events.map(([when, what], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "k-ev"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono"
  }, when), /*#__PURE__*/React.createElement("span", null, what)))), a.pattern && /*#__PURE__*/React.createElement("p", {
    className: "note k-pattern"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "activity",
    size: 13
  }), " ", a.pattern));
}
function KVideo({
  a
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h4", {
    className: "k-title"
  }, a.title, " ", /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 11,
      color: "var(--fg-subtle)"
    }
  }, a.dur)), /*#__PURE__*/React.createElement("div", {
    className: "k-video ph"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ph-tag"
  }, "video \xB7 ", a.title), /*#__PURE__*/React.createElement("span", {
    className: "k-play"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "play",
    size: 18
  }))), /*#__PURE__*/React.createElement("ul", {
    className: "k-chapters"
  }, a.chapters.map(([ts, label], i) => /*#__PURE__*/React.createElement("li", {
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono"
  }, ts), label))));
}
const KIND_RENDERERS = {
  info: KInfo,
  steps: KSteps,
  diagram: KDiagram,
  troubleshoot: KTroubleshoot,
  compare: KCompare,
  alerts: KAlerts,
  history: KHistory,
  video: KVideo
};

/* ---------- reproductor de CoDo ---------- */
function CodoPlayer({
  codo
}) {
  const t = useT();
  const linkOut = useLinkOut();
  const [qa, setQa] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [showSrc, setShowSrc] = React.useState(false);
  const [docView, setDocView] = React.useState(null);
  const cardRef = React.useRef(null);
  React.useEffect(() => {
    setQa(null);
    setLoading(false);
    setShowSrc(false);
  }, [codo.key]);
  const ask = item => {
    if (loading) return;
    setLoading(true);
    setQa(item);
    setShowSrc(false);
    const el = cardRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.top < 0) window.scrollBy({
        top: r.top - 14,
        behavior: "smooth"
      });
    }
    setTimeout(() => setLoading(false), 480);
  };
  const Renderer = qa ? KIND_RENDERERS[qa.kind] || KInfo : null;
  return /*#__PURE__*/React.createElement("div", {
    className: "demo-card2 codo-card",
    ref: cardRef,
    "data-comment-anchor": "codo-" + codo.key
  }, /*#__PURE__*/React.createElement("div", {
    className: "dc2-top"
  }, /*#__PURE__*/React.createElement("span", {
    className: "t-ico"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: codo.icon,
    size: 16
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "ml"
  }, codo.codo, " \xB7 ", codo.label), /*#__PURE__*/React.createElement("div", {
    className: "mn"
  }, codo.entity)), /*#__PURE__*/React.createElement("span", {
    className: "dc2-live"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot"
  }), t({
    es: "SIN REGISTRO",
    en: "NO SIGNUP"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "dc2-docs"
  }, codo.docs.map((d, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "dc2-doc on",
    style: {
      cursor: "default"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "file-text",
    size: 13
  }), d))), /*#__PURE__*/React.createElement("div", {
    className: "dc2-body",
    "aria-live": "polite",
    style: {
      minHeight: 170
    }
  }, !qa && /*#__PURE__*/React.createElement("div", {
    className: "dc2-empty"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "message-circle-question",
    size: 22
  }), /*#__PURE__*/React.createElement("p", null, t({
    es: "Elige una consulta. Cada respuesta llega con su cita al documento.",
    en: "Pick a query. Every answer arrives with its citation to the document."
  }))), qa && /*#__PURE__*/React.createElement("div", {
    className: "dc2-q"
  }, qa.q), qa && loading && /*#__PURE__*/React.createElement("div", {
    className: "dc2-shimmer"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot"
  }), t({
    es: "DOCYAN está leyendo el documento…",
    en: "DOCYAN is reading the document…"
  })), qa && !loading && /*#__PURE__*/React.createElement("div", {
    className: "dc2-a"
  }, /*#__PURE__*/React.createElement(Renderer, {
    a: qa
  }), /*#__PURE__*/React.createElement("div", {
    className: "dc2-citerow"
  }, /*#__PURE__*/React.createElement("button", {
    className: "cite2",
    onClick: () => setShowSrc(!showSrc)
  }, /*#__PURE__*/React.createElement("span", {
    className: "brk"
  }), /*#__PURE__*/React.createElement("span", {
    className: "ctxt"
  }, qa.cite, " \xB7 ", t({
    es: "pág.",
    en: "p."
  }), " ", qa.page), " \u2197"), /*#__PURE__*/React.createElement("button", {
    className: "openpdf",
    onClick: () => setDocView(qa)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "external-link",
    size: 13
  }), t({
    es: "Abrir PDF",
    en: "Open PDF"
  }))), showSrc && /*#__PURE__*/React.createElement("div", {
    className: "dc2-src"
  }, /*#__PURE__*/React.createElement("span", {
    className: "thread"
  }), /*#__PURE__*/React.createElement("div", {
    className: "src2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "s-head"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "file-text",
    size: 12
  }), /*#__PURE__*/React.createElement("span", null, t({
    es: "Fragmento original",
    en: "Original fragment"
  })), /*#__PURE__*/React.createElement("span", {
    className: "pg"
  }, qa.doc)), /*#__PURE__*/React.createElement("div", {
    className: "s-span"
  }, qa.span), /*#__PURE__*/React.createElement("div", {
    className: "s-actions"
  }, /*#__PURE__*/React.createElement("span", {
    className: "s-ped"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "shield-check",
    size: 12
  }), t({
    es: "Pedigree a span · SHA-256",
    en: "Span pedigree · SHA-256"
  })), /*#__PURE__*/React.createElement("button", {
    className: "openpdf",
    onClick: () => setDocView(qa)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "external-link",
    size: 13
  }), t({
    es: "Abrir PDF",
    en: "Open PDF"
  }))))))), /*#__PURE__*/React.createElement("div", {
    className: "dc2-sugs"
  }, codo.qa.map((item, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    className: "dc2-sug" + (qa === item ? " onq" : ""),
    disabled: loading,
    onClick: () => ask(item)
  }, item.q))), /*#__PURE__*/React.createElement("div", {
    className: "codo-exit"
  }, /*#__PURE__*/React.createElement("span", null, t({
    es: "Esto, con los documentos de muestra. ",
    en: "That was with sample documents. "
  })), /*#__PURE__*/React.createElement("button", {
    className: "btn primary",
    onClick: () => linkOut("/signup")
  }, t({
    es: "Ahora con tus documentos",
    en: "Now with your documents"
  }), /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-right",
    size: 15
  }))), docView && /*#__PURE__*/React.createElement(DocOverlay, {
    a: docView,
    codo: codo.codo,
    onClose: () => setDocView(null)
  }));
}

/* ---------- página de demos ---------- */
function DemosPage({
  go,
  initial
}) {
  const t = useT();
  const [key, setKey] = React.useState(initial && CODOS.some(c => c.key === initial) ? initial : CODOS[0].key);
  React.useEffect(() => {
    if (initial && CODOS.some(c => c.key === initial)) setKey(initial);
  }, [initial]);
  const codo = CODOS.find(c => c.key === key);
  return /*#__PURE__*/React.createElement("main", {
    "data-screen-label": "Demos sin registro"
  }, /*#__PURE__*/React.createElement("header", {
    className: "page-hero"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("span", {
    className: "eyebrow"
  }, t({
    es: "Demos sin registro · CoDos",
    en: "No-signup demos · CoDos"
  })), /*#__PURE__*/React.createElement("h1", null, t({
    es: "Pruébalo ahora, con documentos reales de tu sector",
    en: "Try it now, with real documents from your industry"
  })), /*#__PURE__*/React.createElement("p", {
    className: "sec-lead"
  }, t({
    es: "Cinco Conjuntos de Documentos (CoDos) ya analizados en vivo. Sin registro, sin tarjeta: elige tu sector y pregunta. Los documentos de muestra están en su idioma original.",
    en: "Five Document Sets (CoDos) already analyzed live. No signup, no card: pick your industry and ask. Sample documents are in their original language."
  })))), /*#__PURE__*/React.createElement("section", {
    className: "band",
    style: {
      paddingTop: 20
    },
    "data-screen-label": "Demos \u2014 CoDo activo"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "codo-tabs",
    role: "tablist",
    "aria-label": t({
      es: "Sectores de demo",
      en: "Demo industries"
    })
  }, CODOS.map(c => /*#__PURE__*/React.createElement("button", {
    key: c.key,
    role: "tab",
    "aria-selected": c.key === key,
    className: "codo-tab" + (c.key === key ? " on" : ""),
    onClick: () => setKey(c.key)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: c.icon,
    size: 15
  }), c.label))), /*#__PURE__*/React.createElement("p", {
    className: "codo-blurb"
  }, codo.blurb), /*#__PURE__*/React.createElement("div", {
    className: "codo-stage"
  }, /*#__PURE__*/React.createElement(CodoPlayer, {
    codo: codo
  })))), /*#__PURE__*/React.createElement("section", {
    className: "band paper",
    "data-screen-label": "Demos \u2014 CTA"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cta-band"
  }, /*#__PURE__*/React.createElement("span", {
    className: "eyebrow"
  }, t({
    es: "El siguiente escalón",
    en: "The next step"
  })), /*#__PURE__*/React.createElement("h2", {
    className: "sec-title"
  }, t({
    es: "Lo mismo, con tus propios documentos",
    en: "The same, with your own documents"
  }))), /*#__PURE__*/React.createElement(Doors, {
    compact: true
  }))));
}

/* ---------- puente en la home ---------- */
function CodoBridge({
  go
}) {
  const t = useT();
  return /*#__PURE__*/React.createElement("section", {
    className: "band ink codo-bridge",
    "data-screen-label": "Home \u2014 Puente CoDos"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cb-grid"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "eyebrow"
  }, t({
    es: "Demos sin registro",
    en: "No-signup demos"
  })), /*#__PURE__*/React.createElement("h2", {
    className: "sec-title"
  }, t({
    es: "¿Quieres verlo con documentos de tu sector?",
    en: "Want to see it with documents from your industry?"
  })), /*#__PURE__*/React.createElement("p", {
    className: "sec-lead"
  }, t({
    es: "Cinco Conjuntos de Documentos ya analizados — pregunta lo que preguntarías en tu operación, sin registrarte.",
    en: "Five Document Sets already analyzed — ask what you'd ask in your operation, without signing up."
  }))), /*#__PURE__*/React.createElement("div", {
    className: "cb-list"
  }, CODOS.map(c => /*#__PURE__*/React.createElement("button", {
    key: c.key,
    className: "cb-item",
    onClick: () => go("demos:" + c.key)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: c.icon,
    size: 17
  }), /*#__PURE__*/React.createElement("span", null, c.label), /*#__PURE__*/React.createElement("span", {
    className: "cb-entity"
  }, c.entity), /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-right",
    size: 15
  })))))));
}
Object.assign(window, {
  DemosPage,
  CodoBridge,
  CodoPlayer
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/commercial-v2/codos.jsx", error: String((e && e.message) || e) }); }

// ui_kits/commercial-v2/como.jsx
try { (() => {
/* DOCYAN sitio público v2 — CÓMO FUNCIONA.
   Sin caja negra, para CIOs/TI: pipeline, grafo-vs-RAG, intención,
   línea multilingüe completa, SHA-256, CTA del embudo nuevo. */

function ComoPage({
  go
}) {
  const t = useT();
  return /*#__PURE__*/React.createElement("main", {
    "data-screen-label": "C\xF3mo funciona"
  }, /*#__PURE__*/React.createElement("header", {
    className: "page-hero"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("span", {
    className: "eyebrow"
  }, t({
    es: "Cómo funciona · para tu equipo de TI",
    en: "How it works · for your IT team"
  })), /*#__PURE__*/React.createElement("h1", null, t({
    es: "Sin caja negra: así llega una respuesta a su cita",
    en: "No black box: how an answer reaches its citation"
  })), /*#__PURE__*/React.createElement("p", {
    className: "sec-lead"
  }, t({
    es: "DOCYAN no «busca parecidos» en tus PDFs. Analiza cada documento en una estructura viva y responde desde ella — por eso cada respuesta sabe exactamente de dónde viene.",
    en: "DOCYAN doesn't “look for similarities” in your PDFs. It analyzes every document into a living structure and answers from it — which is why every answer knows exactly where it came from."
  })))), /*#__PURE__*/React.createElement("section", {
    className: "band",
    "data-screen-label": "C\xF3mo \u2014 Pipeline"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "arch2"
  }, [{
    ic: "file-up",
    h: {
      es: "Ingesta",
      en: "Ingestion"
    },
    p: {
      es: "El documento entra y se registra con hash SHA-256 — su identidad criptográfica desde el minuto cero.",
      en: "The document enters and is registered with a SHA-256 hash — its cryptographic identity from minute zero."
    }
  }, {
    ic: "scan-text",
    h: {
      es: "Análisis vivo",
      en: "Live analysis"
    },
    p: {
      es: "Estructura, tablas, unidades y relaciones se vuelven un grafo del documento, no una bolsa de fragmentos.",
      en: "Structure, tables, units and relationships become a graph of the document, not a bag of fragments."
    }
  }, {
    ic: "git-branch",
    h: {
      es: "Clasificación de intención",
      en: "Intent classification"
    },
    p: {
      es: "Cada pregunta se clasifica: dato puntual, procedimiento, comparación. La ruta de respuesta depende de la intención.",
      en: "Each question is classified: point fact, procedure, comparison. The answer path depends on the intent."
    }
  }, {
    ic: "quote",
    h: {
      es: "Respuesta con pedigree",
      en: "Answer with pedigree"
    },
    p: {
      es: "La respuesta se compone desde el grafo, con cita a span y umbral de confianza según la criticidad del dato.",
      en: "The answer is composed from the graph, with a span citation and a confidence threshold set by the data's criticality."
    }
  }].map((n, i, arr) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    className: "anode"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ic"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: n.ic,
    size: 22
  })), /*#__PURE__*/React.createElement("h3", null, t(n.h)), /*#__PURE__*/React.createElement("p", null, t(n.p))), i < arr.length - 1 && /*#__PURE__*/React.createElement("span", {
    className: "aarr"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-right",
    size: 18
  }))))))), /*#__PURE__*/React.createElement("section", {
    className: "band paper",
    "data-screen-label": "C\xF3mo \u2014 Grafo vs RAG"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("span", {
    className: "eyebrow"
  }, t({
    es: "La diferencia técnica",
    en: "The technical difference"
  })), /*#__PURE__*/React.createElement("h2", {
    className: "sec-title"
  }, t({
    es: "Grafo de documento vivo, no RAG genérico",
    en: "Live document graph, not generic RAG"
  })), /*#__PURE__*/React.createElement("div", {
    className: "vs-table"
  }, /*#__PURE__*/React.createElement("div", {
    className: "vs-row vs-head"
  }, /*#__PURE__*/React.createElement("div", null, t({
    es: "Dimensión",
    en: "Dimension"
  })), /*#__PURE__*/React.createElement("div", null, t({
    es: "RAG genérico",
    en: "Generic RAG"
  })), /*#__PURE__*/React.createElement("div", {
    className: "vs-doc"
  }, "DOCYAN LDE")), [{
    d: {
      es: "Unidad de análisis",
      en: "Unit of analysis"
    },
    r: {
      es: "Fragmentos sueltos por similitud",
      en: "Loose chunks by similarity"
    },
    doc: {
      es: "El documento completo como grafo: estructura, tablas, unidades",
      en: "The whole document as a graph: structure, tables, units"
    }
  }, {
    d: {
      es: "Trazabilidad",
      en: "Traceability"
    },
    r: {
      es: "«Fuentes» aproximadas, a veces inventadas",
      en: "Approximate “sources,” sometimes invented"
    },
    doc: {
      es: "Pedigree a span: cada dato apunta al fragmento exacto",
      en: "Span pedigree: every datum points to the exact fragment"
    }
  }, {
    d: {
      es: "Cuando no sabe",
      en: "When it doesn't know"
    },
    r: {
      es: "Responde igual, con seguridad fingida",
      en: "Answers anyway, with feigned confidence"
    },
    doc: {
      es: "Umbral por criticidad: por debajo, lo dice y orienta dónde buscar",
      en: "Criticality threshold: below it, it says so and points where to look"
    }
  }, {
    d: {
      es: "Idioma",
      en: "Language"
    },
    r: {
      es: "Mezcla idiomas o pierde el original",
      en: "Mixes languages or loses the original"
    },
    doc: {
      es: "Respuesta en el idioma del usuario; el span original, intacto, a un toque",
      en: "Answer in the user's language; the original span, intact, one tap away"
    }
  }, {
    d: {
      es: "Integridad",
      en: "Integrity"
    },
    r: {
      es: "Sin cadena verificable",
      en: "No verifiable chain"
    },
    doc: {
      es: "SHA-256 de documento a respuesta, auditable",
      en: "SHA-256 from document to answer, auditable"
    }
  }].map((r, i) => /*#__PURE__*/React.createElement("div", {
    className: "vs-row",
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    className: "vs-dim"
  }, t(r.d)), /*#__PURE__*/React.createElement("div", {
    className: "vs-rag"
  }, t(r.r)), /*#__PURE__*/React.createElement("div", {
    className: "vs-doc"
  }, t(r.doc))))))), /*#__PURE__*/React.createElement("section", {
    className: "band",
    "data-screen-label": "C\xF3mo \u2014 L\xEDnea multiling\xFCe"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("span", {
    className: "eyebrow"
  }, t({
    es: "La línea multilingüe",
    en: "The multilingual line"
  })), /*#__PURE__*/React.createElement("h2", {
    className: "sec-title"
  }, t({
    es: "La pregunta viaja; el original no se mueve",
    en: "The question travels; the original never moves"
  })), /*#__PURE__*/React.createElement("p", {
    className: "sec-lead"
  }, t({
    es: "El documento se analiza en su idioma original y así se queda. Cuando alguien pregunta en otro idioma, DOCYAN responde en el idioma de la pregunta — y la cita lleva siempre al span original, intacto. La fuente nunca se reescribe.",
    en: "The document is analyzed in its original language and stays that way. When someone asks in another language, DOCYAN answers in the language of the question — and the citation always leads to the original span, intact. The source is never rewritten."
  })), /*#__PURE__*/React.createElement("div", {
    className: "steps3"
  }, [{
    n: "·",
    ic: "file-text",
    h: {
      es: "El original es sagrado",
      en: "The original is sacred"
    },
    p: {
      es: "El MSDS que vino en inglés vive en inglés. Su hash lo fija; nadie consulta una copia reescrita.",
      en: "The MSDS that came in English lives in English. Its hash pins it; nobody consults a rewritten copy."
    }
  }, {
    n: "·",
    ic: "message-circle",
    h: {
      es: "La consulta, en tu idioma",
      en: "The consultation, in your language"
    },
    p: {
      es: "El operador pregunta en español y lee la respuesta en español, de un vistazo, sin fricción.",
      en: "The operator asks in Spanish and reads the answer in Spanish, at a glance, without friction."
    }
  }, {
    n: "·",
    ic: "quote",
    h: {
      es: "El span original, a un toque",
      en: "The original span, one tap away"
    },
    p: {
      es: "La cita abre el fragmento exacto tal como vino. Verificable por cualquiera, en cualquier auditoría.",
      en: "The citation opens the exact fragment as it came. Verifiable by anyone, in any audit."
    }
  }].map((s, i) => /*#__PURE__*/React.createElement("div", {
    className: "step3",
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "si"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: s.ic,
    size: 22
  })), /*#__PURE__*/React.createElement("h3", null, t(s.h)), /*#__PURE__*/React.createElement("p", null, t(s.p))))))), /*#__PURE__*/React.createElement("section", {
    className: "band paper",
    "data-screen-label": "C\xF3mo \u2014 Cierre"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "unsafe",
    style: {
      marginTop: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "scale",
    size: 20
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", null, t({
    es: "Dónde termina DOCYAN",
    en: "Where DOCYAN ends"
  })), /*#__PURE__*/React.createElement("p", null, t({
    es: "DOCYAN es capa de conocimiento, no sistema de registro primario. Emite alertas administrativas; la decisión clínica u operativa es siempre de tu gente y tus sistemas de registro.",
    en: "DOCYAN is a knowledge layer, not a primary system of record. It raises administrative alerts; clinical and operational decisions always belong to your people and your systems of record."
  })))), /*#__PURE__*/React.createElement("div", {
    className: "cta-band",
    style: {
      marginTop: 44
    }
  }, /*#__PURE__*/React.createElement("h2", {
    className: "sec-title"
  }, t({
    es: "Pruébalo con tus propios documentos",
    en: "Try it with your own documents"
  }))), /*#__PURE__*/React.createElement(Doors, {
    compact: true
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 26,
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("a", {
    className: "vlink",
    onClick: () => go("seguridad")
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "shield",
    size: 14
  }), t({
    es: "Seguridad y gobernanza en detalle",
    en: "Security & governance in detail"
  }))))));
}
Object.assign(window, {
  ComoPage
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/commercial-v2/como.jsx", error: String((e && e.message) || e) }); }

// ui_kits/commercial-v2/demo.jsx
try { (() => {
/* DOCYAN sitio público v2 — demo vivo rediseñado.
   Misma mecánica (documento → pregunta → respuesta con cita a span),
   mejor puesta en escena: charola de documentos reales, pregunta tecleada,
   respuesta de un vistazo y span original revelado (consulta multilingüe
   demostrada con un documento que vino en inglés — sin nombrarlo "traducción"). */

/* abrir el documento fuente (mock de PDF) aterrizando en el span citado */
function openDoc2(a, codo, docName) {
  const u = new URLSearchParams({
    doc: a.doc || docName || a.cite || "Documento fuente",
    cite: a.cite || "Documento · §",
    page: String(a.page || "—"),
    span: a.span || "Fragmento citado del documento fuente.",
    codo: codo || "DEMO",
    lang: a.spanLang || "ES"
  });
  window.open("demo-doc.html?" + u.toString(), "_blank", "noopener");
}

/* overlay modal del documento fuente — divulgación progresiva nivel 2.
   El documento se muestra en su idioma ORIGINAL (a.spanLang); desde el pie
   se puede abrir el documento completo en pestaña nueva (nivel 3). */
function DocOverlay({
  a,
  codo,
  onClose
}) {
  const t = useT();
  React.useEffect(() => {
    const onKey = e => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (!a) return null;
  const EN = (a.spanLang || "ES") === "EN";
  const docTitle = a.doc || "Documento fuente";
  return /*#__PURE__*/React.createElement("div", {
    className: "doc-ov",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "doc-sheet",
    onClick: e => e.stopPropagation(),
    role: "dialog",
    "aria-modal": "true",
    "aria-label": docTitle
  }, /*#__PURE__*/React.createElement("div", {
    className: "dsh-head"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "dsh-eyebrow"
  }, a.cite, " \xB7 ", EN ? "p. " : "pág. ", a.page), /*#__PURE__*/React.createElement("div", {
    className: "dsh-title"
  }, docTitle), /*#__PURE__*/React.createElement("div", {
    className: "dsh-meta"
  }, "DOCYAN \xB7 ", codo || "DEMO", " \xB7 ", EN ? t({
    es: "documento vivo · idioma original: inglés",
    en: "live document · original language: English"
  }) : t({
    es: "documento vivo · idioma original: español",
    en: "live document · original language: Spanish"
  }))), /*#__PURE__*/React.createElement("button", {
    className: "dsh-x",
    onClick: onClose,
    "aria-label": t({
      es: "Cerrar",
      en: "Close"
    })
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 18
  }))), /*#__PURE__*/React.createElement("div", {
    className: "dsh-body"
  }, /*#__PURE__*/React.createElement("h2", null, EN ? "Preconditions" : "Condiciones previas"), /*#__PURE__*/React.createElement("p", null, EN ? "Before any intervention, verify that the equipment is in a safe state and confirm the validity of the associated records." : "Antes de cualquier intervención, verifica que el equipo se encuentre en estado seguro y confirma la vigencia de los registros asociados."), /*#__PURE__*/React.createElement("h2", null, (a.cite || "§").split("·").pop().trim(), " \u2014 ", EN ? "cited section" : "sección citada"), /*#__PURE__*/React.createElement("p", null, EN ? "Under the conditions defined for this operating entity, the following applies. " : "En las condiciones definidas para esta entidad operativa, aplica lo siguiente. ", /*#__PURE__*/React.createElement("mark", {
    className: "dsh-span"
  }, a.span), /*#__PURE__*/React.createElement("span", {
    className: "dsh-tag"
  }, EN ? "span cited by DOCYAN" : "span citado por DOCYAN"), " ", EN ? "Repeat the verification a second time to ensure record consistency." : "Repite la verificación una segunda vez para asegurar la consistencia del registro."), /*#__PURE__*/React.createElement("h2", null, EN ? "Records" : "Registro"), /*#__PURE__*/React.createElement("p", null, EN ? "After completing the procedure, record the value and date in the equipment log. Traceability is cryptographically chained in DOCYAN's FAT." : "Tras completar el procedimiento, registra el valor y la fecha en la bitácora del equipo. La trazabilidad queda encadenada criptográficamente en el FAT de DOCYAN.")), /*#__PURE__*/React.createElement("div", {
    className: "dsh-foot"
  }, /*#__PURE__*/React.createElement("span", {
    className: "s-ped"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "shield-check",
    size: 12
  }), t({
    es: "Pedigree a span exacto · cadena SHA-256",
    en: "Exact-span pedigree · SHA-256 chain"
  })), /*#__PURE__*/React.createElement("a", {
    className: "dsh-open",
    onClick: () => openDoc2(a, codo)
  }, t({
    es: "Abrir en pestaña nueva",
    en: "Open in new tab"
  }), " \u2197"))));
}
const demoDelay = ms => new Promise(r => setTimeout(r, ms));
const DEMO_DOCS = [{
  key: "msds",
  name: {
    es: "MSDS — Acetona",
    en: "MSDS — Acetone"
  },
  langTag: "EN",
  icon: "file-text",
  qa: [{
    q: {
      es: "¿Cuál es el límite de exposición OSHA?",
      en: "What is the OSHA exposure limit?"
    },
    value: "1,000",
    unit: "ppm",
    note: {
      es: "PEL (TWA 8 h) según OSHA. El TLV de ACGIH es más estricto: 250 ppm.",
      en: "OSHA PEL (8-hr TWA). The ACGIH TLV is stricter: 250 ppm."
    },
    cite: "MSDS Acetone · Sec. 8",
    page: 5,
    span: "Exposure controls — OSHA PEL (TWA 8 hr): 1000 ppm. ACGIH TLV (TWA): 250 ppm.",
    mark: "OSHA PEL (TWA 8 hr): 1000 ppm",
    spanLang: "EN"
  }, {
    q: {
      es: "¿Qué protección personal requiere su manejo?",
      en: "What personal protection does handling require?"
    },
    text: {
      es: "Gafas de seguridad con protección lateral y guantes de nitrilo. Manejar en área ventilada, lejos de fuentes de ignición.",
      en: "Safety glasses with side shields and nitrile gloves. Handle in a ventilated area, away from ignition sources."
    },
    cite: "MSDS Acetone · Sec. 8",
    page: 5,
    span: "Personal protective equipment: safety glasses with side shields; nitrile gloves. Use only with adequate ventilation. Keep away from ignition sources.",
    mark: "safety glasses with side shields; nitrile gloves",
    spanLang: "EN"
  }]
}, {
  key: "ficha",
  name: {
    es: "Ficha técnica — Compresor GA-22",
    en: "Datasheet — GA-22 compressor"
  },
  langTag: "ES",
  icon: "file-text",
  qa: [{
    q: {
      es: "¿Rango de presión de operación?",
      en: "What is the operating pressure range?"
    },
    value: "4.0 – 8.5",
    unit: "bar",
    note: {
      es: "Presión nominal de trabajo: 7.5 bar. Verificar el manómetro antes de cada arranque.",
      en: "Nominal working pressure: 7.5 bar. Check the gauge before every start-up."
    },
    cite: "Ficha técnica GA-22 · §4.1",
    page: 12,
    span: "Rango de presión de operación: 4.0 – 8.5 bar. Presión nominal de trabajo: 7.5 bar. Verificar manómetro antes de cada arranque.",
    mark: "4.0 – 8.5 bar",
    spanLang: "ES"
  }, {
    q: {
      es: "¿Intervalo de cambio de aceite?",
      en: "What is the oil change interval?"
    },
    value: "4,000",
    unit: "h",
    note: {
      es: "Con aceite Roto-Inject; reducir a 2,000 h en ambientes con polvo.",
      en: "With Roto-Inject oil; reduce to 2,000 h in dusty environments."
    },
    cite: "Ficha técnica GA-22 · §7.2",
    page: 23,
    span: "Intervalo de cambio de aceite: cada 4,000 horas con aceite Roto-Inject. En ambientes con alta carga de polvo, reducir el intervalo a 2,000 horas.",
    mark: "cada 4,000 horas",
    spanLang: "ES"
  }]
}];
async function askDocyanLive(q, lang, docName) {
  if (!window.claude || typeof window.claude.complete !== "function") throw new Error("offline");
  const prompt = "Eres DOCYAN, un entorno de documentos analizados en vivo. DEMO pública del sitio. " + "El usuario consulta el documento: " + docName + ". " + (lang === "en" ? "Answer in English. " : "Responde en español. ") + "Tono competente y directo, sin marketing, máximo 2 frases, con un dato concreto plausible para ese documento. " + 'Devuelve SOLO JSON sin nada más: {"answer":"...","cite":"Documento · §x.y"}' + "\n\nPregunta: " + q;
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 9000));
  const raw = await Promise.race([window.claude.complete(prompt), timeout]);
  const txt = typeof raw === "string" ? raw : raw && raw.completion || "";
  const m = txt.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("parse");
  const o = JSON.parse(m[0]);
  if (!o.answer) throw new Error("empty");
  return o;
}

/* coincidencia laxa: una pregunta libre que comparte palabras clave
   con una consulta preparada usa su respuesta citada real */
function matchQA(doc, v, t) {
  const norm = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const words = norm(v).split(/[^a-z0-9]+/).filter(w => w.length > 3);
  let best = null,
    bestScore = 0;
  for (const qa of doc.qa) {
    const hay = norm(t(qa.q) + " " + (qa.mark || "") + " " + t(qa.note || qa.text || {}));
    const score = words.filter(w => hay.includes(w)).length;
    if (score > bestScore) {
      best = qa;
      bestScore = score;
    }
  }
  return bestScore >= 1 ? best : null;
}
function LiveDemo({
  compact = false
}) {
  const t = useT();
  const {
    lang
  } = useLang();
  const [docKey, setDocKey] = useState("msds");
  const [phase, setPhase] = useState("idle"); // idle | typing | loading | answered
  const [q, setQ] = useState("");
  const [a, setA] = useState(null);
  const [showSrc, setShowSrc] = useState(false);
  const [text, setText] = useState("");
  const [docView, setDocView] = useState(null);
  const typingRef = useRef(false);
  const cardRef = useRef(null);

  /* al llegar una respuesta, asegurar que el cuerpo de la demo quede visible
     (en móvil el input queda abajo y la respuesta aparece arriba, fuera de vista) */
  useEffect(() => {
    if (phase !== "answered" && phase !== "loading") return;
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top < 0) window.scrollBy({
      top: r.top - 14,
      behavior: "smooth"
    });
  }, [phase]);
  const doc = DEMO_DOCS.find(d => d.key === docKey);
  const runAnswer = async (question, hit) => {
    setQ(question);
    setPhase("loading");
    setA(null);
    setShowSrc(false);
    if (hit) {
      await demoDelay(520);
      setA(hit);
    } else {
      let res;
      try {
        const o = await askDocyanLive(question, lang, t(doc.name));
        res = {
          text: {
            es: o.answer,
            en: o.answer
          },
          cite: o.cite || t(doc.name) + " · §",
          page: "—",
          span: o.answer,
          mark: null,
          spanLang: lang.toUpperCase()
        };
      } catch (e) {
        res = {
          text: {
            es: "En esta demo pública solo este par de documentos está analizado en vivo. En tu entorno, esta pregunta se respondería igual: con el dato y su cita al original. Prueba una de las consultas sugeridas.",
            en: "In this public demo only these two documents are analyzed live. In your environment, this question would be answered the same way: the datum plus its citation to the original. Try one of the suggested queries."
          },
          cite: null,
          page: null,
          span: null,
          mark: null,
          spanLang: null
        };
      }
      setA(res);
    }
    setPhase("answered");
    setTimeout(() => setShowSrc(true), 480);
  };
  const ask = async qa => {
    if (typingRef.current) return;
    typingRef.current = true;
    const question = t(qa.q);
    setPhase("typing");
    setA(null);
    setShowSrc(false);
    setText("");
    for (let i = 1; i <= question.length; i++) {
      setText(question.slice(0, i));
      await demoDelay(question.length > 38 ? 16 : 26);
    }
    await demoDelay(240);
    setText("");
    typingRef.current = false;
    runAnswer(question, qa);
  };
  const submitFree = e => {
    if (e && e.preventDefault) e.preventDefault();
    if (typingRef.current || phase === "loading") return;
    const v = text.trim();
    if (!v) return;
    setText("");
    const exact = doc.qa.find(x => t(x.q).toLowerCase() === v.toLowerCase());
    runAnswer(v, exact || matchQA(doc, v, t) || null);
  };
  const pickDoc = k => {
    typingRef.current = false;
    setDocKey(k);
    setPhase("idle");
    setA(null);
    setQ("");
    setShowSrc(false);
    setText("");
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "demo-card2",
    "data-comment-anchor": "demo-vivo",
    ref: cardRef
  }, /*#__PURE__*/React.createElement("div", {
    className: "dc2-top"
  }, /*#__PURE__*/React.createElement("span", {
    className: "t-ico"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "files",
    size: 16
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "ml"
  }, t({
    es: "Demo en vivo · tus documentos",
    en: "Live demo · your documents"
  })), /*#__PURE__*/React.createElement("div", {
    className: "mn"
  }, t({
    es: "Pregunta y recibe la respuesta con su fuente",
    en: "Ask and get the answer with its source"
  }))), /*#__PURE__*/React.createElement("span", {
    className: "dc2-live"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot"
  }), t({
    es: "EN VIVO",
    en: "LIVE"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "dc2-docs",
    role: "tablist",
    "aria-label": t({
      es: "Documentos de la demo",
      en: "Demo documents"
    })
  }, DEMO_DOCS.map(d => /*#__PURE__*/React.createElement("button", {
    key: d.key,
    className: "dc2-doc" + (d.key === docKey ? " on" : ""),
    role: "tab",
    "aria-selected": d.key === docKey,
    onClick: () => pickDoc(d.key)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: d.icon,
    size: 13
  }), t(d.name), /*#__PURE__*/React.createElement("span", {
    className: "lang-tag"
  }, d.langTag)))), /*#__PURE__*/React.createElement("div", {
    className: "dc2-body",
    "aria-live": "polite"
  }, phase === "idle" && /*#__PURE__*/React.createElement("div", {
    className: "dc2-empty"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "message-circle-question",
    size: 22
  }), /*#__PURE__*/React.createElement("p", null, doc.key === "msds" ? t({
    es: "Este documento vino en inglés. Pregúntale en tu idioma.",
    en: "Ask this document anything — the answer always carries its source."
  }) : t({
    es: "Pregunta lo que necesitas saber frente al equipo.",
    en: "Ask what you need to know, right at the machine."
  }))), (phase === "loading" || phase === "answered") && /*#__PURE__*/React.createElement("div", {
    className: "dc2-q"
  }, q), phase === "loading" && /*#__PURE__*/React.createElement("div", {
    className: "dc2-shimmer"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot"
  }), t({
    es: "DOCYAN está leyendo el documento…",
    en: "DOCYAN is reading the document…"
  })), phase === "answered" && a && /*#__PURE__*/React.createElement("div", {
    className: "dc2-a"
  }, a.value ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "big"
  }, a.value, " ", /*#__PURE__*/React.createElement("span", {
    className: "u"
  }, a.unit)), /*#__PURE__*/React.createElement("p", {
    className: "note"
  }, t(a.note))) : /*#__PURE__*/React.createElement("p", {
    className: "note",
    style: {
      fontSize: 14.5,
      color: "var(--fg)"
    }
  }, t(a.text)), a.cite && /*#__PURE__*/React.createElement("div", {
    className: "dc2-citerow"
  }, /*#__PURE__*/React.createElement("button", {
    className: "cite2",
    onClick: () => setShowSrc(!showSrc)
  }, /*#__PURE__*/React.createElement("span", {
    className: "brk"
  }), /*#__PURE__*/React.createElement("span", {
    className: "ctxt"
  }, a.cite, " \xB7 ", t({
    es: "pág.",
    en: "p."
  }), " ", a.page), " \u2197"), /*#__PURE__*/React.createElement("button", {
    className: "openpdf",
    onClick: () => setDocView(Object.assign({
      doc: t(doc.name)
    }, a))
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "external-link",
    size: 13
  }), t({
    es: "Abrir PDF",
    en: "Open PDF"
  }))), showSrc && a.span && /*#__PURE__*/React.createElement("div", {
    className: "dc2-src"
  }, /*#__PURE__*/React.createElement("span", {
    className: "thread"
  }), /*#__PURE__*/React.createElement("div", {
    className: "src2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "s-head"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "file-text",
    size: 12
  }), /*#__PURE__*/React.createElement("span", null, t({
    es: "Fragmento original",
    en: "Original fragment"
  })), /*#__PURE__*/React.createElement("span", {
    className: "pg"
  }, t({
    es: "pág.",
    en: "p."
  }), " ", a.page)), /*#__PURE__*/React.createElement("div", {
    className: "s-span"
  }, a.mark && a.span.includes(a.mark) ? /*#__PURE__*/React.createElement(React.Fragment, null, a.span.split(a.mark)[0], /*#__PURE__*/React.createElement("mark", null, a.mark), a.span.split(a.mark)[1]) : a.span), a.spanLang && a.spanLang !== lang.toUpperCase() && /*#__PURE__*/React.createElement("span", {
    className: "s-orig"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "globe",
    size: 11
  }), t({
    es: "Documento original en " + (a.spanLang === "EN" ? "inglés" : "español") + " · tú preguntaste en español",
    en: "Original document in " + (a.spanLang === "EN" ? "English" : "Spanish") + " · you asked in English"
  })), /*#__PURE__*/React.createElement("div", {
    className: "s-actions"
  }, /*#__PURE__*/React.createElement("span", {
    className: "s-ped"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "shield-check",
    size: 12
  }), t({
    es: "Pedigree a span · SHA-256",
    en: "Span pedigree · SHA-256"
  })), /*#__PURE__*/React.createElement("button", {
    className: "openpdf",
    onClick: () => setDocView(Object.assign({
      doc: t(doc.name)
    }, a))
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "external-link",
    size: 13
  }), t({
    es: "Abrir PDF",
    en: "Open PDF"
  }))))))), /*#__PURE__*/React.createElement("div", {
    className: "dc2-sugs"
  }, doc.qa.map((qa, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    className: "dc2-sug",
    disabled: phase === "typing" || phase === "loading",
    onClick: () => ask(qa)
  }, t(qa.q)))), /*#__PURE__*/React.createElement("form", {
    className: "dc2-box",
    onSubmit: submitFree
  }, /*#__PURE__*/React.createElement("input", {
    value: text,
    onChange: e => setText(e.target.value),
    onKeyDown: e => {
      if (e.key === "Enter") submitFree(e);
    },
    placeholder: t({
      es: "Escribe tu pregunta…",
      en: "Type your question…"
    }),
    "aria-label": t({
      es: "Pregunta al documento",
      en: "Ask the document"
    }),
    readOnly: phase === "typing"
  }), /*#__PURE__*/React.createElement("button", {
    className: "send",
    type: "button",
    onClick: submitFree,
    disabled: !text.trim() || phase === "typing" || phase === "loading",
    "aria-label": t({
      es: "Enviar pregunta",
      en: "Send question"
    })
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-up",
    size: 16
  }))), !compact && /*#__PURE__*/React.createElement("div", {
    className: "dc2-foot"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "shield-check",
    size: 12
  }), /*#__PURE__*/React.createElement("span", null, t({
    es: "Respuestas reales del producto en producción · cada cita es trazable al documento original",
    en: "Real answers from the product in production · every citation traces to the original document"
  }))), docView && /*#__PURE__*/React.createElement(DocOverlay, {
    a: docView,
    codo: "DEMO-HOME",
    onClose: () => setDocView(null)
  }));
}
Object.assign(window, {
  LiveDemo,
  DEMO_DOCS,
  DocOverlay,
  openDoc2
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/commercial-v2/demo.jsx", error: String((e && e.message) || e) }); }

// ui_kits/commercial-v2/home.jsx
try { (() => {
/* DOCYAN sitio público v2 — HOME.
   Arco completo en miniatura: gancho (3 variantes de hero + demo vivo)
   → el momento → anaquel→FLOW → 3 pasos → foso → confianza → sectores → dos puertas. */

function HeroA() {
  const t = useT();
  const linkOut = useLinkOut();
  return /*#__PURE__*/React.createElement("header", {
    className: "hero2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hero-grid"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "eyebrow"
  }, "DOCYAN LDE \xB7 Live Document Environment"), /*#__PURE__*/React.createElement("h1", null, t({
    es: "El dato está en tus documentos. Ahora también está a una pregunta.",
    en: "The answer is in your documents. Now it's also one question away."
  })), /*#__PURE__*/React.createElement("p", {
    className: "sub"
  }, t({
    es: "Tus manuales, fichas y procedimientos, consultables al instante frente al equipo — con la respuesta lista para leerse de un vistazo y la cita al documento original.",
    en: "Your manuals, datasheets and procedures, instantly consultable at the machine — with the answer readable at a glance and a citation to the original document."
  })), /*#__PURE__*/React.createElement("div", {
    className: "cta"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn primary lg",
    onClick: () => linkOut("/signup")
  }, t({
    es: "Pruébalo gratis — 3 documentos",
    en: "Try it free — 3 documents"
  }), /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-right",
    size: 16
  })), /*#__PURE__*/React.createElement("button", {
    className: "btn sec lg",
    onClick: () => linkOut("/codigo")
  }, t({
    es: "Agendar demo",
    en: "Book a demo"
  }))), /*#__PURE__*/React.createElement("p", {
    className: "cta-note"
  }, t({
    es: "Sin tarjeta · 30 días · todas las capacidades",
    en: "No card · 30 days · all capabilities"
  })), /*#__PURE__*/React.createElement("div", {
    className: "hero-trust"
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(Icon, {
    name: "quote",
    size: 14
  }), t({
    es: "Cita trazable a la fuente",
    en: "Citation traceable to source"
  })), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(Icon, {
    name: "shield-check",
    size: 14
  }), t({
    es: "Sin alucinaciones",
    en: "No hallucinations"
  })), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(Icon, {
    name: "hash",
    size: 14
  }), "SHA-256"))), /*#__PURE__*/React.createElement(LiveDemo, null))));
}
function HeroB() {
  const t = useT();
  const linkOut = useLinkOut();
  return /*#__PURE__*/React.createElement("header", {
    className: "hero2 heroB"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("p", {
    className: "bq"
  }, t({
    es: "«¿Cuál es el torque de apriete?» — y el manual tiene 80 páginas.",
    en: "“What's the torque spec?” — and the manual is 80 pages long."
  })), /*#__PURE__*/React.createElement("h1", null, t({
    es: "Deja de buscar dónde está. Pregunta qué necesitas.",
    en: "Stop searching for where it is. Ask for what you need."
  })), /*#__PURE__*/React.createElement("p", {
    className: "sub"
  }, t({
    es: "DOCYAN convierte tus documentos en respuestas al instante, con la cita al original. Frente al equipo, en tu idioma.",
    en: "DOCYAN turns your documents into instant answers, citing the original. At the machine, in your language."
  })), /*#__PURE__*/React.createElement("div", {
    className: "cta"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn primary lg",
    onClick: () => linkOut("/signup")
  }, t({
    es: "Pruébalo gratis — 3 documentos",
    en: "Try it free — 3 documents"
  }), /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-right",
    size: 16
  })), /*#__PURE__*/React.createElement("button", {
    className: "btn sec lg",
    onClick: () => linkOut("/codigo")
  }, t({
    es: "Agendar demo",
    en: "Book a demo"
  }))), /*#__PURE__*/React.createElement("p", {
    className: "cta-note"
  }, t({
    es: "Sin tarjeta · 30 días · todas las capacidades",
    en: "No card · 30 days · all capabilities"
  })), /*#__PURE__*/React.createElement("div", {
    className: "heroB-demo"
  }, /*#__PURE__*/React.createElement(LiveDemo, null))));
}
function HeroC() {
  const t = useT();
  const linkOut = useLinkOut();
  return /*#__PURE__*/React.createElement("header", {
    className: "heroC"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "heroC-grid"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "eyebrow"
  }, "DOCYAN LDE \xB7 Live Document Environment"), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: "clamp(34px,6vw,52px)",
      fontWeight: 700,
      letterSpacing: "-.025em",
      lineHeight: 1.06,
      margin: "14px 0 0",
      textWrap: "pretty"
    }
  }, t({
    es: "Estás frente al equipo. El reloj corre. El dato existe.",
    en: "You're at the machine. The clock is running. The answer exists."
  })), /*#__PURE__*/React.createElement("p", {
    className: "sub"
  }, t({
    es: "Hoy lo buscas en carpetas y manuales de 80 páginas, pellizcando la pantalla. Con DOCYAN lo preguntas — y llega con su cita al documento original.",
    en: "Today you dig through folders and 80-page manuals, pinching the screen. With DOCYAN you ask — and it arrives with a citation to the original document."
  })), /*#__PURE__*/React.createElement("div", {
    className: "cta"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn primary lg",
    onClick: () => linkOut("/signup")
  }, t({
    es: "Pruébalo gratis — 3 documentos",
    en: "Try it free — 3 documents"
  }), /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-right",
    size: 16
  })), /*#__PURE__*/React.createElement("button", {
    className: "btn onink lg",
    onClick: () => linkOut("/codigo")
  }, t({
    es: "Agendar demo",
    en: "Book a demo"
  }))), /*#__PURE__*/React.createElement("p", {
    className: "cta-note",
    style: {
      color: "var(--stone-400)"
    }
  }, t({
    es: "Sin tarjeta · 30 días · todas las capacidades",
    en: "No card · 30 days · all capabilities"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      paddingBottom: 48
    }
  }, /*#__PURE__*/React.createElement(LiveDemo, null)))));
}

/* ---- Capa 1: el momento ---- */
const SCENES_HOME = [{
  sector: {
    es: "Maquila · termoformado",
    en: "Maquila · thermoforming"
  },
  quote: {
    es: "«La línea parada y el parámetro de temperatura está… ¿en cuál de los tres manuales?»",
    en: "“Line down, and the temperature parameter is… in which of the three manuals?”"
  },
  cost: {
    es: "Cada minuto de paro se factura solo.",
    en: "Every minute of downtime bills itself."
  },
  tag: {
    es: "foto: piso de termoformado",
    en: "photo: thermoforming floor"
  }
}, {
  sector: {
    es: "Flotillas · gasoductos / telecom",
    en: "Fleets · pipelines / telecom"
  },
  quote: {
    es: "«El técnico está a 200 km, con una barra de señal, y el procedimiento vive en el servidor de la oficina.»",
    en: "“The tech is 200 km out, one bar of signal, and the procedure lives on the office server.”"
  },
  cost: {
    es: "La visita se repite. El cliente espera.",
    en: "The visit gets repeated. The client waits."
  },
  tag: {
    es: "foto: técnico en campo",
    en: "photo: field technician"
  }
}, {
  sector: {
    es: "Laboratorio · ISO 17025",
    en: "Laboratory · ISO 17025"
  },
  quote: {
    es: "«La calibración venció y nadie lo vio a tiempo.»",
    en: "“The calibration expired and nobody caught it in time.”"
  },
  cost: {
    es: "Un hallazgo en auditoría que era evitable.",
    en: "An audit finding that was avoidable."
  },
  tag: {
    es: "foto: mesa de laboratorio",
    en: "photo: laboratory bench"
  }
}];
function MomentSection() {
  const t = useT();
  return /*#__PURE__*/React.createElement("section", {
    className: "band",
    "data-screen-label": "Home \u2014 El momento"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("span", {
    className: "eyebrow"
  }, t({
    es: "El momento",
    en: "The moment"
  })), /*#__PURE__*/React.createElement("h2", {
    className: "sec-title"
  }, t({
    es: "Todos hemos vivido esta escena",
    en: "We've all lived this scene"
  })), /*#__PURE__*/React.createElement("p", {
    className: "sec-lead"
  }, t({
    es: "El dato existe — está en un manual, una ficha, un procedimiento. Pero entre tú y el dato hay carpetas, versiones y 80 páginas en una pantalla de 6 pulgadas.",
    en: "The answer exists — in a manual, a datasheet, a procedure. But between you and it there are folders, versions, and 80 pages on a 6-inch screen."
  })), /*#__PURE__*/React.createElement("div", {
    className: "scenes"
  }, SCENES_HOME.map((s, i) => /*#__PURE__*/React.createElement("article", {
    className: "scene-card",
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    className: "ph"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ph-tag"
  }, t(s.tag))), /*#__PURE__*/React.createElement("div", {
    className: "sc-body"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sc-sector"
  }, t(s.sector)), /*#__PURE__*/React.createElement("p", {
    className: "sc-quote"
  }, t(s.quote)), /*#__PURE__*/React.createElement("span", {
    className: "sc-cost"
  }, t(s.cost)))))), /*#__PURE__*/React.createElement("p", {
    className: "momento-close"
  }, t({
    es: "El costo nunca es el documento. Es el tiempo muerto, la decisión a ciegas, o esperar a «quien sabe».",
    en: "The cost is never the document. It's the downtime, the blind decision, or waiting for “the one who knows.”"
  }))));
}

/* ---- Capa 2: anaquel → FLOW ---- */
function ParadigmSection() {
  const t = useT();
  return /*#__PURE__*/React.createElement("section", {
    className: "band paper",
    "data-screen-label": "Home \u2014 Anaquel a FLOW"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("span", {
    className: "eyebrow"
  }, t({
    es: "El cambio de categoría",
    en: "The category shift"
  })), /*#__PURE__*/React.createElement("h2", {
    className: "sec-title"
  }, t({
    es: "Del anaquel al flujo",
    en: "From the shelf to the flow"
  })), /*#__PURE__*/React.createElement("div", {
    className: "paradigm"
  }, /*#__PURE__*/React.createElement("div", {
    className: "par-card shelf"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pc-lab"
  }, t({
    es: "Modelo anaquel — hoy",
    en: "Shelf model — today"
  })), /*#__PURE__*/React.createElement("h3", null, t({
    es: "Tú vas al dato",
    en: "You go to the data"
  })), /*#__PURE__*/React.createElement("p", null, t({
    es: "Tienes que saber qué archivo, qué carpeta, qué página. El conocimiento está inmóvil; el esfuerzo es tuyo.",
    en: "You have to know which file, which folder, which page. The knowledge sits still; the effort is yours."
  })), /*#__PURE__*/React.createElement("ul", {
    className: "par-list"
  }, /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement(Icon, {
    name: "folder-search",
    size: 15
  }), t({
    es: "Navegar carpetas y versiones",
    en: "Navigate folders and versions"
  })), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement(Icon, {
    name: "zoom-in",
    size: 15
  }), t({
    es: "Pellizcar el PDF de 80 páginas",
    en: "Pinch through the 80-page PDF"
  })), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement(Icon, {
    name: "clock",
    size: 15
  }), t({
    es: "Perder el momento",
    en: "Lose the moment"
  })))), /*#__PURE__*/React.createElement("div", {
    className: "par-arrow"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-right",
    size: 28
  })), /*#__PURE__*/React.createElement("div", {
    className: "par-card flow"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pc-lab"
  }, t({
    es: "Modelo FLOW — DOCYAN",
    en: "FLOW model — DOCYAN"
  })), /*#__PURE__*/React.createElement("h3", null, t({
    es: "El dato viene a ti",
    en: "The data comes to you"
  })), /*#__PURE__*/React.createElement("p", null, t({
    es: "Preguntas qué necesitas. La respuesta llega presentada para leerse de un vistazo, con su fuente.",
    en: "You ask for what you need. The answer arrives ready to read at a glance, with its source."
  })), /*#__PURE__*/React.createElement("ul", {
    className: "par-list"
  }, /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement(Icon, {
    name: "message-circle",
    size: 15
  }), t({
    es: "Preguntas en tu idioma",
    en: "Ask in your language"
  })), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement(Icon, {
    name: "quote",
    size: 15
  }), t({
    es: "Respuesta con cita al original",
    en: "Answer cited to the original"
  })), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement(Icon, {
    name: "zap",
    size: 15
  }), t({
    es: "Sin perder el momento",
    en: "Without losing the moment"
  }))))), /*#__PURE__*/React.createElement("p", {
    className: "momento-close",
    style: {
      marginTop: 32
    }
  }, t({
    es: "No es un buscador mejor. Es un entorno de documentos analizados en vivo — otra categoría.",
    en: "Not a better search box. A live document environment — a different category."
  }))));
}

/* ---- 3 pasos ---- */
function StepsSection({
  go
}) {
  const t = useT();
  return /*#__PURE__*/React.createElement("section", {
    className: "band",
    "data-screen-label": "Home \u2014 C\xF3mo funciona (resumen)"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("span", {
    className: "eyebrow"
  }, t({
    es: "Cómo funciona",
    en: "How it works"
  })), /*#__PURE__*/React.createElement("h2", {
    className: "sec-title"
  }, t({
    es: "Tres pasos, sin caja negra",
    en: "Three steps, no black box"
  })), /*#__PURE__*/React.createElement("div", {
    className: "steps3"
  }, [{
    n: "01",
    ic: "upload",
    h: {
      es: "Sube tus documentos",
      en: "Upload your documents"
    },
    p: {
      es: "Manuales, fichas, MSDS, procedimientos. DOCYAN los analiza y los vuelve documentos vivos.",
      en: "Manuals, datasheets, MSDS, procedures. DOCYAN analyzes them and makes them live documents."
    }
  }, {
    n: "02",
    ic: "message-circle-question",
    h: {
      es: "Tu gente pregunta",
      en: "Your people ask"
    },
    p: {
      es: "En su idioma, desde el punto de uso. La respuesta llega renderizada para leerse de un vistazo.",
      en: "In their language, at the point of use. The answer arrives rendered to be read at a glance."
    }
  }, {
    n: "03",
    ic: "quote",
    h: {
      es: "Cada respuesta trae su fuente",
      en: "Every answer carries its source"
    },
    p: {
      es: "Cita clickeable al span exacto del documento original. Si DOCYAN no lo sabe, lo dice.",
      en: "A clickable citation to the exact span of the original document. If DOCYAN doesn't know, it says so."
    }
  }].map(s => /*#__PURE__*/React.createElement("div", {
    className: "step3",
    key: s.n
  }, /*#__PURE__*/React.createElement("span", {
    className: "n"
  }, s.n), /*#__PURE__*/React.createElement("span", {
    className: "si"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: s.ic,
    size: 22
  })), /*#__PURE__*/React.createElement("h3", null, t(s.h)), /*#__PURE__*/React.createElement("p", null, t(s.p))))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 26
    }
  }, /*#__PURE__*/React.createElement("a", {
    className: "vlink",
    onClick: () => go("como")
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "git-branch",
    size: 14
  }), t({
    es: "Ver la arquitectura completa — sin caja negra",
    en: "See the full architecture — no black box"
  })))));
}

/* ---- Capa 3: confianza ---- */
function TrustSection() {
  const t = useT();
  return /*#__PURE__*/React.createElement("section", {
    className: "band paper",
    "data-screen-label": "Home \u2014 Confianza"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("span", {
    className: "eyebrow"
  }, t({
    es: "La garantía",
    en: "The guarantee"
  })), /*#__PURE__*/React.createElement("h2", {
    className: "sec-title"
  }, t({
    es: "Pregunta en tu idioma. La fuente sigue siendo la fuente.",
    en: "Ask in your language. The source stays the source."
  })), /*#__PURE__*/React.createElement("div", {
    className: "trust2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "trust-pts"
  }, /*#__PURE__*/React.createElement("div", {
    className: "trust-pt"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ti"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "languages",
    size: 19
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", null, t({
    es: "Consulta multilingüe con cita al original",
    en: "Multilingual consultation, cited to the original"
  })), /*#__PURE__*/React.createElement("p", null, t({
    es: "El manual vino en inglés o alemán; tu operador pregunta en español y recibe la respuesta en español — con el fragmento original real a un toque.",
    en: "The manual came in German or Spanish; your operator asks in English and gets the answer in English — with the real original fragment one tap away."
  })))), /*#__PURE__*/React.createElement("div", {
    className: "trust-pt"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ti"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "shield-check",
    size: 19
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", null, t({
    es: "Freno de alucinación",
    en: "Hallucination brake"
  })), /*#__PURE__*/React.createElement("p", null, t({
    es: "Pedigree a span y umbrales por criticidad: si la confianza no alcanza, DOCYAN no inventa — te muestra dónde buscar.",
    en: "Span-level pedigree and criticality thresholds: if confidence falls short, DOCYAN doesn't invent — it shows you where to look."
  })))), /*#__PURE__*/React.createElement("div", {
    className: "trust-pt"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ti"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "hash",
    size: 19
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", null, t({
    es: "Cadena de integridad SHA-256",
    en: "SHA-256 integrity chain"
  })), /*#__PURE__*/React.createElement("p", null, t({
    es: "Cada documento y cada respuesta quedan ligados criptográficamente a su fuente. Auditable de punta a punta.",
    en: "Every document and every answer is cryptographically tied to its source. Auditable end to end."
  }))))), /*#__PURE__*/React.createElement("div", {
    className: "unsafe",
    style: {
      marginTop: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "alert-triangle",
    size: 20
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", null, t({
    es: "Tu gente ya le pregunta a una IA. Sin fuente.",
    en: "Your people already ask an AI. Without a source."
  })), /*#__PURE__*/React.createElement("p", null, t({
    es: "Hoy suben fichas y manuales a herramientas de IA genéricas para «entenderlos»: sin cita, sin trazabilidad, copiando datos regulados fuera de tu control — y la IA inventa. DOCYAN es ese mismo gesto natural, vuelto seguro: citado, trazable y dentro de tu entorno.",
    en: "Today they upload datasheets and manuals to generic AI tools to “make sense of them”: no citation, no traceability, regulated data copied outside your control — and the AI invents. DOCYAN is that same natural gesture, made safe: cited, traceable, inside your environment."
  })))))));
}

/* ---- Capa 4: el foso ---- */
function MoatSection() {
  const t = useT();
  return /*#__PURE__*/React.createElement("section", {
    className: "band ink",
    "data-screen-label": "Home \u2014 El foso"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("span", {
    className: "eyebrow"
  }, t({
    es: "Y además",
    en: "And then"
  })), /*#__PURE__*/React.createElement("h2", {
    className: "sec-title"
  }, t({
    es: "Cada pregunta teje el saber de tu organización",
    en: "Every question weaves your organization's knowledge"
  })), /*#__PURE__*/React.createElement("p", {
    className: "sec-lead"
  }, t({
    es: "Cuando el experto se va, su forma de resolver ya no se va con él. DOCYAN muestra qué se pregunta mucho y qué no está bien cubierto por tu documentación.",
    en: "When the expert leaves, their way of solving things no longer leaves with them. DOCYAN shows what gets asked a lot and what your documentation doesn't cover well."
  })), /*#__PURE__*/React.createElement("div", {
    className: "levels2"
  }, [{
    n: "1",
    lv: {
      es: "Consulta",
      en: "Consultation"
    },
    h: {
      es: "El dato, al instante",
      en: "The data, instantly"
    },
    p: {
      es: "Respuestas citadas en el punto de uso. El gancho que se siente el primer día.",
      en: "Cited answers at the point of use. The hook you feel on day one."
    },
    ex: {
      es: "«¿Límite OSHA de la acetona?» → 1,000 ppm, citado.",
      en: "“OSHA limit for acetone?” → 1,000 ppm, cited."
    }
  }, {
    n: "2",
    lv: {
      es: "Patrón",
      en: "Pattern"
    },
    h: {
      es: "Lo que tu gente pregunta",
      en: "What your people ask"
    },
    p: {
      es: "Las consultas dibujan dónde está la fricción: qué documento se consulta más, qué turno pregunta qué.",
      en: "Queries map the friction: which document gets consulted most, which shift asks what."
    },
    ex: {
      es: "El 40% de las consultas del turno B son sobre una sola máquina.",
      en: "40% of shift B's queries concern a single machine."
    }
  }, {
    n: "3",
    lv: {
      es: "Cobertura",
      en: "Coverage"
    },
    h: {
      es: "Lo que falta documentar",
      en: "What's missing"
    },
    p: {
      es: "DOCYAN señala preguntas sin buena respuesta en tus documentos — el mapa de tu conocimiento tácito en fuga.",
      en: "DOCYAN flags questions your documents can't answer well — the map of your tacit knowledge leak."
    },
    ex: {
      es: "12 preguntas recurrentes sin fuente: candidatas a documentarse.",
      en: "12 recurring questions with no source: candidates for documentation."
    }
  }].map(l => /*#__PURE__*/React.createElement("div", {
    className: "level2",
    key: l.n
  }, /*#__PURE__*/React.createElement("span", {
    className: "lv"
  }, /*#__PURE__*/React.createElement("span", {
    className: "n"
  }, l.n), t(l.lv)), /*#__PURE__*/React.createElement("h3", null, t(l.h)), /*#__PURE__*/React.createElement("p", null, t(l.p)), /*#__PURE__*/React.createElement("span", {
    className: "ex"
  }, /*#__PURE__*/React.createElement("b", null, t({
    es: "Ejemplo — ",
    en: "Example — "
  })), t(l.ex))))), /*#__PURE__*/React.createElement("p", {
    className: "momento-close",
    style: {
      color: "var(--amate-300)"
    }
  }, t({
    es: "DOCYAN cuenta, no concluye: reporta frecuencia y patrón. Diagnosticar causas sigue siendo tuyo.",
    en: "DOCYAN counts, it doesn't conclude: it reports frequency and pattern. Diagnosing causes remains yours."
  }))));
}

/* ---- sectores ---- */
function SectorsSection({
  go
}) {
  const t = useT();
  return /*#__PURE__*/React.createElement("section", {
    className: "band",
    "data-screen-label": "Home \u2014 Sectores"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("span", {
    className: "eyebrow"
  }, t({
    es: "Sectores",
    en: "Industries"
  })), /*#__PURE__*/React.createElement("h2", {
    className: "sec-title"
  }, t({
    es: "El mismo trabajo técnico, siete escenas",
    en: "The same technical work, seven scenes"
  })), /*#__PURE__*/React.createElement("p", {
    className: "sec-lead"
  }, t({
    es: "Trabajo regido por documentos, errores que cuestan, punto de uso lejos de la oficina. Si te reconoces, DOCYAN es para tu operación.",
    en: "Work governed by documents, errors that cost, a point of use far from the office. If you recognize yourself, DOCYAN is for your operation."
  })), /*#__PURE__*/React.createElement(VertGrid, {
    go: go,
    limit: 6
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 24
    }
  }, /*#__PURE__*/React.createElement("a", {
    className: "vlink",
    onClick: () => go("verticales")
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "layout-grid",
    size: 14
  }), t({
    es: "Ver todos los sectores",
    en: "See all industries"
  })))));
}

/* ---- CTA final ---- */
function HomeCTA() {
  const t = useT();
  return /*#__PURE__*/React.createElement("section", {
    className: "band paper",
    "data-screen-label": "Home \u2014 CTA final"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cta-band"
  }, /*#__PURE__*/React.createElement("span", {
    className: "eyebrow"
  }, t({
    es: "Empezar",
    en: "Get started"
  })), /*#__PURE__*/React.createElement("h2", {
    className: "sec-title"
  }, t({
    es: "Vive el producto antes de decidir",
    en: "Live the product before you decide"
  }))), /*#__PURE__*/React.createElement(Doors, null)));
}
function HomePage({
  go,
  heroVariant
}) {
  return /*#__PURE__*/React.createElement("main", {
    "data-screen-label": "Home"
  }, heroVariant === "B" ? /*#__PURE__*/React.createElement(HeroB, null) : heroVariant === "C" ? /*#__PURE__*/React.createElement(HeroC, null) : /*#__PURE__*/React.createElement(HeroA, null), /*#__PURE__*/React.createElement(MomentSection, null), /*#__PURE__*/React.createElement(ParadigmSection, null), /*#__PURE__*/React.createElement(StepsSection, {
    go: go
  }), /*#__PURE__*/React.createElement(TrustSection, null), /*#__PURE__*/React.createElement(MoatSection, null), /*#__PURE__*/React.createElement(CodoBridge, {
    go: go
  }), /*#__PURE__*/React.createElement(SectorsSection, {
    go: go
  }), /*#__PURE__*/React.createElement(HomeCTA, null));
}
Object.assign(window, {
  HomePage
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/commercial-v2/home.jsx", error: String((e && e.message) || e) }); }

// ui_kits/commercial-v2/precios.jsx
try { (() => {
/* DOCYAN sitio público v2 — PRECIOS v2.1.
   Fuente única: línea de producto (DOCYAN hoy · Data · Field próximamente)
   + 3 tiers por documentos vivos + ingestas incluidas + dos puertas. */

function PreciosPage({
  go
}) {
  const t = useT();
  const {
    band
  } = useBand();
  const linkOut = useLinkOut();
  const b = BANDS[band];
  const TIERS = [{
    key: "esencial",
    name: "Esencial",
    docs: {
      es: "hasta 50 documentos vivos",
      en: "up to 50 live documents"
    },
    price: b.tiers.esencial,
    from: false,
    ing: {
      es: "Incluye 10 documentos de arranque + 3 al mes",
      en: "Includes 10 starter documents + 3 per month"
    },
    feats: [{
      es: "Todas las capacidades del producto",
      en: "Every product capability"
    }, {
      es: "Usuarios ilimitados",
      en: "Unlimited users"
    }, {
      es: "Consulta multilingüe con cita al original",
      en: "Multilingual consultation, cited to the original"
    }],
    cta: {
      es: "Empezar con Esencial",
      en: "Start with Esencial"
    },
    rec: false
  }, {
    key: "profesional",
    name: "Profesional",
    docs: {
      es: "hasta 300 documentos vivos",
      en: "up to 300 live documents"
    },
    price: b.tiers.profesional,
    from: false,
    ing: {
      es: "Incluye 30 documentos de arranque + 10 al mes",
      en: "Includes 30 starter documents + 10 per month"
    },
    feats: [{
      es: "Todo lo de Esencial",
      en: "Everything in Esencial"
    }, {
      es: "Inteligencia organizacional (frecuencia y cobertura)",
      en: "Organizational intelligence (frequency & coverage)"
    }, {
      es: "Soporte prioritario",
      en: "Priority support"
    }],
    cta: {
      es: "Empezar con Profesional",
      en: "Start with Profesional"
    },
    rec: true
  }, {
    key: "enterprise",
    name: "Enterprise",
    docs: {
      es: "300+ · a la medida",
      en: "300+ · tailored"
    },
    price: b.tiers.enterprise,
    from: true,
    ing: {
      es: "Documentos de arranque y cupo mensual negociados",
      en: "Starter documents and monthly quota negotiated"
    },
    feats: [{
      es: "Todo lo de Profesional",
      en: "Everything in Profesional"
    }, {
      es: "On-premise / jurisdicción dedicada",
      en: "On-premise / dedicated jurisdiction"
    }, {
      es: "Acompañamiento de implementación",
      en: "Implementation support"
    }],
    cta: {
      es: "Hablar con nosotros",
      en: "Talk to us"
    },
    rec: false
  }];
  return /*#__PURE__*/React.createElement("main", {
    "data-screen-label": "Precios"
  }, /*#__PURE__*/React.createElement("header", {
    className: "pr-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("span", {
    className: "eyebrow"
  }, t({
    es: "Precios",
    en: "Pricing"
  })), /*#__PURE__*/React.createElement("h1", null, t({
    es: "Dos decisiones simples. Nada más.",
    en: "Two simple decisions. Nothing else."
  })), /*#__PURE__*/React.createElement("p", {
    className: "sec-lead"
  }, t({
    es: "Qué producto y de qué tamaño. Por documentos vivos, no por usuarios — todas las capacidades en todos los planes, sin add-ons.",
    en: "Which product, and what size. Priced by live documents, not by users — every capability in every plan, no add-ons."
  })))), /*#__PURE__*/React.createElement("section", {
    className: "band",
    style: {
      paddingTop: 12
    },
    "data-screen-label": "Precios \u2014 L\xEDnea y tiers"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "prodline"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pl-card on"
  }, /*#__PURE__*/React.createElement("h3", null, "DOCYAN ", /*#__PURE__*/React.createElement("span", {
    className: "now-tag"
  }, t({
    es: "Disponible hoy",
    en: "Available today"
  }))), /*#__PURE__*/React.createElement("p", null, t({
    es: "El entorno de documentos analizados en vivo. Lo que estás viendo en este sitio.",
    en: "The live document environment. What this site shows."
  }))), /*#__PURE__*/React.createElement("div", {
    className: "pl-card soon"
  }, /*#__PURE__*/React.createElement("h3", null, "DOCYAN Data ", /*#__PURE__*/React.createElement("span", {
    className: "soon-tag"
  }, t({
    es: "Próximamente",
    en: "Coming soon"
  }))), /*#__PURE__*/React.createElement("p", null, t({
    es: "Inteligencia organizacional ampliada sobre tu corpus.",
    en: "Expanded organizational intelligence over your corpus."
  }))), /*#__PURE__*/React.createElement("div", {
    className: "pl-card soon"
  }, /*#__PURE__*/React.createElement("h3", null, "DOCYAN Field ", /*#__PURE__*/React.createElement("span", {
    className: "soon-tag"
  }, t({
    es: "Próximamente",
    en: "Coming soon"
  }))), /*#__PURE__*/React.createElement("p", null, t({
    es: "Operación de campo con conectividad intermitente como caso primario.",
    en: "Field operation with intermittent connectivity as the primary case."
  })))), /*#__PURE__*/React.createElement("div", {
    className: "band-bar"
  }, /*#__PURE__*/React.createElement(GeoCtl, {
    showLang: false
  }), /*#__PURE__*/React.createElement("span", {
    className: "band-note"
  }, t({
    es: "Precios en USD por organización, al mes. Banda según tu región — ajústala si hace falta.",
    en: "USD pricing per organization, monthly. Band set by your region — adjust if needed."
  }))), /*#__PURE__*/React.createElement("div", {
    className: "tiers",
    "data-comment-anchor": "tabla-precios"
  }, TIERS.map(tier => /*#__PURE__*/React.createElement("div", {
    className: "tier" + (tier.rec ? " rec" : ""),
    key: tier.key
  }, tier.rec && /*#__PURE__*/React.createElement("span", {
    className: "rec-tag"
  }, t({
    es: "Más elegido",
    en: "Most chosen"
  })), /*#__PURE__*/React.createElement("span", {
    className: "tn"
  }, tier.name), /*#__PURE__*/React.createElement("span", {
    className: "tdocs"
  }, t(tier.docs)), /*#__PURE__*/React.createElement("div", {
    className: "tp"
  }, tier.from && /*#__PURE__*/React.createElement("span", {
    className: "per"
  }, t({
    es: "desde",
    en: "from"
  })), /*#__PURE__*/React.createElement("span", {
    className: "amt"
  }, fmtUSD(tier.price)), /*#__PURE__*/React.createElement("span", {
    className: "per"
  }, "USD / ", t({
    es: "mes",
    en: "mo"
  }))), /*#__PURE__*/React.createElement("span", {
    className: "tband"
  }, t({
    es: "Banda",
    en: "Band"
  }), " ", b.key, " \xB7 ", t(b.regions)), /*#__PURE__*/React.createElement("ul", {
    className: "tfeat"
  }, /*#__PURE__*/React.createElement("li", {
    className: "ing"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "file-plus-2",
    size: 16
  }), t(tier.ing)), tier.feats.map((f, i) => /*#__PURE__*/React.createElement("li", {
    key: i
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 16
  }), t(f)))), /*#__PURE__*/React.createElement("button", {
    className: "btn lg " + (tier.rec ? "primary" : "sec"),
    onClick: () => linkOut(tier.key === "enterprise" ? "/codigo" : "/signup")
  }, t(tier.cta))))), /*#__PURE__*/React.createElement("p", {
    className: "all-feats"
  }, t({
    es: "Los tres planes consultan igual de bien. La diferencia es cuántos documentos viven en tu entorno.",
    en: "All three plans consult equally well. The difference is how many documents live in your environment."
  })), /*#__PURE__*/React.createElement("div", {
    className: "ingest",
    "data-comment-anchor": "ingestas-incluidas"
  }, /*#__PURE__*/React.createElement("span", {
    className: "eyebrow"
  }, t({
    es: "Ingestas incluidas",
    en: "Included ingestions"
  })), /*#__PURE__*/React.createElement("h2", null, t({
    es: "Cada plan incluye documentos listos para consultar",
    en: "Every plan includes documents ready to consult"
  })), /*#__PURE__*/React.createElement("p", null, t({
    es: "Subir un documento a DOCYAN no es «subir un archivo»: es analizarlo en vivo hasta dejarlo consultable con cita. Cada plan incluye un arranque generoso y un cupo mensual para crecer a tu ritmo.",
    en: "Adding a document to DOCYAN isn't “uploading a file”: it's analyzing it live until it's consultable with citations. Every plan includes a generous start and a monthly quota to grow at your pace."
  })), /*#__PURE__*/React.createElement("div", {
    className: "ingest-rows"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ingest-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ir-t"
  }, "Esencial"), /*#__PURE__*/React.createElement("span", {
    className: "ir-v"
  }, t({
    es: "10 iniciales + 3/mes",
    en: "10 starters + 3/mo"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "ingest-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ir-t"
  }, "Profesional"), /*#__PURE__*/React.createElement("span", {
    className: "ir-v"
  }, t({
    es: "30 iniciales + 10/mes",
    en: "30 starters + 10/mo"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "ingest-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ir-t"
  }, "Enterprise"), /*#__PURE__*/React.createElement("span", {
    className: "ir-v"
  }, t({
    es: "Negociado a tu corpus",
    en: "Negotiated to your corpus"
  })))), /*#__PURE__*/React.createElement("div", {
    className: "ingest-note"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "badge-check",
    size: 15
  }), /*#__PURE__*/React.createElement("span", null, t({
    es: "¿Necesitas más? Documentos adicionales desde $15 USD, cotizados de forma transparente antes de confirmar. Tú decides el ritmo.",
    en: "Need more? Additional documents from $15 USD, quoted transparently before you confirm. You set the pace."
  })))))), /*#__PURE__*/React.createElement("section", {
    className: "band paper",
    "data-screen-label": "Precios \u2014 Puertas"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cta-band"
  }, /*#__PURE__*/React.createElement("span", {
    className: "eyebrow"
  }, t({
    es: "¿No estás listo para elegir?",
    en: "Not ready to choose?"
  })), /*#__PURE__*/React.createElement("h2", {
    className: "sec-title"
  }, t({
    es: "No elijas todavía. Vive el producto.",
    en: "Don't choose yet. Live the product."
  }))), /*#__PURE__*/React.createElement(Doors, null), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 26,
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("a", {
    className: "vlink",
    onClick: () => go("seguridad")
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "shield",
    size: 14
  }), t({
    es: "¿Compras necesita el detalle de seguridad?",
    en: "Does procurement need the security detail?"
  }))))));
}
Object.assign(window, {
  PreciosPage
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/commercial-v2/precios.jsx", error: String((e && e.message) || e) }); }

// ui_kits/commercial-v2/producto.jsx
try { (() => {
/* DOCYAN sitio público v2 — PRODUCTO.
   La narrativa de significado: híbrido editorial (capas 1-2 en prosa)
   → módulos de producto (capas 3-4) → dos puertas. NO duplica la home. */

function ProductoPage({
  go
}) {
  const t = useT();
  const linkOut = useLinkOut();
  return /*#__PURE__*/React.createElement("main", {
    "data-screen-label": "Producto"
  }, /*#__PURE__*/React.createElement("header", {
    className: "prod-hero"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap narrow"
  }, /*#__PURE__*/React.createElement("span", {
    className: "eyebrow"
  }, t({
    es: "Producto · qué es DOCYAN",
    en: "Product · what DOCYAN is"
  })), /*#__PURE__*/React.createElement("h1", null, t({
    es: "Un entorno donde tus documentos están vivos",
    en: "An environment where your documents are alive"
  })), /*#__PURE__*/React.createElement("p", {
    className: "prod-lede"
  }, t({
    es: "DOCYAN LDE convierte los documentos de tu organización en conocimiento consultable al instante — donde se necesita, por quien lo necesita, con cita al original. Esta página cuenta por qué eso cambia la categoría, no solo la herramienta.",
    en: "DOCYAN LDE turns your organization's documents into knowledge you can consult instantly — where it's needed, by whoever needs it, cited to the original. This page tells why that changes the category, not just the tool."
  })))), /*#__PURE__*/React.createElement("section", {
    className: "band",
    "data-screen-label": "Producto \u2014 Cap. 1 El momento"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap narrow"
  }, /*#__PURE__*/React.createElement("div", {
    className: "chapter"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ch-n"
  }, "01"), /*#__PURE__*/React.createElement("span", {
    className: "ch-t"
  }, t({
    es: "El momento",
    en: "The moment"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "prose"
  }, /*#__PURE__*/React.createElement("p", null, t({
    es: "Son las 6:40 de la mañana y la termoformadora marca una alarma que el turno de noche no supo apagar. El parámetro correcto existe: está en el manual del fabricante, en algún lugar entre la página 40 y la 120. El ingeniero lo sabe. También sabe que la línea pierde dinero por minuto.",
    en: "It's 6:40 a.m. and the thermoformer shows an alarm the night shift couldn't clear. The right parameter exists: it's in the manufacturer's manual, somewhere between page 40 and page 120. The engineer knows this. He also knows the line loses money by the minute."
  })), /*#__PURE__*/React.createElement("p", null, t({
    es: "La misma escena, con otros nombres: el técnico de gasoducto a 200 km de la oficina con una barra de señal. La cuadrilla de minería esperando «al que sabe». El frente de obra detenido por una especificación. La plataforma marina donde no hay segunda oportunidad. El piso agroindustrial a media cosecha. El laboratorio donde la calibración venció y nadie lo vio a tiempo.",
    en: "The same scene, with other names: the pipeline technician 200 km from the office with one bar of signal. The mining crew waiting for “the one who knows.” The road crew halted by a specification. The offshore platform where there is no second chance. The agroindustrial floor mid-harvest. The laboratory where the calibration expired and nobody caught it in time."
  })), /*#__PURE__*/React.createElement("p", {
    className: "pull"
  }, t({
    es: "El dato existe. Lo que no existe es el camino corto entre el dato y la persona que lo necesita, en el momento en que lo necesita.",
    en: "The data exists. What doesn't exist is the short path between the data and the person who needs it, at the moment they need it."
  })), /*#__PURE__*/React.createElement("p", null, t({
    es: "El costo nunca aparece en una factura con ese nombre. Aparece como tiempo muerto, como decisión tomada a ciegas, como visita repetida, como hallazgo de auditoría que era evitable.",
    en: "The cost never shows up on an invoice under that name. It shows up as downtime, as a decision made blind, as a repeated site visit, as an audit finding that was avoidable."
  }))))), /*#__PURE__*/React.createElement("section", {
    className: "band paper",
    "data-screen-label": "Producto \u2014 Cap. 2 El paradigma"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap narrow"
  }, /*#__PURE__*/React.createElement("div", {
    className: "chapter"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ch-n"
  }, "02"), /*#__PURE__*/React.createElement("span", {
    className: "ch-t"
  }, t({
    es: "El paradigma",
    en: "The paradigm"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "prose"
  }, /*#__PURE__*/React.createElement("p", null, t({
    es: "Durante décadas la respuesta fue ordenar mejor el anaquel: más carpetas, mejores nombres de archivo, un buscador encima. Pero el modelo no cambió — tú sigues yendo al dato, y para llegar tienes que saber qué archivo, qué versión, qué página.",
    en: "For decades the answer was to organize the shelf better: more folders, better file names, a search box on top. But the model never changed — you still go to the data, and to get there you must know which file, which version, which page."
  })), /*#__PURE__*/React.createElement("p", null, t({
    es: "Hubo un negocio que ordenaba películas en anaqueles, y lo hacía muy bien. No perdió contra un anaquel mejor ordenado: perdió contra el flujo — la película que viene a ti. Lo mismo le está pasando al documento técnico.",
    en: "There was a business that organized movies on shelves, and did it very well. It didn't lose to a better-organized shelf: it lost to the flow — the movie that comes to you. The same is happening to the technical document."
  })), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("b", null, t({
    es: "DOCYAN no es un buscador mejor. Es el cambio de categoría: un entorno de documentos analizados en vivo,",
    en: "DOCYAN is not a better search box. It is the category change: a live document environment,"
  })), " ", t({
    es: "donde preguntas qué necesitas y el dato viene a ti — renderizado para leerse de un vistazo, con su fuente.",
    en: "where you ask for what you need and the data comes to you — rendered to be read at a glance, with its source."
  })))), /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "paradigm"
  }, /*#__PURE__*/React.createElement("div", {
    className: "par-card shelf"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pc-lab"
  }, t({
    es: "Anaquel",
    en: "Shelf"
  })), /*#__PURE__*/React.createElement("h3", null, t({
    es: "«¿Dónde está?»",
    en: "“Where is it?”"
  })), /*#__PURE__*/React.createElement("p", null, t({
    es: "El conocimiento inmóvil. El esfuerzo, tuyo. El momento, perdido.",
    en: "Knowledge sits still. The effort is yours. The moment, lost."
  }))), /*#__PURE__*/React.createElement("div", {
    className: "par-arrow"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-right",
    size: 28
  })), /*#__PURE__*/React.createElement("div", {
    className: "par-card flow"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pc-lab"
  }, "FLOW"), /*#__PURE__*/React.createElement("h3", null, t({
    es: "«¿Qué necesito?»",
    en: "“What do I need?”"
  })), /*#__PURE__*/React.createElement("p", null, t({
    es: "Preguntas. El dato llega con su cita. El momento, intacto.",
    en: "You ask. The data arrives with its citation. The moment, intact."
  })))))), /*#__PURE__*/React.createElement("section", {
    className: "band",
    "data-screen-label": "Producto \u2014 Cap. 3 La garant\xEDa"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "chapter"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ch-n"
  }, "03"), /*#__PURE__*/React.createElement("span", {
    className: "ch-t"
  }, t({
    es: "La garantía",
    en: "The guarantee"
  }))), /*#__PURE__*/React.createElement("h2", {
    className: "sec-title"
  }, t({
    es: "En tu idioma, sin alucinaciones, con la fuente a un toque",
    en: "In your language, no hallucinations, the source one tap away"
  })), /*#__PURE__*/React.createElement("p", {
    className: "sec-lead"
  }, t({
    es: "Lo lingüístico en DOCYAN no es un producto aparte: es la garantía de que la consulta funciona para tu gente real, con sus documentos reales.",
    en: "Language in DOCYAN is not a separate product: it's the guarantee that consultation works for your real people, with their real documents."
  })), /*#__PURE__*/React.createElement("div", {
    className: "sec-grid2"
  }, [{
    ic: "languages",
    h: {
      es: "El manual vino en otro idioma. No importa.",
      en: "The manual came in another language. It doesn't matter."
    },
    p: {
      es: "Tu operador pregunta en español y recibe la respuesta en español — y a un toque, el fragmento original del documento, tal como vino. La fuente sigue siendo la fuente.",
      en: "Your operator asks in their language and gets the answer in their language — and one tap away, the original fragment of the document, exactly as it came. The source stays the source."
    }
  }, {
    ic: "shield-check",
    h: {
      es: "Freno de alucinación",
      en: "Hallucination brake"
    },
    p: {
      es: "Pedigree a span y umbrales por criticidad. Si la confianza no alcanza el umbral del dato, DOCYAN no responde con humo: te dice qué encontró y dónde seguir.",
      en: "Span-level pedigree and criticality thresholds. If confidence doesn't clear the data's threshold, DOCYAN doesn't answer with smoke: it tells you what it found and where to keep looking."
    }
  }, {
    ic: "quote",
    h: {
      es: "La cita es el producto",
      en: "The citation is the product"
    },
    p: {
      es: "Cada respuesta lleva su marca de cita al span exacto del original. No es una nota al pie decorativa: es el contrato de confianza de cada interacción.",
      en: "Every answer carries its citation mark to the exact span of the original. Not a decorative footnote: the trust contract of every interaction."
    }
  }, {
    ic: "hash",
    h: {
      es: "Cadena SHA-256",
      en: "SHA-256 chain"
    },
    p: {
      es: "Documento, análisis y respuesta quedan ligados criptográficamente. Cuando el auditor pregunte «¿de dónde salió esto?», hay una sola respuesta verificable.",
      en: "Document, analysis and answer are cryptographically linked. When the auditor asks “where did this come from?”, there is one verifiable answer."
    }
  }].map((x, i) => /*#__PURE__*/React.createElement("div", {
    className: "sec-item2",
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "ic"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: x.ic,
    size: 20
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", null, t(x.h)), /*#__PURE__*/React.createElement("p", null, t(x.p)))))), /*#__PURE__*/React.createElement("div", {
    className: "unsafe"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "alert-triangle",
    size: 20
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", null, t({
    es: "El acto inseguro que esto reemplaza",
    en: "The unsafe act this replaces"
  })), /*#__PURE__*/React.createElement("p", null, t({
    es: "Subir el MSDS a una IA genérica para «entenderlo» ya pasa en tu operación — sin fuente, sin trazabilidad, con datos regulados saliendo de tu control. DOCYAN conserva el gesto y le pone piso: citado, trazable, dentro de tu entorno.",
    en: "Uploading the MSDS to a generic AI to “make sense of it” already happens in your operation — no source, no traceability, regulated data leaving your control. DOCYAN keeps the gesture and gives it a floor: cited, traceable, inside your environment."
  })))))), /*#__PURE__*/React.createElement("section", {
    className: "band ink",
    "data-screen-label": "Producto \u2014 Cap. 4 El foso"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "chapter"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ch-n",
    style: {
      borderColor: "rgba(207,65,36,.5)"
    }
  }, "04"), /*#__PURE__*/React.createElement("span", {
    className: "ch-t",
    style: {
      color: "var(--stone-400)"
    }
  }, t({
    es: "El foso",
    en: "The moat"
  }))), /*#__PURE__*/React.createElement("h2", {
    className: "sec-title"
  }, t({
    es: "Lo que se queda cuando la gente se va",
    en: "What stays when people leave"
  })), /*#__PURE__*/React.createElement("div", {
    className: "trust2",
    style: {
      marginTop: 28
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "prose"
  }, /*#__PURE__*/React.createElement("p", null, t({
    es: "El gancho es la consulta. El foso se revela después: cada pregunta que hace tu gente teje, sin esfuerzo extra, el mapa del saber de tu organización — qué se consulta, qué se repite, qué no está cubierto.",
    en: "The hook is consultation. The moat reveals itself later: every question your people ask weaves, with no extra effort, the map of your organization's knowledge — what gets consulted, what repeats, what isn't covered."
  })), /*#__PURE__*/React.createElement("p", null, t({
    es: "La rotación deja de ser fuga: cuando el experto se va, su forma de resolver — las preguntas que hacía, los documentos que tocaba — ya quedó tejida en el entorno.",
    en: "Turnover stops being a leak: when the expert leaves, their way of solving — the questions they asked, the documents they touched — is already woven into the environment."
  })), /*#__PURE__*/React.createElement("p", {
    className: "pull",
    style: {
      borderColor: "var(--cinnabar-400)"
    }
  }, t({
    es: "DOCYAN cuenta, no concluye. Reporta frecuencia y patrón; el diagnóstico sigue siendo tuyo.",
    en: "DOCYAN counts, it doesn't conclude. It reports frequency and pattern; the diagnosis remains yours."
  }))), /*#__PURE__*/React.createElement("div", {
    className: "trust-pts"
  }, /*#__PURE__*/React.createElement("div", {
    className: "trust-pt"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ti"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "activity",
    size: 19
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", null, t({
    es: "Qué se pregunta mucho",
    en: "What gets asked a lot"
  })), /*#__PURE__*/React.createElement("p", null, t({
    es: "Frecuencia por documento, por equipo, por turno. La fricción de tu operación, visible.",
    en: "Frequency by document, by team, by shift. Your operation's friction, made visible."
  })))), /*#__PURE__*/React.createElement("div", {
    className: "trust-pt"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ti"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "file-question",
    size: 19
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", null, t({
    es: "Qué no cubre tu documentación",
    en: "What your documentation doesn't cover"
  })), /*#__PURE__*/React.createElement("p", null, t({
    es: "Preguntas recurrentes sin buena fuente: la lista de lo que conviene documentar antes de que se vaya quien lo sabe.",
    en: "Recurring questions with no good source: the list of what to document before the one who knows leaves."
  })))), /*#__PURE__*/React.createElement("div", {
    className: "trust-pt"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ti"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "users",
    size: 19
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", null, t({
    es: "El saber, de la organización",
    en: "Knowledge, the organization's"
  })), /*#__PURE__*/React.createElement("p", null, t({
    es: "No vive en la cabeza de una persona ni en una herramienta externa. Vive en tu entorno, citado y auditable.",
    en: "It doesn't live in one person's head or in an external tool. It lives in your environment, cited and auditable."
  })))))))), /*#__PURE__*/React.createElement("section", {
    className: "band",
    "data-screen-label": "Producto \u2014 Cierre"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cta-band"
  }, /*#__PURE__*/React.createElement("span", {
    className: "eyebrow"
  }, t({
    es: "El siguiente paso",
    en: "The next step"
  })), /*#__PURE__*/React.createElement("h2", {
    className: "sec-title"
  }, t({
    es: "La narrativa termina aquí. El producto empieza con 3 documentos.",
    en: "The narrative ends here. The product begins with 3 documents."
  }))), /*#__PURE__*/React.createElement(Doors, null), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 28,
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("a", {
    className: "vlink",
    onClick: () => go("como")
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "git-branch",
    size: 14
  }), t({
    es: "¿Eres de TI? Mira cómo funciona por dentro",
    en: "In IT? See how it works inside"
  }))))));
}
Object.assign(window, {
  ProductoPage
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/commercial-v2/producto.jsx", error: String((e && e.message) || e) }); }

// ui_kits/commercial-v2/seguridad.jsx
try { (() => {
/* DOCYAN sitio público v2 — SEGURIDAD.
   Confianza para industria regulada + sección "DOCYAN cuenta, no concluye". */

function SeguridadPage({
  go
}) {
  const t = useT();
  return /*#__PURE__*/React.createElement("main", {
    "data-screen-label": "Seguridad"
  }, /*#__PURE__*/React.createElement("header", {
    className: "page-hero"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("span", {
    className: "eyebrow"
  }, t({
    es: "Seguridad y gobernanza",
    en: "Security & governance"
  })), /*#__PURE__*/React.createElement("h1", null, t({
    es: "Construido para industria regulada",
    en: "Built for regulated industry"
  })), /*#__PURE__*/React.createElement("p", {
    className: "sec-lead"
  }, t({
    es: "Tus documentos son materia regulada y ventaja competitiva. DOCYAN los trata como ambas cosas: aislados por organización, íntegros por criptografía y gobernados por reglas explícitas.",
    en: "Your documents are regulated matter and competitive advantage. DOCYAN treats them as both: isolated per organization, cryptographically intact, and governed by explicit rules."
  })))), /*#__PURE__*/React.createElement("section", {
    className: "band",
    "data-screen-label": "Seguridad \u2014 Pilares"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sec-grid2"
  }, [{
    ic: "building-2",
    h: {
      es: "Multi-tenancy con RLS",
      en: "Multi-tenancy with RLS"
    },
    p: {
      es: "Aislamiento por organización a nivel de fila en la base de datos (Row-Level Security). Tus documentos no comparten espacio lógico con nadie.",
      en: "Per-organization isolation at the database row level (Row-Level Security). Your documents share logical space with no one."
    }
  }, {
    ic: "hash",
    h: {
      es: "Cadena de integridad SHA-256",
      en: "SHA-256 integrity chain"
    },
    p: {
      es: "Cada documento se registra con su hash al entrar; análisis y respuestas quedan ligados a él. Cualquier alteración es detectable.",
      en: "Every document is registered with its hash on entry; analyses and answers stay linked to it. Any alteration is detectable."
    }
  }, {
    ic: "map-pin",
    h: {
      es: "Jurisdicción de datos",
      en: "Data jurisdiction"
    },
    p: {
      es: "Residencia de datos definida por contrato y región. Sabes en qué jurisdicción viven tus documentos — y en cuál no.",
      en: "Data residency defined by contract and region. You know which jurisdiction your documents live in — and which they don't."
    }
  }, {
    ic: "server",
    h: {
      es: "On-premise en Enterprise",
      en: "On-premise for Enterprise"
    },
    p: {
      es: "Para operaciones que no pueden salir de su perímetro, el tier Enterprise contempla despliegue en tu infraestructura.",
      en: "For operations that can't leave their perimeter, the Enterprise tier supports deployment on your infrastructure."
    }
  }, {
    ic: "key-round",
    h: {
      es: "Acceso por rol y por documento",
      en: "Role- and document-level access"
    },
    p: {
      es: "Quién consulta qué se define por rol. El MSDS es de todos; el contrato del cliente, de quien debe verlo.",
      en: "Who consults what is defined by role. The MSDS is for everyone; the client contract, for those who should see it."
    }
  }, {
    ic: "eye-off",
    h: {
      es: "Tus datos no entrenan modelos",
      en: "Your data doesn't train models"
    },
    p: {
      es: "Los documentos y consultas de tu organización no se usan para entrenar modelos de terceros. Punto.",
      en: "Your organization's documents and queries are not used to train third-party models. Period."
    }
  }].map((x, i) => /*#__PURE__*/React.createElement("div", {
    className: "sec-item2",
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "ic"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: x.ic,
    size: 20
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", null, t(x.h)), /*#__PURE__*/React.createElement("p", null, t(x.p)))))), /*#__PURE__*/React.createElement("div", {
    className: "count-band",
    "data-comment-anchor": "cuenta-no-concluye"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "eyebrow"
  }, t({
    es: "No-juicio operativo",
    en: "Operational non-judgment"
  })), /*#__PURE__*/React.createElement("h2", null, t({
    es: "DOCYAN cuenta, no concluye",
    en: "DOCYAN counts, it doesn't conclude"
  })), /*#__PURE__*/React.createElement("p", null, t({
    es: "La inteligencia organizacional de DOCYAN reporta frecuencia y patrón: qué se pregunta, cuánto, desde dónde. Nunca diagnostica causas, nunca evalúa personas, nunca juzga tu operación. Esa frontera es de diseño — no una promesa comercial.",
    en: "DOCYAN's organizational intelligence reports frequency and pattern: what gets asked, how much, from where. It never diagnoses causes, never evaluates people, never judges your operation. That boundary is by design — not a marketing promise."
  }))), /*#__PURE__*/React.createElement("div", {
    className: "count-ex"
  }, /*#__PURE__*/React.createElement("div", {
    className: "count-row si"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 16
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "cl"
  }, t({
    es: "Sí reporta",
    en: "It does report"
  })), t({
    es: "«El documento X concentró el 40% de las consultas del turno B este mes.»",
    en: "“Document X drew 40% of shift B's queries this month.”"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "count-row no"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 16
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "cl"
  }, t({
    es: "Nunca dirá",
    en: "It will never say"
  })), t({
    es: "«El turno B no domina el proceso» — diagnosticar causas es trabajo tuyo, no del sistema.",
    en: "“Shift B doesn't master the process” — diagnosing causes is your work, not the system's."
  }))), /*#__PURE__*/React.createElement("div", {
    className: "count-row si"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 16
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "cl"
  }, t({
    es: "Sí reporta",
    en: "It does report"
  })), t({
    es: "«12 preguntas recurrentes no encuentran buena fuente en tu documentación.»",
    en: "“12 recurring questions find no good source in your documentation.”"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "count-row no"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 16
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "cl"
  }, t({
    es: "Nunca dirá",
    en: "It will never say"
  })), t({
    es: "«Tu documentación es deficiente» — el dato es tuyo; la conclusión, también.",
    en: "“Your documentation is deficient” — the data is yours; so is the conclusion."
  }))))), /*#__PURE__*/React.createElement("div", {
    className: "unsafe",
    style: {
      marginTop: 28
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "scale",
    size: 20
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", null, t({
    es: "Capa de conocimiento, no sistema de registro",
    en: "Knowledge layer, not system of record"
  })), /*#__PURE__*/React.createElement("p", null, t({
    es: "DOCYAN emite alertas administrativas y respuestas citadas para decidir mejor. No sustituye a tu LIMS, tu MES ni tu expediente regulatorio, y nunca toma la decisión clínica u operativa.",
    en: "DOCYAN raises administrative alerts and cited answers for better decisions. It doesn't replace your LIMS, your MES or your regulatory file, and it never makes the clinical or operational decision."
  })))))), /*#__PURE__*/React.createElement("section", {
    className: "band paper",
    "data-screen-label": "Seguridad \u2014 CTA"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cta-band"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "sec-title"
  }, t({
    es: "¿Tu equipo de seguridad quiere más detalle?",
    en: "Does your security team want more detail?"
  })), /*#__PURE__*/React.createElement("p", {
    className: "sec-lead",
    style: {
      margin: "12px auto 0"
    }
  }, t({
    es: "El piloto asistido incluye sesión técnica con tu equipo de TI y seguridad.",
    en: "The guided pilot includes a technical session with your IT and security team."
  }))), /*#__PURE__*/React.createElement(Doors, {
    compact: true
  }))));
}
Object.assign(window, {
  SeguridadPage
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/commercial-v2/seguridad.jsx", error: String((e && e.message) || e) }); }

// ui_kits/commercial-v2/shared.jsx
try { (() => {
/* DOCYAN sitio público v2 — infraestructura compartida.
   i18n ES/EN, bandas de precio A/B/C, Nav (fila + hamburguesa),
   banner geo de primera visita, footer, puertas a /signup y /codigo. */

const {
  useState,
  useEffect,
  useRef,
  useContext,
  createContext
} = React;

/* ---------- iconos + marca ---------- */
function Icon({
  name,
  size = 18
}) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && window.lucide) {
      ref.current.innerHTML = "";
      const el = document.createElement("i");
      el.setAttribute("data-lucide", name);
      ref.current.appendChild(el);
      window.lucide.createIcons({
        attrs: {
          "stroke-width": 1.75
        }
      });
    }
  }, [name]);
  return /*#__PURE__*/React.createElement("span", {
    className: "lic",
    ref: ref,
    style: {
      width: size,
      height: size
    },
    "aria-hidden": "true"
  });
}
function Mark({
  size = 26,
  color = "var(--cinnabar-500)"
}) {
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 32 32",
    fill: "none",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M4 10 V6 a2 2 0 0 1 2-2 h4",
    stroke: color,
    strokeWidth: "3.4",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M28 22 v4 a2 2 0 0 1 -2 2 h-4",
    stroke: color,
    strokeWidth: "3.4",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "11",
    y: "11",
    width: "10",
    height: "10",
    rx: "2.4",
    fill: color
  }));
}

/* ---------- i18n ---------- */
const LangCtx = createContext({
  lang: "es",
  setLang: () => {}
});
function useLang() {
  return useContext(LangCtx);
}
/* t({es:"…", en:"…"}) */
function useT() {
  const {
    lang
  } = useLang();
  return o => (o && (o[lang] !== undefined ? o[lang] : o.es)) ?? "";
}

/* ---------- bandas de precio (fuente única) ---------- */
const BANDS = {
  A: {
    key: "A",
    regions: {
      es: "MX · LatAm",
      en: "MX · LatAm"
    },
    cc: "MX",
    tiers: {
      esencial: 250,
      profesional: 550,
      enterprise: 1200
    },
    piloto: {
      list: 250,
      off: 175
    }
  },
  B: {
    key: "B",
    regions: {
      es: "EE. UU. · Canadá",
      en: "US · Canada"
    },
    cc: "US",
    tiers: {
      esencial: 349,
      profesional: 770,
      enterprise: 1680
    },
    piloto: {
      list: 349,
      off: 244
    }
  },
  C: {
    key: "C",
    regions: {
      es: "UE · UK · Australia",
      en: "EU · UK · Australia"
    },
    cc: "EU",
    tiers: {
      esencial: 375,
      profesional: 825,
      enterprise: 1800
    },
    piloto: {
      list: 375,
      off: 262
    }
  }
};
const fmtUSD = n => "$" + n.toLocaleString("en-US");
const BandCtx = createContext({
  band: "A",
  setBand: () => {}
});
function useBand() {
  return useContext(BandCtx);
}

/* ---------- selector banda + idioma ---------- */
function GeoCtl({
  onInk = false,
  showLang = true
}) {
  const {
    band,
    setBand
  } = useBand();
  const {
    lang,
    setLang
  } = useLang();
  const t = useT();
  return /*#__PURE__*/React.createElement("div", {
    className: "geo-ctl"
  }, /*#__PURE__*/React.createElement("span", {
    className: "gc-group" + (onInk ? " onink" : ""),
    role: "group",
    "aria-label": t({
      es: "Banda de precios",
      en: "Price band"
    })
  }, Object.values(BANDS).map(b => /*#__PURE__*/React.createElement("button", {
    key: b.key,
    className: "gc" + (band === b.key ? " on" : ""),
    onClick: () => setBand(b.key)
  }, t(b.regions)))), showLang && /*#__PURE__*/React.createElement("span", {
    className: "gc-group" + (onInk ? " onink" : ""),
    role: "group",
    "aria-label": "Idioma / Language"
  }, /*#__PURE__*/React.createElement("button", {
    className: "gc" + (lang === "es" ? " on" : ""),
    onClick: () => setLang("es")
  }, "Espa\xF1ol"), /*#__PURE__*/React.createElement("button", {
    className: "gc" + (lang === "en" ? " on" : ""),
    onClick: () => setLang("en")
  }, "English")));
}

/* ---------- banner geo primera visita ---------- */
function GeoBanner({
  onDismiss
}) {
  const {
    band
  } = useBand();
  const t = useT();
  const b = BANDS[band];
  return /*#__PURE__*/React.createElement("div", {
    className: "geoband",
    role: "status"
  }, /*#__PURE__*/React.createElement("div", {
    className: "gb"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "map-pin",
    size: 14
  }), /*#__PURE__*/React.createElement("span", null, t({
    es: "Detectamos tu región: ",
    en: "We detected your region: "
  }), /*#__PURE__*/React.createElement("b", null, t(b.regions)), t({
    es: " — precios y idioma ajustados. Puedes cambiarlos cuando quieras.",
    en: " — pricing and language set accordingly. Change them anytime."
  })), /*#__PURE__*/React.createElement("span", {
    className: "gb-act"
  }, /*#__PURE__*/React.createElement(GeoCtlMini, null), /*#__PURE__*/React.createElement("button", {
    className: "gb-x",
    onClick: onDismiss,
    "aria-label": t({
      es: "Cerrar aviso",
      en: "Dismiss notice"
    })
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 14
  })))));
}
function GeoCtlMini() {
  const {
    band,
    setBand
  } = useBand();
  const {
    lang,
    setLang
  } = useLang();
  const t = useT();
  const next = band === "A" ? "B" : band === "B" ? "C" : "A";
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
    className: "gb-btn",
    onClick: () => setBand(next)
  }, t({
    es: "Cambiar región",
    en: "Change region"
  })), /*#__PURE__*/React.createElement("button", {
    className: "gb-btn",
    onClick: () => setLang(lang === "es" ? "en" : "es")
  }, lang === "es" ? "English" : "Español"));
}

/* ---------- puertas a producción (/signup · /codigo) ---------- */
const LinkOutCtx = createContext(() => {});
function useLinkOut() {
  return useContext(LinkOutCtx);
}
function LinkOutModal({
  route,
  onClose
}) {
  const t = useT();
  if (!route) return null;
  const isSignup = route === "/signup";
  return /*#__PURE__*/React.createElement("div", {
    className: "linkout",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "lo-card",
    onClick: e => e.stopPropagation(),
    role: "dialog",
    "aria-modal": "true"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lo-route"
  }, route), /*#__PURE__*/React.createElement("h3", null, isSignup ? t({
    es: "Aquí continúa el registro freemium",
    en: "The freemium signup continues here"
  }) : t({
    es: "Aquí continúa el canje de código piloto",
    en: "The pilot code redemption continues here"
  })), /*#__PURE__*/React.createElement("p", null, isSignup ? t({
    es: "3 documentos vivos, 30 días, registro mínimo. El flujo ya está construido y en producción — este prototipo solo enlaza a él.",
    en: "3 live documents, 30 days, minimal signup. The flow is already built and in production — this prototype only links to it."
  }) : t({
    es: "Acceso asistido con código: Esencial −30% por 60 días. El flujo ya está construido y en producción — este prototipo solo enlaza a él.",
    en: "Assisted access with a code: Esencial −30% for 60 days. The flow is already built and in production — this prototype only links to it."
  })), /*#__PURE__*/React.createElement("div", {
    className: "lo-row"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn primary",
    onClick: onClose
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "external-link",
    size: 15
  }), t({
    es: "Ir a producción",
    en: "Go to production"
  })), /*#__PURE__*/React.createElement("button", {
    className: "btn ghost",
    onClick: onClose
  }, t({
    es: "Volver",
    en: "Back"
  })))));
}

/* ---------- NAV ---------- */
const NAV_LINKS = [["producto", {
  es: "Producto",
  en: "Product"
}], ["como", {
  es: "Cómo funciona",
  en: "How it works"
}], ["verticales", {
  es: "Verticales",
  en: "Industries"
}], ["seguridad", {
  es: "Seguridad",
  en: "Security"
}], ["precios", {
  es: "Precios",
  en: "Pricing"
}]];
function Nav2({
  page,
  go
}) {
  const t = useT();
  const {
    lang,
    setLang
  } = useLang();
  const linkOut = useLinkOut();
  const [open, setOpen] = useState(false);
  const nav = p => {
    setOpen(false);
    go(p);
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("nav", {
    className: "nav2",
    "aria-label": t({
      es: "Navegación principal",
      en: "Main navigation"
    })
  }, /*#__PURE__*/React.createElement("div", {
    className: "nrow"
  }, /*#__PURE__*/React.createElement("button", {
    className: "brand",
    onClick: () => nav("home"),
    "aria-label": "DOCYAN \u2014 inicio"
  }, /*#__PURE__*/React.createElement(Mark, {
    size: 26
  }), /*#__PURE__*/React.createElement("span", null, "DOCYAN"), /*#__PURE__*/React.createElement("span", {
    className: "lde"
  }, "LDE")), /*#__PURE__*/React.createElement("div", {
    className: "links"
  }, NAV_LINKS.map(([k, l]) => /*#__PURE__*/React.createElement("a", {
    key: k,
    className: page === k || k === "verticales" && page.indexOf("vert:") === 0 ? "on" : "",
    onClick: () => nav(k)
  }, t(l)))), /*#__PURE__*/React.createElement("div", {
    className: "nright"
  }, /*#__PURE__*/React.createElement("button", {
    className: "lang-pill",
    onClick: () => setLang(lang === "es" ? "en" : "es"),
    "aria-label": "Idioma / Language"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "globe",
    size: 12
  }), /*#__PURE__*/React.createElement("b", null, lang.toUpperCase())), /*#__PURE__*/React.createElement("button", {
    className: "btn ghost login",
    onClick: () => linkOut("/login")
  }, t({
    es: "Entrar",
    en: "Sign in"
  })), /*#__PURE__*/React.createElement("button", {
    className: "btn primary ncta",
    onClick: () => linkOut("/signup")
  }, t({
    es: "Pruébalo gratis",
    en: "Try it free"
  })), /*#__PURE__*/React.createElement("button", {
    className: "hamb",
    onClick: () => setOpen(true),
    "aria-label": t({
      es: "Abrir menú",
      en: "Open menu"
    })
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "menu",
    size: 22
  }))))), open && /*#__PURE__*/React.createElement("div", {
    className: "msheet",
    onClick: () => setOpen(false)
  }, /*#__PURE__*/React.createElement("div", {
    className: "mpanel",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    className: "mtop"
  }, /*#__PURE__*/React.createElement("button", {
    className: "brand",
    onClick: () => nav("home")
  }, /*#__PURE__*/React.createElement(Mark, {
    size: 24
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700
    }
  }, "DOCYAN")), /*#__PURE__*/React.createElement("button", {
    className: "hamb",
    onClick: () => setOpen(false),
    "aria-label": t({
      es: "Cerrar menú",
      en: "Close menu"
    })
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 22
  }))), NAV_LINKS.map(([k, l]) => /*#__PURE__*/React.createElement("a", {
    key: k,
    className: "mlink" + (page === k ? " on" : ""),
    onClick: () => nav(k)
  }, t(l), /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-right",
    size: 18
  }))), /*#__PURE__*/React.createElement("div", {
    className: "mctas"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn primary lg",
    onClick: () => {
      setOpen(false);
      linkOut("/signup");
    }
  }, t({
    es: "Pruébalo gratis — 3 documentos",
    en: "Try it free — 3 documents"
  })), /*#__PURE__*/React.createElement("button", {
    className: "btn sec lg",
    onClick: () => {
      setOpen(false);
      linkOut("/codigo");
    }
  }, t({
    es: "Agendar demo",
    en: "Book a demo"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "mlang"
  }, /*#__PURE__*/React.createElement(GeoCtl, null)))));
}

/* ---------- dos puertas (CTA reutilizable) ---------- */
function Doors({
  compact = false
}) {
  const t = useT();
  const {
    band
  } = useBand();
  const linkOut = useLinkOut();
  const b = BANDS[band];
  return /*#__PURE__*/React.createElement("div", {
    className: "doors"
  }, /*#__PURE__*/React.createElement("div", {
    className: "door main"
  }, /*#__PURE__*/React.createElement("span", {
    className: "d-lab"
  }, t({
    es: "Puerta principal · autoservicio",
    en: "Main door · self-serve"
  })), /*#__PURE__*/React.createElement("h3", null, t({
    es: "Pruébalo gratis — 3 documentos",
    en: "Try it free — 3 documents"
  })), /*#__PURE__*/React.createElement("p", null, t({
    es: "Registro mínimo. Sube hasta 3 documentos vivos y consúltalos durante 30 días. Eliges plan después de vivir el producto.",
    en: "Minimal signup. Upload up to 3 live documents and consult them for 30 days. Pick a plan after you've lived the product."
  })), /*#__PURE__*/React.createElement("div", {
    className: "d-meta"
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 13
  }), t({
    es: "Sin tarjeta",
    en: "No card"
  })), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 13
  }), t({
    es: "30 días",
    en: "30 days"
  })), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 13
  }), t({
    es: "Todas las capacidades",
    en: "All capabilities"
  }))), /*#__PURE__*/React.createElement("button", {
    className: "btn primary lg",
    onClick: () => linkOut("/signup")
  }, t({
    es: "Crear cuenta gratis",
    en: "Create free account"
  }), /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-right",
    size: 16
  }))), /*#__PURE__*/React.createElement("div", {
    className: "door side"
  }, /*#__PURE__*/React.createElement("span", {
    className: "d-lab"
  }, t({
    es: "Puerta asistida · piloto",
    en: "Assisted door · pilot"
  })), /*#__PURE__*/React.createElement("h3", null, t({
    es: "Piloto con acompañamiento",
    en: "Guided pilot"
  })), /*#__PURE__*/React.createElement("p", null, t({
    es: "Con código de acceso: Esencial por ",
    en: "With an access code: Esencial at "
  }), /*#__PURE__*/React.createElement("span", {
    className: "strike mono"
  }, fmtUSD(b.piloto.list)), " ", /*#__PURE__*/React.createElement("b", {
    className: "mono"
  }, fmtUSD(b.piloto.off), "/", t({
    es: "mes",
    en: "mo"
  })), t({
    es: " durante 60 días, con tu equipo y tus documentos reales.",
    en: " for 60 days, with your team and your real documents."
  })), !compact && /*#__PURE__*/React.createElement("div", {
    className: "d-meta"
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 13
  }), t({
    es: "−30% precio de lista",
    en: "−30% off list"
  })), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 13
  }), t({
    es: "60 días",
    en: "60 days"
  }))), /*#__PURE__*/React.createElement("button", {
    className: "btn sec lg",
    onClick: () => linkOut("/codigo")
  }, t({
    es: "Agendar demo · canjear código",
    en: "Book a demo · redeem code"
  }))));
}

/* ---------- FOOTER ---------- */
function Footer2({
  go
}) {
  const t = useT();
  const linkOut = useLinkOut();
  return /*#__PURE__*/React.createElement("footer", {
    className: "footer2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "fgrid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "fbrand"
  }, /*#__PURE__*/React.createElement("div", {
    className: "brand"
  }, /*#__PURE__*/React.createElement(Mark, {
    size: 24,
    color: "var(--cinnabar-400)"
  }), /*#__PURE__*/React.createElement("span", null, "DOCYAN")), /*#__PURE__*/React.createElement("p", {
    className: "fdesc"
  }, t({
    es: "Live Document Environment. Tus documentos, consultables al instante, con cita a la fuente.",
    en: "Live Document Environment. Your documents, instantly consultable, with a citation to the source."
  })), /*#__PURE__*/React.createElement(GeoCtl, {
    onInk: true
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h4", null, t({
    es: "Producto",
    en: "Product"
  })), /*#__PURE__*/React.createElement("a", {
    onClick: () => go("producto")
  }, t({
    es: "Qué es DOCYAN",
    en: "What DOCYAN is"
  })), /*#__PURE__*/React.createElement("a", {
    onClick: () => go("como")
  }, t({
    es: "Cómo funciona",
    en: "How it works"
  })), /*#__PURE__*/React.createElement("a", {
    onClick: () => go("seguridad")
  }, t({
    es: "Seguridad",
    en: "Security"
  })), /*#__PURE__*/React.createElement("a", {
    onClick: () => go("precios")
  }, t({
    es: "Precios",
    en: "Pricing"
  }))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h4", null, t({
    es: "Sectores",
    en: "Industries"
  })), /*#__PURE__*/React.createElement("a", {
    onClick: () => go("vert:lab")
  }, t({
    es: "Laboratorios",
    en: "Laboratories"
  })), /*#__PURE__*/React.createElement("a", {
    onClick: () => go("vert:maq")
  }, t({
    es: "Maquila y manufactura",
    en: "Maquila & manufacturing"
  })), /*#__PURE__*/React.createElement("a", {
    onClick: () => go("vert:flot")
  }, t({
    es: "Flotillas de técnicos",
    en: "Field technician fleets"
  })), /*#__PURE__*/React.createElement("a", {
    onClick: () => go("verticales")
  }, t({
    es: "Todos los sectores",
    en: "All industries"
  }))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h4", null, t({
    es: "Empezar",
    en: "Get started"
  })), /*#__PURE__*/React.createElement("a", {
    onClick: () => linkOut("/signup")
  }, t({
    es: "Pruébalo gratis",
    en: "Try it free"
  })), /*#__PURE__*/React.createElement("a", {
    onClick: () => go("demos")
  }, t({
    es: "Demos sin registro",
    en: "No-signup demos"
  })), /*#__PURE__*/React.createElement("a", {
    onClick: () => linkOut("/codigo")
  }, t({
    es: "Canjear código piloto",
    en: "Redeem pilot code"
  })), /*#__PURE__*/React.createElement("a", {
    onClick: () => linkOut("/login")
  }, t({
    es: "Entrar",
    en: "Sign in"
  })), /*#__PURE__*/React.createElement("a", {
    onClick: () => go("legal")
  }, t({
    es: "Privacidad y términos",
    en: "Privacy & terms"
  })))), /*#__PURE__*/React.createElement("div", {
    className: "fbottom"
  }, /*#__PURE__*/React.createElement("span", null, "\xA9 2026 XCID SA de CV \xB7 DOCYAN LDE\u2122"), /*#__PURE__*/React.createElement("span", {
    className: "sp"
  }, /*#__PURE__*/React.createElement("span", {
    className: "status"
  }, /*#__PURE__*/React.createElement("span", {
    className: "d"
  }), t({
    es: "Todos los sistemas operativos",
    en: "All systems operational"
  }))))));
}

/* ---------- página legal placeholder honesto ---------- */
function LegalPage() {
  const t = useT();
  return /*#__PURE__*/React.createElement("div", {
    className: "wrap narrow",
    style: {
      padding: "64px 20px 96px"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "eyebrow"
  }, t({
    es: "Privacidad · Términos",
    en: "Privacy · Terms"
  })), /*#__PURE__*/React.createElement("h1", {
    className: "page-hero",
    style: {
      padding: 0,
      fontSize: "clamp(28px,4vw,38px)",
      fontWeight: 700,
      letterSpacing: "-.02em",
      margin: "14px 0 0"
    }
  }, t({
    es: "Documentos legales en preparación",
    en: "Legal documents in preparation"
  })), /*#__PURE__*/React.createElement("p", {
    className: "sec-lead"
  }, t({
    es: "El aviso de privacidad y los términos de servicio se publicarán aquí antes del inicio de los pilotos, una vez definida la postura de propiedad intelectual. Preferimos un marcador honesto a un texto legal inventado.",
    en: "The privacy notice and terms of service will be published here before pilots begin, once the intellectual-property position is settled. We prefer an honest placeholder to invented legal text."
  })), /*#__PURE__*/React.createElement("p", {
    className: "sec-lead",
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 13
    }
  }, t({
    es: "Contacto: ",
    en: "Contact: "
  }), "hola@docyan.com"));
}
Object.assign(window, {
  Icon,
  Mark,
  LangCtx,
  useLang,
  useT,
  BANDS,
  fmtUSD,
  BandCtx,
  useBand,
  GeoCtl,
  GeoBanner,
  LinkOutCtx,
  useLinkOut,
  LinkOutModal,
  Nav2,
  Doors,
  Footer2,
  LegalPage
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/commercial-v2/shared.jsx", error: String((e && e.message) || e) }); }

// ui_kits/commercial-v2/tweaks-panel.jsx
try { (() => {
// @ds-adherence-ignore -- omelette starter scaffold (raw elements/hex/px by design)

/* BEGIN USAGE */
// tweaks-panel.jsx
// Reusable Tweaks shell + form-control helpers.
// Exports (to window): useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider,
//   TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton.
//
// Owns the host protocol (listens for __activate_edit_mode / __deactivate_edit_mode,
// posts __edit_mode_available / __edit_mode_set_keys / __edit_mode_dismissed) so
// individual prototypes don't re-roll it. Ships a consistent set of controls so you
// don't hand-draw <input type="range">, segmented radios, steppers, etc.
//
// Usage (in an HTML file that loads React + Babel):
//
//   const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
//     "primaryColor": "#D97757",
//     "palette": ["#D97757", "#29261b", "#f6f4ef"],
//     "fontSize": 16,
//     "density": "regular",
//     "dark": false
//   }/*EDITMODE-END*/;
//
//   function App() {
//     const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
//     return (
//       <div style={{ fontSize: t.fontSize, color: t.primaryColor }}>
//         Hello
//         <TweaksPanel>
//           <TweakSection label="Typography" />
//           <TweakSlider label="Font size" value={t.fontSize} min={10} max={32} unit="px"
//                        onChange={(v) => setTweak('fontSize', v)} />
//           <TweakRadio  label="Density" value={t.density}
//                        options={['compact', 'regular', 'comfy']}
//                        onChange={(v) => setTweak('density', v)} />
//           <TweakSection label="Theme" />
//           <TweakColor  label="Primary" value={t.primaryColor}
//                        options={['#D97757', '#2A6FDB', '#1F8A5B', '#7A5AE0']}
//                        onChange={(v) => setTweak('primaryColor', v)} />
//           <TweakColor  label="Palette" value={t.palette}
//                        options={[['#D97757', '#29261b', '#f6f4ef'],
//                                  ['#475569', '#0f172a', '#f1f5f9']]}
//                        onChange={(v) => setTweak('palette', v)} />
//           <TweakToggle label="Dark mode" value={t.dark}
//                        onChange={(v) => setTweak('dark', v)} />
//         </TweaksPanel>
//       </div>
//     );
//   }
//
// TweakRadio is the segmented control for 2–3 short options (auto-falls-back to
// TweakSelect past ~16/~10 chars per label); reach for TweakSelect directly when
// options are many or long. For color tweaks always curate 3-4 options rather than
// a free picker; an option can also be a whole 2–5 color palette (the stored value
// is the array). The Tweak* controls are a floor, not a ceiling — build custom
// controls inside the panel if a tweak calls for UI they don't cover.
/* END USAGE */
// ─────────────────────────────────────────────────────────────────────────────

const __TWEAKS_STYLE = `
  .twk-panel{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:280px;
    max-height:calc(100vh - 32px);display:flex;flex-direction:column;
    transform:scale(var(--dc-inv-zoom,1));transform-origin:bottom right;
    background:rgba(250,249,247,.78);color:#29261b;
    -webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%);
    border:.5px solid rgba(255,255,255,.6);border-radius:14px;
    box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 12px 40px rgba(0,0,0,.18);
    font:11.5px/1.4 ui-sans-serif,system-ui,-apple-system,sans-serif;overflow:hidden}
  .twk-hd{display:flex;align-items:center;justify-content:space-between;
    padding:10px 8px 10px 14px;cursor:move;user-select:none}
  .twk-hd b{font-size:12px;font-weight:600;letter-spacing:.01em}
  .twk-x{appearance:none;border:0;background:transparent;color:rgba(41,38,27,.55);
    width:22px;height:22px;border-radius:6px;cursor:default;font-size:13px;line-height:1}
  .twk-x:hover{background:rgba(0,0,0,.06);color:#29261b}
  .twk-body{padding:2px 14px 14px;display:flex;flex-direction:column;gap:10px;
    overflow-y:auto;overflow-x:hidden;min-height:0;
    scrollbar-width:thin;scrollbar-color:rgba(0,0,0,.15) transparent}
  .twk-body::-webkit-scrollbar{width:8px}
  .twk-body::-webkit-scrollbar-track{background:transparent;margin:2px}
  .twk-body::-webkit-scrollbar-thumb{background:rgba(0,0,0,.15);border-radius:4px;
    border:2px solid transparent;background-clip:content-box}
  .twk-body::-webkit-scrollbar-thumb:hover{background:rgba(0,0,0,.25);
    border:2px solid transparent;background-clip:content-box}
  .twk-row{display:flex;flex-direction:column;gap:5px}
  .twk-row-h{flex-direction:row;align-items:center;justify-content:space-between;gap:10px}
  .twk-lbl{display:flex;justify-content:space-between;align-items:baseline;
    color:rgba(41,38,27,.72)}
  .twk-lbl>span:first-child{font-weight:500}
  .twk-val{color:rgba(41,38,27,.5);font-variant-numeric:tabular-nums}

  .twk-sect{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
    color:rgba(41,38,27,.45);padding:10px 0 0}
  .twk-sect:first-child{padding-top:0}

  .twk-field{appearance:none;box-sizing:border-box;width:100%;min-width:0;height:26px;padding:0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;
    background:rgba(255,255,255,.6);color:inherit;font:inherit;outline:none}
  .twk-field:focus{border-color:rgba(0,0,0,.25);background:rgba(255,255,255,.85)}
  select.twk-field{padding-right:22px;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='rgba(0,0,0,.5)' d='M0 0h10L5 6z'/></svg>");
    background-repeat:no-repeat;background-position:right 8px center}

  .twk-slider{appearance:none;-webkit-appearance:none;width:100%;height:4px;margin:6px 0;
    border-radius:999px;background:rgba(0,0,0,.12);outline:none}
  .twk-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;
    width:14px;height:14px;border-radius:50%;background:#fff;
    border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}
  .twk-slider::-moz-range-thumb{width:14px;height:14px;border-radius:50%;
    background:#fff;border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}

  .twk-seg{position:relative;display:flex;padding:2px;border-radius:8px;
    background:rgba(0,0,0,.06);user-select:none}
  .twk-seg-thumb{position:absolute;top:2px;bottom:2px;border-radius:6px;
    background:rgba(255,255,255,.9);box-shadow:0 1px 2px rgba(0,0,0,.12);
    transition:left .15s cubic-bezier(.3,.7,.4,1),width .15s}
  .twk-seg.dragging .twk-seg-thumb{transition:none}
  .twk-seg button{appearance:none;position:relative;z-index:1;flex:1;border:0;
    background:transparent;color:inherit;font:inherit;font-weight:500;min-height:22px;
    border-radius:6px;cursor:default;padding:4px 6px;line-height:1.2;
    overflow-wrap:anywhere}

  .twk-toggle{position:relative;width:32px;height:18px;border:0;border-radius:999px;
    background:rgba(0,0,0,.15);transition:background .15s;cursor:default;padding:0}
  .twk-toggle[data-on="1"]{background:#34c759}
  .twk-toggle i{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;
    background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}
  .twk-toggle[data-on="1"] i{transform:translateX(14px)}

  .twk-num{display:flex;align-items:center;box-sizing:border-box;min-width:0;height:26px;padding:0 0 0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;background:rgba(255,255,255,.6)}
  .twk-num-lbl{font-weight:500;color:rgba(41,38,27,.6);cursor:ew-resize;
    user-select:none;padding-right:8px}
  .twk-num input{flex:1;min-width:0;height:100%;border:0;background:transparent;
    font:inherit;font-variant-numeric:tabular-nums;text-align:right;padding:0 8px 0 0;
    outline:none;color:inherit;-moz-appearance:textfield}
  .twk-num input::-webkit-inner-spin-button,.twk-num input::-webkit-outer-spin-button{
    -webkit-appearance:none;margin:0}
  .twk-num-unit{padding-right:8px;color:rgba(41,38,27,.45)}

  .twk-btn{appearance:none;height:26px;padding:0 12px;border:0;border-radius:7px;
    background:rgba(0,0,0,.78);color:#fff;font:inherit;font-weight:500;cursor:default}
  .twk-btn:hover{background:rgba(0,0,0,.88)}
  .twk-btn.secondary{background:rgba(0,0,0,.06);color:inherit}
  .twk-btn.secondary:hover{background:rgba(0,0,0,.1)}

  .twk-swatch{appearance:none;-webkit-appearance:none;width:56px;height:22px;
    border:.5px solid rgba(0,0,0,.1);border-radius:6px;padding:0;cursor:default;
    background:transparent;flex-shrink:0}
  .twk-swatch::-webkit-color-swatch-wrapper{padding:0}
  .twk-swatch::-webkit-color-swatch{border:0;border-radius:5.5px}
  .twk-swatch::-moz-color-swatch{border:0;border-radius:5.5px}

  .twk-chips{display:flex;gap:6px}
  .twk-chip{position:relative;appearance:none;flex:1;min-width:0;height:46px;
    padding:0;border:0;border-radius:6px;overflow:hidden;cursor:default;
    box-shadow:0 0 0 .5px rgba(0,0,0,.12),0 1px 2px rgba(0,0,0,.06);
    transition:transform .12s cubic-bezier(.3,.7,.4,1),box-shadow .12s}
  .twk-chip:hover{transform:translateY(-1px);
    box-shadow:0 0 0 .5px rgba(0,0,0,.18),0 4px 10px rgba(0,0,0,.12)}
  .twk-chip[data-on="1"]{box-shadow:0 0 0 1.5px rgba(0,0,0,.85),
    0 2px 6px rgba(0,0,0,.15)}
  .twk-chip>span{position:absolute;top:0;bottom:0;right:0;width:34%;
    display:flex;flex-direction:column;box-shadow:-1px 0 0 rgba(0,0,0,.1)}
  .twk-chip>span>i{flex:1;box-shadow:0 -1px 0 rgba(0,0,0,.1)}
  .twk-chip>span>i:first-child{box-shadow:none}
  .twk-chip svg{position:absolute;top:6px;left:6px;width:13px;height:13px;
    filter:drop-shadow(0 1px 1px rgba(0,0,0,.3))}
`;

// ── useTweaks ───────────────────────────────────────────────────────────────
// Single source of truth for tweak values. setTweak persists via the host
// (__edit_mode_set_keys → host rewrites the EDITMODE block on disk).
function useTweaks(defaults) {
  const [values, setValues] = React.useState(defaults);
  // Accepts either setTweak('key', value) or setTweak({ key: value, ... }) so a
  // useState-style call doesn't write a "[object Object]" key into the persisted
  // JSON block.
  const setTweak = React.useCallback((keyOrEdits, val) => {
    const edits = typeof keyOrEdits === 'object' && keyOrEdits !== null ? keyOrEdits : {
      [keyOrEdits]: val
    };
    setValues(prev => ({
      ...prev,
      ...edits
    }));
    window.parent.postMessage({
      type: '__edit_mode_set_keys',
      edits
    }, '*');
    // Same-window signal so in-page listeners (deck-stage rail thumbnails)
    // can react — the parent message only reaches the host, not peers.
    window.dispatchEvent(new CustomEvent('tweakchange', {
      detail: edits
    }));
  }, []);
  return [values, setTweak];
}

// ── TweaksPanel ─────────────────────────────────────────────────────────────
// Floating shell. Registers the protocol listener BEFORE announcing
// availability — if the announce ran first, the host's activate could land
// before our handler exists and the toolbar toggle would silently no-op.
// The close button posts __edit_mode_dismissed so the host's toolbar toggle
// flips off in lockstep; the host echoes __deactivate_edit_mode back which
// is what actually hides the panel.
function TweaksPanel({
  title = 'Tweaks',
  children
}) {
  const [open, setOpen] = React.useState(false);
  const dragRef = React.useRef(null);
  const offsetRef = React.useRef({
    x: 16,
    y: 16
  });
  const PAD = 16;
  const clampToViewport = React.useCallback(() => {
    const panel = dragRef.current;
    if (!panel) return;
    const w = panel.offsetWidth,
      h = panel.offsetHeight;
    const maxRight = Math.max(PAD, window.innerWidth - w - PAD);
    const maxBottom = Math.max(PAD, window.innerHeight - h - PAD);
    offsetRef.current = {
      x: Math.min(maxRight, Math.max(PAD, offsetRef.current.x)),
      y: Math.min(maxBottom, Math.max(PAD, offsetRef.current.y))
    };
    panel.style.right = offsetRef.current.x + 'px';
    panel.style.bottom = offsetRef.current.y + 'px';
  }, []);
  React.useEffect(() => {
    if (!open) return;
    clampToViewport();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', clampToViewport);
      return () => window.removeEventListener('resize', clampToViewport);
    }
    const ro = new ResizeObserver(clampToViewport);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, [open, clampToViewport]);
  React.useEffect(() => {
    const onMsg = e => {
      const t = e?.data?.type;
      if (t === '__activate_edit_mode') setOpen(true);else if (t === '__deactivate_edit_mode') setOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({
      type: '__edit_mode_available'
    }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);
  const dismiss = () => {
    setOpen(false);
    window.parent.postMessage({
      type: '__edit_mode_dismissed'
    }, '*');
  };
  const onDragStart = e => {
    const panel = dragRef.current;
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    const sx = e.clientX,
      sy = e.clientY;
    const startRight = window.innerWidth - r.right;
    const startBottom = window.innerHeight - r.bottom;
    const move = ev => {
      offsetRef.current = {
        x: startRight - (ev.clientX - sx),
        y: startBottom - (ev.clientY - sy)
      };
      clampToViewport();
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
  if (!open) return null;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("style", null, __TWEAKS_STYLE), /*#__PURE__*/React.createElement("div", {
    ref: dragRef,
    className: "twk-panel",
    "data-omelette-chrome": "",
    style: {
      right: offsetRef.current.x,
      bottom: offsetRef.current.y
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-hd",
    onMouseDown: onDragStart
  }, /*#__PURE__*/React.createElement("b", null, title), /*#__PURE__*/React.createElement("button", {
    className: "twk-x",
    "aria-label": "Close tweaks",
    onMouseDown: e => e.stopPropagation(),
    onClick: dismiss
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    className: "twk-body"
  }, children)));
}

// ── Layout helpers ──────────────────────────────────────────────────────────

function TweakSection({
  label,
  children
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "twk-sect"
  }, label), children);
}
function TweakRow({
  label,
  value,
  children,
  inline = false
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: inline ? 'twk-row twk-row-h' : 'twk-row'
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-lbl"
  }, /*#__PURE__*/React.createElement("span", null, label), value != null && /*#__PURE__*/React.createElement("span", {
    className: "twk-val"
  }, value)), children);
}

// ── Controls ────────────────────────────────────────────────────────────────

function TweakSlider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label,
    value: `${value}${unit}`
  }, /*#__PURE__*/React.createElement("input", {
    type: "range",
    className: "twk-slider",
    min: min,
    max: max,
    step: step,
    value: value,
    onChange: e => onChange(Number(e.target.value))
  }));
}
function TweakToggle({
  label,
  value,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "twk-row twk-row-h"
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-lbl"
  }, /*#__PURE__*/React.createElement("span", null, label)), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "twk-toggle",
    "data-on": value ? '1' : '0',
    role: "switch",
    "aria-checked": !!value,
    onClick: () => onChange(!value)
  }, /*#__PURE__*/React.createElement("i", null)));
}
function TweakRadio({
  label,
  value,
  options,
  onChange
}) {
  const trackRef = React.useRef(null);
  const [dragging, setDragging] = React.useState(false);
  // The active value is read by pointer-move handlers attached for the lifetime
  // of a drag — ref it so a stale closure doesn't fire onChange for every move.
  const valueRef = React.useRef(value);
  valueRef.current = value;

  // Segments wrap mid-word once per-segment width runs out. The track is
  // ~248px (280 panel − 28 body pad − 4 seg pad), each button loses 12px
  // to its own padding, and 11.5px system-ui averages ~6.3px/char — so 2
  // options fit ~16 chars each, 3 fit ~10. Past that (or >3 options), fall
  // back to a dropdown rather than wrap.
  const labelLen = o => String(typeof o === 'object' ? o.label : o).length;
  const maxLen = options.reduce((m, o) => Math.max(m, labelLen(o)), 0);
  const fitsAsSegments = maxLen <= ({
    2: 16,
    3: 10
  }[options.length] ?? 0);
  if (!fitsAsSegments) {
    // <select> emits strings — map back to the original option value so the
    // fallback stays type-preserving (numbers, booleans) like the segment path.
    const resolve = s => {
      const m = options.find(o => String(typeof o === 'object' ? o.value : o) === s);
      return m === undefined ? s : typeof m === 'object' ? m.value : m;
    };
    return /*#__PURE__*/React.createElement(TweakSelect, {
      label: label,
      value: value,
      options: options,
      onChange: s => onChange(resolve(s))
    });
  }
  const opts = options.map(o => typeof o === 'object' ? o : {
    value: o,
    label: o
  });
  const idx = Math.max(0, opts.findIndex(o => o.value === value));
  const n = opts.length;
  const segAt = clientX => {
    const r = trackRef.current.getBoundingClientRect();
    const inner = r.width - 4;
    const i = Math.floor((clientX - r.left - 2) / inner * n);
    return opts[Math.max(0, Math.min(n - 1, i))].value;
  };
  const onPointerDown = e => {
    setDragging(true);
    const v0 = segAt(e.clientX);
    if (v0 !== valueRef.current) onChange(v0);
    const move = ev => {
      if (!trackRef.current) return;
      const v = segAt(ev.clientX);
      if (v !== valueRef.current) onChange(v);
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("div", {
    ref: trackRef,
    role: "radiogroup",
    onPointerDown: onPointerDown,
    className: dragging ? 'twk-seg dragging' : 'twk-seg'
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-seg-thumb",
    style: {
      left: `calc(2px + ${idx} * (100% - 4px) / ${n})`,
      width: `calc((100% - 4px) / ${n})`
    }
  }), opts.map(o => /*#__PURE__*/React.createElement("button", {
    key: o.value,
    type: "button",
    role: "radio",
    "aria-checked": o.value === value
  }, o.label))));
}
function TweakSelect({
  label,
  value,
  options,
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("select", {
    className: "twk-field",
    value: value,
    onChange: e => onChange(e.target.value)
  }, options.map(o => {
    const v = typeof o === 'object' ? o.value : o;
    const l = typeof o === 'object' ? o.label : o;
    return /*#__PURE__*/React.createElement("option", {
      key: v,
      value: v
    }, l);
  })));
}
function TweakText({
  label,
  value,
  placeholder,
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("input", {
    className: "twk-field",
    type: "text",
    value: value,
    placeholder: placeholder,
    onChange: e => onChange(e.target.value)
  }));
}
function TweakNumber({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange
}) {
  const clamp = n => {
    if (min != null && n < min) return min;
    if (max != null && n > max) return max;
    return n;
  };
  const startRef = React.useRef({
    x: 0,
    val: 0
  });
  const onScrubStart = e => {
    e.preventDefault();
    startRef.current = {
      x: e.clientX,
      val: value
    };
    const decimals = (String(step).split('.')[1] || '').length;
    const move = ev => {
      const dx = ev.clientX - startRef.current.x;
      const raw = startRef.current.val + dx * step;
      const snapped = Math.round(raw / step) * step;
      onChange(clamp(Number(snapped.toFixed(decimals))));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "twk-num"
  }, /*#__PURE__*/React.createElement("span", {
    className: "twk-num-lbl",
    onPointerDown: onScrubStart
  }, label), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: value,
    min: min,
    max: max,
    step: step,
    onChange: e => onChange(clamp(Number(e.target.value)))
  }), unit && /*#__PURE__*/React.createElement("span", {
    className: "twk-num-unit"
  }, unit));
}

// Relative-luminance contrast pick — checkmarks drawn over a swatch need to
// read on both #111 and #fafafa without per-option configuration. Hex input
// only (#rgb / #rrggbb); named or rgb()/hsl() colors fall through to "light".
function __twkIsLight(hex) {
  const h = String(hex).replace('#', '');
  const x = h.length === 3 ? h.replace(/./g, c => c + c) : h.padEnd(6, '0');
  const n = parseInt(x.slice(0, 6), 16);
  if (Number.isNaN(n)) return true;
  const r = n >> 16 & 255,
    g = n >> 8 & 255,
    b = n & 255;
  return r * 299 + g * 587 + b * 114 > 148000;
}
const __TwkCheck = ({
  light
}) => /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 14 14",
  "aria-hidden": "true"
}, /*#__PURE__*/React.createElement("path", {
  d: "M3 7.2 5.8 10 11 4.2",
  fill: "none",
  strokeWidth: "2.2",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  stroke: light ? 'rgba(0,0,0,.78)' : '#fff'
}));

// TweakColor — curated color/palette picker. Each option is either a single
// hex string or an array of 1-5 hex strings; the card adapts — a lone color
// renders solid, a palette renders colors[0] as the hero (left ~2/3) with the
// rest stacked in a sharp column on the right. onChange emits the
// option in the shape it was passed (string stays string, array stays array).
// Without options it falls back to the native color input for back-compat.
function TweakColor({
  label,
  value,
  options,
  onChange
}) {
  if (!options || !options.length) {
    return /*#__PURE__*/React.createElement("div", {
      className: "twk-row twk-row-h"
    }, /*#__PURE__*/React.createElement("div", {
      className: "twk-lbl"
    }, /*#__PURE__*/React.createElement("span", null, label)), /*#__PURE__*/React.createElement("input", {
      type: "color",
      className: "twk-swatch",
      value: value,
      onChange: e => onChange(e.target.value)
    }));
  }
  // Native <input type=color> emits lowercase hex per the HTML spec, so
  // compare case-insensitively. String() guards JSON.stringify(undefined),
  // which returns the primitive undefined (no .toLowerCase).
  const key = o => String(JSON.stringify(o)).toLowerCase();
  const cur = key(value);
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-chips",
    role: "radiogroup"
  }, options.map((o, i) => {
    const colors = Array.isArray(o) ? o : [o];
    const [hero, ...rest] = colors;
    const sup = rest.slice(0, 4);
    const on = key(o) === cur;
    return /*#__PURE__*/React.createElement("button", {
      key: i,
      type: "button",
      className: "twk-chip",
      role: "radio",
      "aria-checked": on,
      "data-on": on ? '1' : '0',
      "aria-label": colors.join(', '),
      title: colors.join(' · '),
      style: {
        background: hero
      },
      onClick: () => onChange(o)
    }, sup.length > 0 && /*#__PURE__*/React.createElement("span", null, sup.map((c, j) => /*#__PURE__*/React.createElement("i", {
      key: j,
      style: {
        background: c
      }
    }))), on && /*#__PURE__*/React.createElement(__TwkCheck, {
      light: __twkIsLight(hero)
    }));
  })));
}
function TweakButton({
  label,
  onClick,
  secondary = false
}) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: secondary ? 'twk-btn secondary' : 'twk-btn',
    onClick: onClick
  }, label);
}
Object.assign(window, {
  useTweaks,
  TweaksPanel,
  TweakSection,
  TweakRow,
  TweakSlider,
  TweakToggle,
  TweakRadio,
  TweakSelect,
  TweakText,
  TweakNumber,
  TweakColor,
  TweakButton
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/commercial-v2/tweaks-panel.jsx", error: String((e && e.message) || e) }); }

// ui_kits/commercial-v2/verticales.jsx
try { (() => {
/* DOCYAN sitio público v2 — VERTICALES.
   Hub con paraguas transversal (la firma del trabajo que une sectores)
   + grid de 7 + páginas de detalle: Laboratorios (modelo), Maquila, Flotillas. */

const VERTS = [{
  key: "lab",
  ic: "flask-conical",
  built: true,
  norm: "ISO 17025",
  name: {
    es: "Laboratorios de pruebas",
    en: "Testing laboratories"
  },
  desc: {
    es: "Métodos, calibraciones y certificados consultables al instante — antes de que venzan.",
    en: "Methods, calibrations and certificates consultable instantly — before they expire."
  }
}, {
  key: "maq",
  ic: "factory",
  built: true,
  norm: "IATF · ISO 9001",
  name: {
    es: "Maquila y manufactura",
    en: "Maquila & manufacturing"
  },
  desc: {
    es: "Parámetros de máquina y procedimientos en el piso, sin detener la línea para buscar.",
    en: "Machine parameters and procedures on the floor, without stopping the line to search."
  }
}, {
  key: "flot",
  ic: "truck",
  built: true,
  norm: "ASME B31.8 · NOM",
  name: {
    es: "Flotillas de técnicos",
    en: "Field technician fleets"
  },
  desc: {
    es: "El procedimiento completo en el celular del técnico, a 200 km de la oficina.",
    en: "The full procedure on the tech's phone, 200 km from the office."
  }
}, {
  key: "marina",
  ic: "anchor",
  built: false,
  norm: "API · OSHA",
  name: {
    es: "Plataforma marina y petrolera",
    en: "Offshore & oil platforms"
  },
  desc: {
    es: "Donde no hay segunda oportunidad: el dato crítico citado, sin depender de la conexión.",
    en: "Where there is no second chance: the critical datum cited, without depending on connectivity."
  }
}, {
  key: "mina",
  ic: "mountain",
  built: false,
  norm: "NOM-023",
  name: {
    es: "Minería",
    en: "Mining"
  },
  desc: {
    es: "La cuadrilla deja de esperar a «quien sabe»: pregunta y sigue trabajando.",
    en: "The crew stops waiting for “the one who knows”: ask and keep working."
  }
}, {
  key: "vial",
  ic: "traffic-cone",
  built: false,
  norm: "SCT · AASHTO",
  name: {
    es: "Construcción vial",
    en: "Road construction"
  },
  desc: {
    es: "Especificaciones y bitácoras del frente de obra, consultables desde el frente de obra.",
    en: "Specs and logs from the work front, consultable at the work front."
  }
}, {
  key: "agro",
  ic: "wheat",
  built: false,
  norm: "SENASICA · FDA",
  name: {
    es: "Agroindustria",
    en: "Agroindustry"
  },
  desc: {
    es: "Fichas y protocolos del piso de producción a media cosecha, sin volver a la oficina.",
    en: "Datasheets and protocols on the production floor mid-harvest, without going back to the office."
  }
}];
function VertGrid({
  go,
  limit
}) {
  const t = useT();
  const list = limit ? VERTS.slice(0, limit) : VERTS;
  return /*#__PURE__*/React.createElement("div", {
    className: "verts2"
  }, list.map(v => /*#__PURE__*/React.createElement("button", {
    className: "vert2",
    key: v.key,
    onClick: () => go(v.built ? "vert:" + v.key : "verticales")
  }, /*#__PURE__*/React.createElement("span", {
    className: "vi"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: v.ic,
    size: 20
  })), /*#__PURE__*/React.createElement("h3", null, t(v.name)), /*#__PURE__*/React.createElement("p", null, t(v.desc)), /*#__PURE__*/React.createElement("span", {
    className: "vfoot"
  }, /*#__PURE__*/React.createElement("span", {
    className: "norm"
  }, v.norm), v.built && /*#__PURE__*/React.createElement("span", {
    className: "varrow"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-right",
    size: 15
  }))))));
}

/* ---- paraguas transversal ---- */
function Umbrella() {
  const t = useT();
  return /*#__PURE__*/React.createElement("div", {
    className: "umb"
  }, [{
    ic: "file-check",
    h: {
      es: "Trabajo regido por documentos",
      en: "Work governed by documents"
    },
    p: {
      es: "Manuales, normas, métodos: el documento manda.",
      en: "Manuals, standards, methods: the document rules."
    }
  }, {
    ic: "alert-triangle",
    h: {
      es: "El error cuesta",
      en: "Errors cost"
    },
    p: {
      es: "Paro de línea, hallazgo, incidente. Equivocarse no es gratis.",
      en: "Downtime, findings, incidents. Mistakes aren't free."
    }
  }, {
    ic: "map-pin",
    h: {
      es: "Punto de uso lejos de la oficina",
      en: "Point of use far from the office"
    },
    p: {
      es: "El dato se necesita frente al equipo, no en el escritorio.",
      en: "The data is needed at the machine, not at the desk."
    }
  }, {
    ic: "wifi-off",
    h: {
      es: "Conectividad no garantizada",
      en: "Connectivity not guaranteed"
    },
    p: {
      es: "Campo, plataforma, mina: una barra de señal es normal.",
      en: "Field, platform, mine: one bar of signal is normal."
    }
  }, {
    ic: "user-minus",
    h: {
      es: "Fuga de conocimiento tácito",
      en: "Tacit knowledge leak"
    },
    p: {
      es: "Cuando el experto se va, su saber se va con él.",
      en: "When the expert leaves, the knowledge goes too."
    }
  }].map((u, i) => /*#__PURE__*/React.createElement("div", {
    className: "umb-item",
    key: i
  }, /*#__PURE__*/React.createElement(Icon, {
    name: u.ic,
    size: 20
  }), /*#__PURE__*/React.createElement("h3", null, t(u.h)), /*#__PURE__*/React.createElement("p", null, t(u.p)))));
}
function VerticalesHub({
  go
}) {
  const t = useT();
  return /*#__PURE__*/React.createElement("main", {
    "data-screen-label": "Verticales \u2014 Hub"
  }, /*#__PURE__*/React.createElement("header", {
    className: "page-hero"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("span", {
    className: "eyebrow"
  }, t({
    es: "Sectores",
    en: "Industries"
  })), /*#__PURE__*/React.createElement("h1", null, t({
    es: "Siete escenas, una misma firma de trabajo",
    en: "Seven scenes, one signature of work"
  })), /*#__PURE__*/React.createElement("p", {
    className: "sec-lead"
  }, t({
    es: "DOCYAN no es «para un sector»: es para un tipo de trabajo. Si tu operación comparte esta firma, te vas a reconocer en alguna de las escenas.",
    en: "DOCYAN isn't “for an industry”: it's for a kind of work. If your operation shares this signature, you'll recognize yourself in one of the scenes."
  })))), /*#__PURE__*/React.createElement("section", {
    className: "band",
    "data-screen-label": "Verticales \u2014 Paraguas"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement(Umbrella, null))), /*#__PURE__*/React.createElement("section", {
    className: "band paper",
    "data-screen-label": "Verticales \u2014 Grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "sec-title",
    style: {
      marginTop: 0
    }
  }, t({
    es: "Elige tu escena",
    en: "Pick your scene"
  })), /*#__PURE__*/React.createElement(VertGrid, {
    go: go
  }))), /*#__PURE__*/React.createElement("section", {
    className: "band",
    "data-screen-label": "Verticales \u2014 CTA"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement(Doors, {
    compact: true
  }))));
}

/* ---- detalle por vertical ---- */
const VDETAIL = {
  lab: {
    eyebrow: {
      es: "Laboratorios de pruebas · ISO 17025",
      en: "Testing laboratories · ISO 17025"
    },
    h1: {
      es: "«La calibración venció y nadie lo vio a tiempo.»",
      en: "“The calibration expired and nobody caught it in time.”"
    },
    pain: {
      es: "El hallazgo era evitable: la fecha estaba en el certificado, el certificado estaba en una carpeta, y la carpeta estaba a tres clics que nadie dio. En un laboratorio acreditado, ese descuido se llama no conformidad.",
      en: "The finding was avoidable: the date was on the certificate, the certificate was in a folder, and the folder was three clicks nobody made. In an accredited lab, that oversight is called a nonconformity."
    },
    meta: ["ISO/IEC 17025", "EMA · ILAC", {
      es: "Auditorías de acreditación",
      en: "Accreditation audits"
    }],
    tag: {
      es: "foto: mesa de laboratorio / equipo de medición",
      en: "photo: lab bench / measuring equipment"
    },
    flow: [{
      ic: "file-up",
      h: {
        es: "Métodos y certificados, vivos",
        en: "Methods and certificates, alive"
      },
      p: {
        es: "Métodos de prueba, certificados de calibración, manuales de equipo: entran una vez y quedan consultables, con su hash.",
        en: "Test methods, calibration certificates, equipment manuals: ingested once, consultable forever, with their hash."
      }
    }, {
      ic: "bell",
      h: {
        es: "La vigencia te encuentra a ti",
        en: "Validity finds you"
      },
      p: {
        es: "Alertas administrativas de vencimiento de calibraciones y revisiones de método — antes de la auditoría, no durante.",
        en: "Administrative alerts for calibration expiry and method reviews — before the audit, not during."
      }
    }, {
      ic: "quote",
      h: {
        es: "El auditor pregunta; tú citas",
        en: "The auditor asks; you cite"
      },
      p: {
        es: "«¿Con qué método se corrió esta muestra?» — respuesta con cita al span del método vigente, en segundos.",
        en: "“Which method ran this sample?” — answer with a citation to the current method's span, in seconds."
      }
    }],
    note: {
      es: "DOCYAN es capa de conocimiento, no tu sistema de registro primario: tus resultados viven en tu LIMS; aquí vive el saber que los rodea.",
      en: "DOCYAN is a knowledge layer, not your primary system of record: your results live in your LIMS; the knowledge around them lives here."
    }
  },
  maq: {
    eyebrow: {
      es: "Maquila y manufactura",
      en: "Maquila & manufacturing"
    },
    h1: {
      es: "«La línea parada, y el parámetro en cuál de los tres manuales.»",
      en: "“Line down, and the parameter in which of the three manuals.”"
    },
    pain: {
      es: "Termoformado, ensamble, inyección: el dato del proceso existe — en el manual del fabricante, en la hoja de proceso, en el instructivo que alguien actualizó. Mientras lo encuentras, la línea factura tiempo muerto.",
      en: "Thermoforming, assembly, injection: the process datum exists — in the OEM manual, the process sheet, the work instruction someone updated. While you find it, the line bills downtime."
    },
    meta: ["IATF 16949", "ISO 9001", {
      es: "Auditorías de cliente",
      en: "Customer audits"
    }],
    tag: {
      es: "foto: piso de termoformado / línea de ensamble",
      en: "photo: thermoforming floor / assembly line"
    },
    flow: [{
      ic: "file-up",
      h: {
        es: "Manuales OEM y hojas de proceso",
        en: "OEM manuals and process sheets"
      },
      p: {
        es: "El manual de 120 páginas que vino con la máquina — en el idioma en que vino — se vuelve consultable desde el piso.",
        en: "The 120-page manual that came with the machine — in whatever language it came — becomes consultable from the floor."
      }
    }, {
      ic: "message-circle-question",
      h: {
        es: "El operador pregunta en su idioma",
        en: "The operator asks in their language"
      },
      p: {
        es: "«¿Temperatura de molde para PP de 2 mm?» — respuesta de un vistazo, con la cita al manual original a un toque.",
        en: "“Mold temperature for 2 mm PP?” — at-a-glance answer, citation to the original manual one tap away."
      }
    }, {
      ic: "activity",
      h: {
        es: "El patrón queda para la planta",
        en: "The pattern stays with the plant"
      },
      p: {
        es: "Qué máquina genera más consultas, qué turno pregunta qué: frecuencia visible, sin juicios. DOCYAN cuenta, no concluye.",
        en: "Which machine drives the most queries, which shift asks what: frequency made visible, no judgments. DOCYAN counts, it doesn't conclude."
      }
    }],
    note: {
      es: "Las respuestas son capa de conocimiento para decidir mejor; los registros de producción siguen en tus sistemas de registro.",
      en: "Answers are a knowledge layer for better decisions; production records stay in your systems of record."
    }
  },
  flot: {
    eyebrow: {
      es: "Flotillas de técnicos · gasoductos / telecom",
      en: "Field technician fleets · pipelines / telecom"
    },
    h1: {
      es: "«El técnico a 200 km, y el procedimiento en el servidor de la oficina.»",
      en: "“The tech 200 km out, and the procedure on the office server.”"
    },
    pain: {
      es: "Una barra de señal, un cliente esperando y un procedimiento que vive en la intranet. La visita que se repite por falta de un dato es la más cara de todas.",
      en: "One bar of signal, a waiting client and a procedure that lives on the intranet. The site visit repeated for lack of one datum is the most expensive of all."
    },
    meta: ["ASME B31.8", "NOM-007-ASEA", {
      es: "Bitácoras de campo",
      en: "Field logs"
    }],
    tag: {
      es: "foto: técnico en derecho de vía / torre",
      en: "photo: technician at right-of-way / tower"
    },
    flow: [{
      ic: "smartphone",
      h: {
        es: "El procedimiento, en el celular",
        en: "The procedure, on the phone"
      },
      p: {
        es: "Cada técnico lleva los documentos vivos de su flotilla en el bolsillo, presentados para leerse con guantes y sol.",
        en: "Every tech carries the fleet's live documents in their pocket, presented to be read with gloves on and sun overhead."
      }
    }, {
      ic: "wifi-off",
      h: {
        es: "Pensado para una barra de señal",
        en: "Built for one bar of signal"
      },
      p: {
        es: "Las respuestas viajan ligeras: texto renderizado, no PDFs de 40 MB. El dato llega aunque la red apenas llegue.",
        en: "Answers travel light: rendered text, not 40 MB PDFs. The datum arrives even when the network barely does."
      }
    }, {
      ic: "quote",
      h: {
        es: "Cita para la bitácora",
        en: "A citation for the log"
      },
      p: {
        es: "Cada decisión de campo queda respaldada: respuesta, fuente y hash. Si después alguien pregunta «¿por qué?», está la cita.",
        en: "Every field decision is backed: answer, source and hash. If someone later asks “why?”, the citation is there."
      }
    }],
    note: {
      es: "Alertas y respuestas son capa administrativa; la operación del ducto o la red sigue en tus sistemas de control.",
      en: "Alerts and answers are an administrative layer; pipeline and network operations stay in your control systems."
    }
  }
};
function VerticalPage({
  vkey,
  go
}) {
  const t = useT();
  const d = VDETAIL[vkey];
  if (!d) return /*#__PURE__*/React.createElement(VerticalesHub, {
    go: go
  });
  const others = VERTS.filter(v => v.built && v.key !== vkey);
  const codoKey = {
    lab: "lab",
    maq: "maq"
  }[vkey] || null;
  return /*#__PURE__*/React.createElement("main", {
    "data-screen-label": "Vertical — " + vkey
  }, /*#__PURE__*/React.createElement("header", {
    className: "vpage-hero"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("span", {
    className: "eyebrow"
  }, t(d.eyebrow)), /*#__PURE__*/React.createElement("h1", null, t(d.h1)), /*#__PURE__*/React.createElement("p", {
    className: "vpain"
  }, t(d.pain)), /*#__PURE__*/React.createElement("div", {
    className: "vmeta"
  }, d.meta.map((m, i) => /*#__PURE__*/React.createElement("span", {
    key: i
  }, typeof m === "string" ? m : t(m)))))), /*#__PURE__*/React.createElement("section", {
    className: "band",
    style: {
      paddingTop: 24
    },
    "data-screen-label": "Vertical " + vkey + " — Escena"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ph",
    style: {
      aspectRatio: "21/8"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ph-tag"
  }, t(d.tag))), /*#__PURE__*/React.createElement("div", {
    className: "flow32"
  }, d.flow.map((f, i) => /*#__PURE__*/React.createElement("div", {
    className: "fnode2",
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "fn"
  }, "0" + (i + 1)), /*#__PURE__*/React.createElement("span", {
    className: "fi"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: f.ic,
    size: 20
  })), /*#__PURE__*/React.createElement("h3", null, t(f.h)), /*#__PURE__*/React.createElement("p", null, t(f.p))))), /*#__PURE__*/React.createElement("div", {
    className: "unsafe",
    style: {
      marginTop: 28
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "scale",
    size: 20
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", null, t({
    es: "La línea que no se cruza",
    en: "The line that isn't crossed"
  })), /*#__PURE__*/React.createElement("p", null, t(d.note)))), /*#__PURE__*/React.createElement("div", {
    className: "vlinks",
    style: {
      marginTop: 26
    }
  }, /*#__PURE__*/React.createElement("a", {
    className: "vlink on",
    onClick: () => go(codoKey ? "demos:" + codoKey : "demos")
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "play",
    size: 14
  }), t({
    es: "Pruébalo sin registro — CoDo de este sector",
    en: "Try it without signup — this industry's CoDo"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "vlinks"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 11,
      color: "var(--fg-subtle)",
      alignSelf: "center"
    }
  }, t({
    es: "Otras escenas:",
    en: "Other scenes:"
  })), others.map(v => /*#__PURE__*/React.createElement("a", {
    className: "vlink",
    key: v.key,
    onClick: () => go("vert:" + v.key)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: v.ic,
    size: 14
  }), t(v.name))), /*#__PURE__*/React.createElement("a", {
    className: "vlink",
    onClick: () => go("verticales")
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "layout-grid",
    size: 14
  }), t({
    es: "Todas",
    en: "All"
  }))))), /*#__PURE__*/React.createElement("section", {
    className: "band paper",
    "data-screen-label": "Vertical " + vkey + " — CTA"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cta-band"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "sec-title"
  }, t({
    es: "Pruébalo con tus propios documentos",
    en: "Try it with your own documents"
  }))), /*#__PURE__*/React.createElement(Doors, {
    compact: true
  }))));
}
Object.assign(window, {
  VerticalesHub,
  VerticalPage,
  VertGrid,
  VERTS
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/commercial-v2/verticales.jsx", error: String((e && e.message) || e) }); }

// ui_kits/platform/access.jsx
try { (() => {
/* DOCYAN — Consola del fundador. Códigos de acceso (pilotos):
   generar (cuota + vencimiento), ver existentes con estado, revocar. */

const CODE_STATE = {
  activo: {
    tone: "ok",
    icon: "circle-check",
    label: "Activo"
  },
  usado: {
    tone: "info",
    icon: "user-check",
    label: "Usado"
  },
  expirado: {
    tone: "muted",
    icon: "clock",
    label: "Expirado"
  },
  revocado: {
    tone: "danger",
    icon: "ban",
    label: "Revocado"
  }
};
function randCode() {
  const a = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return "PILOTO-" + a() + "-" + a();
}
function GeneratorCard({
  onGenerate,
  generated
}) {
  const [cuota, setCuota] = useState("50");
  const [dias, setDias] = useState("30");
  const [nota, setNota] = useState("");
  return /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "psec",
    style: {
      marginTop: 0
    }
  }, /*#__PURE__*/React.createElement("h2", null, "Generar c\xF3digo de piloto")), /*#__PURE__*/React.createElement("p", {
    className: "panel-lead"
  }, "Un c\xF3digo habilita un piloto con cuota de documentos y vencimiento. Se canjea una sola vez al crear la organizaci\xF3n."), /*#__PURE__*/React.createElement("div", {
    className: "frow"
  }, /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Cuota de documentos"), /*#__PURE__*/React.createElement("select", {
    className: "sel",
    value: cuota,
    onChange: e => setCuota(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: "25"
  }, "25 documentos"), /*#__PURE__*/React.createElement("option", {
    value: "50"
  }, "50 documentos"), /*#__PURE__*/React.createElement("option", {
    value: "100"
  }, "100 documentos"))), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Vence en"), /*#__PURE__*/React.createElement("select", {
    className: "sel",
    value: dias,
    onChange: e => setDias(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: "14"
  }, "14 d\xEDas"), /*#__PURE__*/React.createElement("option", {
    value: "30"
  }, "30 d\xEDas"), /*#__PURE__*/React.createElement("option", {
    value: "45"
  }, "45 d\xEDas"), /*#__PURE__*/React.createElement("option", {
    value: "60"
  }, "60 d\xEDas")))), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Nota interna ", /*#__PURE__*/React.createElement("span", {
    className: "hint"
  }, "opcional")), /*#__PURE__*/React.createElement("input", {
    className: "inp",
    placeholder: "Ej. piloto Lab Saltillo \u2014 referido por Delta Norte",
    value: nota,
    onChange: e => setNota(e.target.value)
  })), /*#__PURE__*/React.createElement("button", {
    className: "btn primary",
    style: {
      width: "100%"
    },
    onClick: () => onGenerate(cuota, dias)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "ticket-plus",
    size: 15
  }), "Generar c\xF3digo"), generated && /*#__PURE__*/React.createElement("div", {
    className: "code-result"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cr-lab"
  }, "C\xF3digo generado"), /*#__PURE__*/React.createElement("div", {
    className: "cr-code"
  }, generated.code), /*#__PURE__*/React.createElement("div", {
    className: "cr-meta"
  }, "Cuota ", generated.cuotaDocs, " docs \xB7 vence ", generated.vence, " \xB7 c\xF3pialo y comp\xE1rtelo con el piloto")));
}
function CodesView() {
  const [codes, setCodes] = useState(ACCESS_CODES);
  const [generated, setGenerated] = useState(null);
  const [copied, setCopied] = useState(null);
  function generate(cuota, dias) {
    const d = new Date(2026, 5, 6 + parseInt(dias, 10));
    const vence = d.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).replace(".", "");
    const nc = {
      code: randCode(),
      estado: "activo",
      cuotaDocs: parseInt(cuota, 10),
      vence,
      generado: "06 jun 2026",
      org: null,
      canjeado: null
    };
    setGenerated(nc);
    setCodes([nc, ...codes]);
  }
  function revoke(code) {
    setCodes(codes.map(c => c.code === code ? {
      ...c,
      estado: "revocado"
    } : c));
  }
  function copy(code) {
    try {
      navigator.clipboard.writeText(code);
    } catch (e) {}
    setCopied(code);
    setTimeout(() => setCopied(null), 1400);
  }
  const activos = codes.filter(c => c.estado === "activo").length;
  return /*#__PURE__*/React.createElement("div", {
    className: "pwrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "psec"
  }, /*#__PURE__*/React.createElement("h2", null, "C\xF3digos de acceso"), /*#__PURE__*/React.createElement("span", {
    className: "scount mono"
  }, activos, " activos \xB7 ", codes.length, " totales")), /*#__PURE__*/React.createElement("div", {
    className: "split"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ptbl-wrap"
  }, /*#__PURE__*/React.createElement("table", {
    className: "ptbl"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "C\xF3digo"), /*#__PURE__*/React.createElement("th", null, "Estado"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Cuota"), /*#__PURE__*/React.createElement("th", null, "Vence"), /*#__PURE__*/React.createElement("th", null, "Organizaci\xF3n"), /*#__PURE__*/React.createElement("th", null))), /*#__PURE__*/React.createElement("tbody", null, codes.map(c => {
    const s = CODE_STATE[c.estado];
    return /*#__PURE__*/React.createElement("tr", {
      key: c.code,
      className: c.estado === "expirado" || c.estado === "revocado" ? "dim" : ""
    }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
      className: "code-cell"
    }, /*#__PURE__*/React.createElement("span", {
      className: "code-mono"
    }, c.code), /*#__PURE__*/React.createElement("button", {
      className: "copybtn",
      title: "Copiar",
      onClick: () => copy(c.code)
    }, /*#__PURE__*/React.createElement(Icon, {
      name: copied === c.code ? "check" : "copy",
      size: 13
    }))), /*#__PURE__*/React.createElement("div", {
      className: "t-id"
    }, "generado ", c.generado)), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(Badge, {
      tone: s.tone,
      icon: s.icon
    }, s.label)), /*#__PURE__*/React.createElement("td", {
      className: "num t-num"
    }, c.cuotaDocs, " ", /*#__PURE__*/React.createElement("span", {
      className: "t-sub"
    }, "docs")), /*#__PURE__*/React.createElement("td", {
      className: "t-num t-sub"
    }, c.vence), /*#__PURE__*/React.createElement("td", null, c.org ? /*#__PURE__*/React.createElement("span", {
      className: "t-sub"
    }, c.org, c.canjeado ? /*#__PURE__*/React.createElement("span", {
      className: "t-id"
    }, " \xB7 canjeado ", c.canjeado) : null) : /*#__PURE__*/React.createElement("span", {
      className: "t-sub",
      style: {
        color: "var(--fg-subtle)"
      }
    }, "\u2014 sin asignar")), /*#__PURE__*/React.createElement("td", {
      style: {
        textAlign: "right"
      }
    }, c.estado === "activo" ? /*#__PURE__*/React.createElement("button", {
      className: "btn danger sm",
      onClick: () => revoke(c.code)
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "ban",
      size: 13
    }), "Revocar") : /*#__PURE__*/React.createElement("span", {
      className: "t-id"
    }, c.estado)));
  })))), /*#__PURE__*/React.createElement(GeneratorCard, {
    onGenerate: generate,
    generated: generated
  })), /*#__PURE__*/React.createElement("div", {
    className: "privacy"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "shield",
    size: 14
  }), "Los c\xF3digos otorgan acceso de piloto a la plataforma. La consola gestiona cuota y vencimiento \u2014 nunca el contenido que la organizaci\xF3n ingiere bajo ese piloto."));
}
Object.assign(window, {
  CodesView
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/platform/access.jsx", error: String((e && e.message) || e) }); }

// ui_kits/platform/app.jsx
try { (() => {
/* DOCYAN — Consola del fundador (platform_admin). Shell + navegación + montaje. */

const PNAV = [["grp", "Operación"], ["layout-dashboard", "Resumen", "resumen"], ["building-2", "Organizaciones", "orgs"], ["server", "Jobs de ingesta", "jobs", "jobsAlert"], ["grp", "Comercial"], ["ticket", "Códigos de acceso", "codigos"], ["banknote", "Ingresos", "ingresos"], ["grp", "Relación"], ["life-buoy", "Soporte", "soporte", "soporteCount"]];
const VIEW_META = {
  resumen: {
    title: "Resumen de plataforma",
    crumb: "PLATAFORMA / RESUMEN"
  },
  orgs: {
    title: "Organizaciones",
    crumb: "PLATAFORMA / ORGANIZACIONES"
  },
  jobs: {
    title: "Jobs de ingesta",
    crumb: "PLATAFORMA / JOBS"
  },
  codigos: {
    title: "Códigos de acceso",
    crumb: "PLATAFORMA / CÓDIGOS"
  },
  ingresos: {
    title: "Ingresos",
    crumb: "PLATAFORMA / INGRESOS"
  },
  soporte: {
    title: "Soporte",
    crumb: "PLATAFORMA / SOPORTE"
  }
};
function PlatformConsole() {
  const [view, setView] = useState("resumen");
  const go = v => setView(v);
  const badges = {
    jobsAlert: JOBS.filter(j => j.estado === "error").length,
    soporteCount: SUPPORT.filter(t => t.estado === "abierto").length
  };
  const meta = VIEW_META[view];
  return /*#__PURE__*/React.createElement("div", {
    className: "papp"
  }, /*#__PURE__*/React.createElement("aside", {
    className: "pside"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pslogo"
  }, /*#__PURE__*/React.createElement(Mark, {
    size: 24,
    tone: "light"
  }), /*#__PURE__*/React.createElement("span", {
    className: "w"
  }, "DOCYAN"), /*#__PURE__*/React.createElement("span", {
    className: "pl"
  }, "PLATAFORMA")), /*#__PURE__*/React.createElement("div", {
    className: "psbadge"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "shield-half",
    size: 16
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "pb-t"
  }, "platform_admin"), /*#__PURE__*/React.createElement("div", {
    className: "pb-s"
  }, "Fuera del aislamiento de cliente"))), /*#__PURE__*/React.createElement("nav", {
    className: "pnav"
  }, PNAV.map((n, i) => n[0] === "grp" ? /*#__PURE__*/React.createElement("div", {
    className: "grp",
    key: i
  }, n[1]) : /*#__PURE__*/React.createElement("a", {
    key: i,
    className: view === n[2] ? "on" : "",
    onClick: () => go(n[2])
  }, /*#__PURE__*/React.createElement(Icon, {
    name: n[0],
    size: 17
  }), n[1], n[3] && badges[n[3]] > 0 && /*#__PURE__*/React.createElement("span", {
    className: "ncount" + (n[3] === "jobsAlert" ? " alert" : "")
  }, badges[n[3]])))), /*#__PURE__*/React.createElement("div", {
    className: "psfoot"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pf-id"
  }, /*#__PURE__*/React.createElement("div", {
    className: "av"
  }, "XC"), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "pf-n"
  }, "XCID \xB7 Fundador"), /*#__PURE__*/React.createElement("div", {
    className: "pf-r"
  }, "platform_admin"))), /*#__PURE__*/React.createElement("div", {
    className: "pf-guard"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "shield-check",
    size: 13
  }), "Metadata \xB7 nunca contenido"))), /*#__PURE__*/React.createElement("div", {
    className: "pmain"
  }, /*#__PURE__*/React.createElement("header", {
    className: "ptop"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", null, meta.title)), /*#__PURE__*/React.createElement("span", {
    className: "crumb"
  }, meta.crumb), /*#__PURE__*/React.createElement("div", {
    className: "psearch"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "search",
    size: 15
  }), /*#__PURE__*/React.createElement("input", {
    placeholder: "Buscar organizaci\xF3n, c\xF3digo, job\u2026"
  })), /*#__PURE__*/React.createElement("div", {
    className: "period"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "calendar",
    size: 14
  }), PLATFORM_KPIS.periodo)), /*#__PURE__*/React.createElement("div", {
    className: "pcontent"
  }, view === "resumen" && /*#__PURE__*/React.createElement(ResumenView, {
    go: go
  }), view === "orgs" && /*#__PURE__*/React.createElement(OrgsView, {
    go: go
  }), view === "jobs" && /*#__PURE__*/React.createElement(JobsView, {
    go: go
  }), view === "codigos" && /*#__PURE__*/React.createElement(CodesView, null), view === "ingresos" && /*#__PURE__*/React.createElement(IngresosView, null), view === "soporte" && /*#__PURE__*/React.createElement(SupportView, null))));
}
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(PlatformConsole, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/platform/app.jsx", error: String((e && e.message) || e) }); }

// ui_kits/platform/atoms.jsx
try { (() => {
/* DOCYAN — Consola del fundador. Átomos compartidos + gráficas a mano. */
const {
  useState,
  useEffect,
  useRef,
  useMemo
} = React;

/* Lucide icon, rendered imperatively. */
function Icon({
  name,
  size = 18,
  color,
  style
}) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !window.lucide) return;
    el.innerHTML = "";
    const i = document.createElement("i");
    i.setAttribute("data-lucide", name);
    el.appendChild(i);
    try {
      window.lucide.createIcons({
        icons: window.lucide.icons,
        attrs: {}
      });
    } catch (e) {
      window.lucide.createIcons();
    }
  }, [name]);
  return /*#__PURE__*/React.createElement("span", {
    className: "lic",
    ref: ref,
    style: {
      width: size,
      height: size,
      color,
      ...style
    }
  });
}

/* DOCYAN bracket-frame mark. tone = ink|light. */
function Mark({
  size = 26,
  tone = "ink"
}) {
  const stroke = tone === "light" ? "var(--amate-50)" : "var(--fg)";
  const dot = tone === "light" ? "#D9633F" : "#CF4124";
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 64 64",
    fill: "none",
    "aria-label": "DOCYAN"
  }, /*#__PURE__*/React.createElement("g", {
    stroke: stroke,
    strokeWidth: "5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M13 23 V13 H23"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M41 13 H51 V23"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M51 41 V51 H41"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M23 51 H13 V41"
  })), /*#__PURE__*/React.createElement("rect", {
    x: "25.5",
    y: "25.5",
    width: "13",
    height: "13",
    rx: "3",
    fill: dot
  }));
}

/* Generic tone badge (dot + icon + text — never color alone, WCAG). */
function Badge({
  tone = "muted",
  icon,
  children,
  soft = true
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: "pbadge t-" + tone + (soft ? " soft" : "")
  }, icon ? /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 12
  }) : /*#__PURE__*/React.createElement("span", {
    className: "pdot"
  }), children);
}

/* Lifecycle status badge for an org. Shows días restantes for piloto/freemium/gracia. */
function StatusBadge({
  estado,
  dias
}) {
  const m = LIFECYCLE[estado] || LIFECYCLE.activa;
  const showDays = (estado === "piloto" || estado === "freemium" || estado === "gracia") && dias != null;
  return /*#__PURE__*/React.createElement("span", {
    className: "pbadge t-" + m.tone + " soft"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: m.icon,
    size: 12
  }), m.label, showDays && /*#__PURE__*/React.createElement("span", {
    className: "bdays mono"
  }, dias, "d"));
}

/* Plan tag. */
function PlanTag({
  plan
}) {
  const m = PLANS[plan] || PLANS.Esencial;
  return /*#__PURE__*/React.createElement("span", {
    className: "plan-tag pt-" + m.tone
  }, plan);
}

/* ── Charts (hand-built with tokens) ─────────────────────────────────────── */

/* Area + line chart over a small series. */
function AreaChart({
  data,
  w = 560,
  h = 132,
  pad = 6,
  color = "var(--accent)",
  fill = "var(--accent-weak)",
  labels,
  fmt
}) {
  const max = Math.max(...data) * 1.08,
    min = Math.min(...data) * 0.92;
  const n = data.length;
  const px = i => pad + i * (w - pad * 2) / (n - 1);
  const py = v => h - pad - 18 - (v - min) / (max - min || 1) * (h - pad * 2 - 18);
  const pts = data.map((v, i) => [px(i), py(v)]);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = line + ` L ${px(n - 1).toFixed(1)} ${(h - pad - 18).toFixed(1)} L ${px(0).toFixed(1)} ${(h - pad - 18).toFixed(1)} Z`;
  const last = data[n - 1];
  return /*#__PURE__*/React.createElement("svg", {
    className: "chart",
    viewBox: `0 0 ${w} ${h}`,
    preserveAspectRatio: "none",
    role: "img"
  }, [0.25, 0.5, 0.75].map(g => /*#__PURE__*/React.createElement("line", {
    key: g,
    x1: pad,
    x2: w - pad,
    y1: pad + (h - pad * 2 - 18) * g,
    y2: pad + (h - pad * 2 - 18) * g,
    className: "grid"
  })), /*#__PURE__*/React.createElement("path", {
    d: area,
    fill: fill
  }), /*#__PURE__*/React.createElement("path", {
    d: line,
    fill: "none",
    stroke: color,
    strokeWidth: "2.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }), pts.map((p, i) => /*#__PURE__*/React.createElement("circle", {
    key: i,
    cx: p[0],
    cy: p[1],
    r: i === n - 1 ? 3.6 : 2.2,
    fill: i === n - 1 ? color : "var(--surface)",
    stroke: color,
    strokeWidth: "1.6"
  })), labels && labels.map((l, i) => /*#__PURE__*/React.createElement("text", {
    key: i,
    x: px(i),
    y: h - 4,
    className: "clab",
    textAnchor: "middle"
  }, l)));
}

/* Vertical bar chart. */
function BarChart({
  data,
  w = 560,
  h = 132,
  pad = 6,
  color = "var(--accent)",
  labels,
  last
}) {
  const max = Math.max(...data) * 1.08;
  const n = data.length;
  const gap = 14;
  const bw = (w - pad * 2 - gap * (n - 1)) / n;
  const bh = v => v / max * (h - pad * 2 - 18);
  return /*#__PURE__*/React.createElement("svg", {
    className: "chart",
    viewBox: `0 0 ${w} ${h}`,
    preserveAspectRatio: "none",
    role: "img"
  }, [0.25, 0.5, 0.75].map(g => /*#__PURE__*/React.createElement("line", {
    key: g,
    x1: pad,
    x2: w - pad,
    y1: pad + (h - pad * 2 - 18) * g,
    y2: pad + (h - pad * 2 - 18) * g,
    className: "grid"
  })), data.map((v, i) => {
    const x = pad + i * (bw + gap),
      by = h - pad - 18 - bh(v);
    const on = i === n - 1;
    return /*#__PURE__*/React.createElement("rect", {
      key: i,
      x: x,
      y: by,
      width: bw,
      height: bh(v),
      rx: "3",
      fill: on ? color : "var(--amate-300)"
    });
  }), labels && labels.map((l, i) => /*#__PURE__*/React.createElement("text", {
    key: i,
    x: pad + i * (bw + gap) + bw / 2,
    y: h - 4,
    className: "clab",
    textAnchor: "middle"
  }, l)));
}

/* Tiny sparkline (no axes) for KPI cards. */
function Spark({
  data,
  w = 96,
  h = 30,
  color = "var(--success-600)"
}) {
  const max = Math.max(...data),
    min = Math.min(...data);
  const n = data.length;
  const px = i => i * w / (n - 1);
  const py = v => h - 3 - (v - min) / (max - min || 1) * (h - 6);
  const line = data.map((v, i) => (i ? "L" : "M") + px(i).toFixed(1) + " " + py(v).toFixed(1)).join(" ");
  return /*#__PURE__*/React.createElement("svg", {
    className: "spark",
    viewBox: `0 0 ${w} ${h}`,
    preserveAspectRatio: "none"
  }, /*#__PURE__*/React.createElement("path", {
    d: line,
    fill: "none",
    stroke: color,
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }));
}
Object.assign(window, {
  Icon,
  Mark,
  Badge,
  StatusBadge,
  PlanTag,
  AreaChart,
  BarChart,
  Spark,
  useState,
  useEffect,
  useRef,
  useMemo
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/platform/atoms.jsx", error: String((e && e.message) || e) }); }

// ui_kits/platform/data.jsx
try { (() => {
/* DOCYAN — Consola del fundador (platform_admin). Datos demo.
   PRINCIPIO: metadata sí, contenido nunca. Aquí NO hay texto de documentos
   ni de consultas de cliente — solo cifras, pesos, tiempos, estados, frecuencias. */

/* ── Ciclo de vida de una organización (estado canónico) ─────────────────── */
const LIFECYCLE = {
  activa: {
    label: "Activa",
    tone: "ok",
    icon: "circle-check"
  },
  gracia: {
    label: "Gracia",
    tone: "warn",
    icon: "clock-alert"
  },
  suspendida: {
    label: "Suspendida",
    tone: "danger",
    icon: "ban"
  },
  cancelada: {
    label: "Cancelada",
    tone: "muted",
    icon: "circle-slash-2"
  },
  piloto: {
    label: "Piloto",
    tone: "info",
    icon: "flask-conical"
  },
  freemium: {
    label: "Freemium",
    tone: "caution",
    icon: "gift"
  }
};
const PLANS = {
  Esencial: {
    tone: "muted"
  },
  Profesional: {
    tone: "info"
  },
  Enterprise: {
    tone: "ink"
  }
};

/* Banda de mercado (regional pricing) */
const BANDS = ["MX", "LatAm", "USA/CA", "UE", "UK", "AU"];

/* ── KPIs de plataforma (periodo actual) ─────────────────────────────────── */
const PLATFORM_KPIS = {
  periodo: "Junio 2026",
  orgs: {
    value: 38,
    delta: "+4",
    sub: "este periodo"
  },
  usuarios: {
    value: 1247,
    delta: "+86",
    sub: "61 admins · 1,186 colaboradores"
  },
  almacenamiento: {
    value: "2.41",
    unit: "TB",
    delta: "+0.18",
    sub: "metadata de peso · sin contenido"
  },
  jobsActivos: {
    value: 5,
    sub: "2 procesando · 3 en cola"
  },
  ingresos: {
    value: "48,200",
    unit: "USD",
    delta: "+12%",
    sub: "registrados este periodo"
  }
};

/* ── Banda crítica — lo que exige acción, arriba del todo ─────────────────── */
/* kind: danger | warn | caution | info ; cta marca acción comercial/operativa */
const CRITICAL = [{
  kind: "danger",
  icon: "ban",
  n: 1,
  label: "organización suspendida",
  detail: "Pharma Vallarta · falta de pago 18 días",
  cta: "Revisar cuenta",
  to: "orgs"
}, {
  kind: "danger",
  icon: "x-octagon",
  n: 1,
  label: "job de ingesta fallido",
  detail: "Pharma Vallarta · Certificados · fase conversión",
  cta: "Ver job",
  to: "jobs"
}, {
  kind: "warn",
  icon: "clock-alert",
  n: 2,
  label: "organizaciones en gracia",
  detail: "Farmacéutica Quálitas (5d) · Ensambles Frontera (2d)",
  cta: "Gestionar cobro",
  to: "ingresos"
}, {
  kind: "info",
  icon: "flask-conical",
  n: 2,
  label: "pilotos próximos a vencer",
  detail: "Lab Acreditado Saltillo (4d) · Centro Analítico Tijuana (12d)",
  cta: "Convertir piloto",
  to: "orgs"
}, {
  kind: "caution",
  icon: "gift",
  n: 2,
  label: "freemiums próximos a expirar",
  detail: "Bioagro del Valle (3d) · AgroBajío Semillas (8d)",
  cta: "Ofertar upgrade",
  to: "orgs"
}];

/* ── Tendencias (6 meses) — gráficas hechas a mano con tokens ─────────────── */
const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun"];
const TRENDS = {
  orgs: [24, 27, 29, 33, 35, 38],
  // crecimiento acumulado de orgs
  ingresos: [29.4, 33.1, 36.8, 41.2, 43.0, 48.2],
  // miles USD / mes
  consultas: [38, 44, 51, 58, 63, 71] // miles de consultas / mes (frecuencia, nunca causa)
};

/* ── Organizaciones ──────────────────────────────────────────────────────── */
/* dias: solo aplica a piloto/freemium/gracia (días restantes).
   Modelo actual (no prepago): cupoMes = ingestas incluidas/mes del plan ·
   cupoUsado = consumidas este mes · excedenteUSD = adicionales cobrados este ciclo
   (fórmula MAX($15,…)). Freemium no tiene cupo (límite de 3 docs vivos). */
const ORGS = [{
  id: "ORG-0042",
  name: "Maquiladora Delta Norte",
  alta: "12 ene 2025",
  plan: "Enterprise",
  banda: "MX",
  estado: "activa",
  usuarios: 64,
  docs: 1240,
  storageGB: 96.4,
  avgIngestMin: 12.1,
  cupoMes: 40,
  cupoUsado: 31,
  excedenteUSD: 0,
  consultas30d: 9840,
  proximoCorte: "01 jul 2026",
  vertical: "IMMEX · maquila"
}, {
  id: "ORG-0007",
  name: "Laboratorio Estándar de México",
  alta: "03 mar 2024",
  plan: "Profesional",
  banda: "MX",
  estado: "activa",
  usuarios: 18,
  docs: 312,
  storageGB: 18.2,
  avgIngestMin: 9.4,
  cupoMes: 10,
  cupoUsado: 7,
  excedenteUSD: 60,
  consultas30d: 4820,
  proximoCorte: "01 jul 2026",
  vertical: "Lab ISO 17025"
}, {
  id: "ORG-0019",
  name: "Minera Cerro Verde",
  alta: "21 ago 2024",
  plan: "Enterprise",
  banda: "LatAm",
  estado: "activa",
  usuarios: 52,
  docs: 980,
  storageGB: 74.0,
  avgIngestMin: 14.8,
  cupoMes: 40,
  cupoUsado: 22,
  excedenteUSD: 0,
  consultas30d: 7210,
  proximoCorte: "15 jul 2026",
  vertical: "Minería"
}, {
  id: "ORG-0031",
  name: "Farmacéutica Quálitas",
  alta: "09 oct 2024",
  plan: "Profesional",
  banda: "MX",
  estado: "gracia",
  dias: 5,
  usuarios: 24,
  docs: 540,
  storageGB: 31.6,
  avgIngestMin: 10.7,
  cupoMes: 10,
  cupoUsado: 10,
  excedenteUSD: 120,
  consultas30d: 3140,
  proximoCorte: "vencido",
  vertical: "Farma"
}, {
  id: "ORG-0050",
  name: "Ensambles Frontera",
  alta: "18 feb 2025",
  plan: "Profesional",
  banda: "USA/CA",
  estado: "gracia",
  dias: 2,
  usuarios: 21,
  docs: 410,
  storageGB: 24.1,
  avgIngestMin: 8.9,
  cupoMes: 10,
  cupoUsado: 9,
  excedenteUSD: 0,
  consultas30d: 2680,
  proximoCorte: "vencido",
  vertical: "Manufactura"
}, {
  id: "ORG-0044",
  name: "Centro Analítico Tijuana",
  alta: "02 may 2026",
  plan: "Profesional",
  banda: "USA/CA",
  estado: "piloto",
  dias: 12,
  usuarios: 9,
  docs: 86,
  storageGB: 4.8,
  avgIngestMin: 9.1,
  cupoMes: 10,
  cupoUsado: 3,
  excedenteUSD: 0,
  consultas30d: 318,
  proximoCorte: "—",
  vertical: "Lab acreditado"
}, {
  id: "ORG-0061",
  name: "Lab Acreditado Saltillo",
  alta: "20 may 2026",
  plan: "Esencial",
  banda: "MX",
  estado: "piloto",
  dias: 4,
  usuarios: 6,
  docs: 42,
  storageGB: 2.1,
  avgIngestMin: 7.6,
  cupoMes: 3,
  cupoUsado: 2,
  excedenteUSD: 0,
  consultas30d: 142,
  proximoCorte: "—",
  vertical: "Lab ISO 17025"
}, {
  id: "ORG-0058",
  name: "Laboratorio Sur",
  alta: "28 abr 2026",
  plan: "Esencial",
  banda: "MX",
  estado: "piloto",
  dias: 20,
  usuarios: 5,
  docs: 31,
  storageGB: 1.7,
  avgIngestMin: 7.2,
  cupoMes: 3,
  cupoUsado: 1,
  excedenteUSD: 0,
  consultas30d: 96,
  proximoCorte: "—",
  vertical: "Lab"
}, {
  id: "ORG-0055",
  name: "Bioagro del Valle",
  alta: "10 abr 2026",
  plan: "Esencial",
  banda: "LatAm",
  estado: "freemium",
  dias: 3,
  usuarios: 4,
  docs: 18,
  storageGB: 0.9,
  avgIngestMin: 6.8,
  cupoMes: 0,
  cupoUsado: 0,
  excedenteUSD: 0,
  consultas30d: 64,
  proximoCorte: "—",
  vertical: "Agro"
}, {
  id: "ORG-0048",
  name: "AgroBajío Semillas",
  alta: "25 mar 2026",
  plan: "Esencial",
  banda: "MX",
  estado: "freemium",
  dias: 8,
  usuarios: 7,
  docs: 26,
  storageGB: 1.3,
  avgIngestMin: 7.0,
  cupoMes: 0,
  cupoUsado: 0,
  excedenteUSD: 0,
  consultas30d: 88,
  proximoCorte: "—",
  vertical: "Agro"
}, {
  id: "ORG-0026",
  name: "IMMEX Componentes Sigma",
  alta: "14 jul 2024",
  plan: "Profesional",
  banda: "MX",
  estado: "activa",
  usuarios: 33,
  docs: 612,
  storageGB: 40.2,
  avgIngestMin: 11.2,
  cupoMes: 10,
  cupoUsado: 6,
  excedenteUSD: 0,
  consultas30d: 5120,
  proximoCorte: "08 jul 2026",
  vertical: "IMMEX"
}, {
  id: "ORG-0013",
  name: "Minería del Pacífico",
  alta: "30 jun 2024",
  plan: "Enterprise",
  banda: "LatAm",
  estado: "activa",
  usuarios: 47,
  docs: 870,
  storageGB: 68.5,
  avgIngestMin: 13.9,
  cupoMes: 40,
  cupoUsado: 28,
  excedenteUSD: 0,
  consultas30d: 6430,
  proximoCorte: "20 jul 2026",
  vertical: "Minería"
}, {
  id: "ORG-0036",
  name: "Pharma Vallarta",
  alta: "05 sep 2024",
  plan: "Esencial",
  banda: "MX",
  estado: "suspendida",
  usuarios: 11,
  docs: 154,
  storageGB: 8.6,
  avgIngestMin: 9.8,
  cupoMes: 3,
  cupoUsado: 0,
  excedenteUSD: 0,
  consultas30d: 0,
  proximoCorte: "vencido",
  vertical: "Farma"
}, {
  id: "ORG-0021",
  name: "Química Industrial Bajío",
  alta: "11 ago 2024",
  plan: "Profesional",
  banda: "MX",
  estado: "cancelada",
  usuarios: 0,
  docs: 0,
  storageGB: 0,
  avgIngestMin: 0,
  cupoMes: 0,
  cupoUsado: 0,
  excedenteUSD: 0,
  consultas30d: 0,
  proximoCorte: "—",
  vertical: "Química"
}];

/* ── Códigos de acceso (pilotos) ─────────────────────────────────────────── */
/* estado: activo | usado | expirado | revocado */
const ACCESS_CODES = [{
  code: "PILOTO-7K2M-XR4P",
  estado: "activo",
  cuotaDocs: 50,
  vence: "30 jun 2026",
  generado: "01 jun 2026",
  org: null,
  canjeado: null
}, {
  code: "PILOTO-9M1T-BR8L",
  estado: "activo",
  cuotaDocs: 50,
  vence: "15 jul 2026",
  generado: "28 may 2026",
  org: null,
  canjeado: null
}, {
  code: "PILOTO-3F9Q-LD2N",
  estado: "usado",
  cuotaDocs: 50,
  vence: "20 jun 2026",
  generado: "02 may 2026",
  org: "Centro Analítico Tijuana",
  canjeado: "02 may 2026"
}, {
  code: "PILOTO-5J7R-QW3C",
  estado: "usado",
  cuotaDocs: 50,
  vence: "10 jun 2026",
  generado: "20 abr 2026",
  org: "Lab Acreditado Saltillo",
  canjeado: "20 may 2026"
}, {
  code: "PILOTO-8H4N-ZP6K",
  estado: "expirado",
  cuotaDocs: 25,
  vence: "31 may 2026",
  generado: "01 may 2026",
  org: null,
  canjeado: null
}, {
  code: "PILOTO-2C6V-WK9D",
  estado: "revocado",
  cuotaDocs: 50,
  vence: "30 jun 2026",
  generado: "10 may 2026",
  org: null,
  canjeado: null
}, {
  code: "PILOTO-4G8B-TY1M",
  estado: "expirado",
  cuotaDocs: 50,
  vence: "25 may 2026",
  generado: "15 abr 2026",
  org: null,
  canjeado: null
}];

/* ── Ingresos (pagos manuales registrados) ───────────────────────────────── */
const PAYMENTS = [{
  fecha: "03 jun 2026",
  org: "Maquiladora Delta Norte",
  monto: 2500,
  cur: "USD",
  concepto: "Suscripción Enterprise · junio",
  metodo: "Transferencia"
}, {
  fecha: "02 jun 2026",
  org: "Minera Cerro Verde",
  monto: 2500,
  cur: "USD",
  concepto: "Suscripción Enterprise · junio",
  metodo: "Transferencia"
}, {
  fecha: "01 jun 2026",
  org: "Laboratorio Estándar de México",
  monto: 11990,
  cur: "MXN",
  concepto: "Profesional anual · cuota 6/12",
  metodo: "Transferencia"
}, {
  fecha: "01 jun 2026",
  org: "Minería del Pacífico",
  monto: 2500,
  cur: "USD",
  concepto: "Suscripción Enterprise · junio",
  metodo: "Tarjeta"
}, {
  fecha: "28 may 2026",
  org: "IMMEX Componentes Sigma",
  monto: 699,
  cur: "USD",
  concepto: "Suscripción Profesional · junio",
  metodo: "Transferencia"
}, {
  fecha: "20 may 2026",
  org: "Ensambles Frontera",
  monto: 699,
  cur: "USD",
  concepto: "Suscripción Profesional · mayo",
  metodo: "Tarjeta"
}];

/* Estado de cuenta por org (para el detalle de ingresos) */
const ACCOUNT_STATE = {
  "Maquiladora Delta Norte": {
    suscripcion: "Enterprise · al corriente",
    proximoCorte: "01 jul 2026",
    saldoVencido: 0
  },
  "Farmacéutica Quálitas": {
    suscripcion: "Profesional · en gracia",
    proximoCorte: "vencido · 09 jun",
    saldoVencido: 699
  },
  "Pharma Vallarta": {
    suscripcion: "Esencial · suspendida",
    proximoCorte: "vencido · 22 may",
    saldoVencido: 598
  }
};

/* ── Soporte (hilos cross-org) ───────────────────────────────────────────── */
/* contenido = comunicación de soporte (permitido); nunca texto de documentos/consultas */
const SUPPORT = [{
  id: "S-318",
  org: "Maquiladora Delta Norte",
  user: "R. Cantú · Admin",
  pantalla: "Admin › Ingesta",
  asunto: "Cobro de ingesta excedente no aparece en la factura",
  estado: "abierto",
  prioridad: "alta",
  ultima: "hace 14 min",
  hilo: [{
    from: "user",
    t: "Confirmé 4 ingestas adicionales la semana pasada y no veo el cargo reflejado en la facturación. ¿Lo pueden revisar?",
    at: "Hoy · 09:42"
  }]
}, {
  id: "S-317",
  org: "Farmacéutica Quálitas",
  user: "J. Medina · Admin",
  pantalla: "Admin › Gobernanza & FAT",
  asunto: "Umbral GRG no guarda cambios",
  estado: "abierto",
  prioridad: "media",
  ultima: "hace 1 h",
  hilo: [{
    from: "user",
    t: "Cambio el umbral de Seguridad a 0.97 y al recargar vuelve a 0.95. No persiste.",
    at: "Hoy · 08:55"
  }]
}, {
  id: "S-315",
  org: "Centro Analítico Tijuana",
  user: "A. Ríos · Colaborador",
  pantalla: "PWA › Consulta",
  asunto: "El QR abre el CoDo equivocado",
  estado: "respondido",
  prioridad: "alta",
  ultima: "ayer",
  hilo: [{
    from: "user",
    t: "El QR de la balanza AB204 me lleva al CoDo de centrífugas. ¿Lo revisan?",
    at: "Ayer · 16:10"
  }, {
    from: "soporte",
    t: "Detectado: el QR se generó apuntando a la entidad incorrecta. Lo regeneramos y queda corregido. Reimprime desde Admin › Generar QRs.",
    at: "Ayer · 17:02"
  }]
}, {
  id: "S-312",
  org: "IMMEX Componentes Sigma",
  user: "L. Peña · Admin",
  pantalla: "Commercial › Cuenta",
  asunto: "Factura de mayo con RFC incorrecto",
  estado: "respondido",
  prioridad: "baja",
  ultima: "hace 3 d",
  hilo: [{
    from: "user",
    t: "La factura de mayo salió con un RFC viejo. ¿Pueden reemitir?",
    at: "03 jun · 11:20"
  }, {
    from: "soporte",
    t: "Reemitida con el RFC actualizado. Te llegó al correo de facturación.",
    at: "03 jun · 14:40"
  }]
}, {
  id: "S-309",
  org: "Minera Cerro Verde",
  user: "D. Kim · Admin",
  pantalla: "Admin › Usuarios",
  asunto: "Invitación de admin no llega",
  estado: "cerrado",
  prioridad: "media",
  ultima: "hace 5 d",
  hilo: [{
    from: "user",
    t: "Invité a un admin y el correo no llega. Revisé spam.",
    at: "01 jun · 09:00"
  }, {
    from: "soporte",
    t: "El dominio bloqueaba el remitente. Lo agregamos a la lista segura y reenviamos. Confirmado recibido.",
    at: "01 jun · 10:30"
  }]
}];

/* ── Jobs de ingesta cross-org (metadata operativa, en vivo) ──────────────── */
/* estado: procesando | encolado | completado | error ; fase: descarga|conversion|extraccion|grafo|dedup */
const JOBS = [{
  id: "JOB-7741",
  org: "Maquiladora Delta Norte",
  lote: "Lote MSDS (×6)",
  estado: "procesando",
  fase: "extraccion",
  pct: 62,
  docs: 6,
  transcurrido: "4:12",
  eta: "2:40"
}, {
  id: "JOB-7740",
  org: "Minera Cerro Verde",
  lote: "Histórico perforación",
  estado: "procesando",
  fase: "grafo",
  pct: 84,
  docs: 3,
  transcurrido: "6:31",
  eta: "1:05"
}, {
  id: "JOB-7742",
  org: "Laboratorio Estándar de México",
  lote: "Manual CNC Haas VF-2",
  estado: "encolado",
  fase: null,
  pct: 0,
  docs: 1,
  transcurrido: "—",
  eta: "en cola · 1"
}, {
  id: "JOB-7743",
  org: "IMMEX Componentes Sigma",
  lote: "Certificados calidad (×4)",
  estado: "encolado",
  fase: null,
  pct: 0,
  docs: 4,
  transcurrido: "—",
  eta: "en cola · 2"
}, {
  id: "JOB-7739",
  org: "Minería del Pacífico",
  lote: "Planos eléctricos (×2)",
  estado: "encolado",
  fase: null,
  pct: 0,
  docs: 2,
  transcurrido: "—",
  eta: "en cola · 3"
}, {
  id: "JOB-7738",
  org: "Pharma Vallarta",
  lote: "Certificados",
  estado: "error",
  fase: "conversion",
  pct: 18,
  docs: 2,
  transcurrido: "0:48",
  eta: "—",
  error: "PDF protegido · OCR rechazado"
}, {
  id: "JOB-7737",
  org: "Centro Analítico Tijuana",
  lote: "Manuales de equipo (×3)",
  estado: "completado",
  fase: "dedup",
  pct: 100,
  docs: 3,
  transcurrido: "21:04",
  eta: "—"
}, {
  id: "JOB-7736",
  org: "Laboratorio Sur",
  lote: "MSDS reactivos (×2)",
  estado: "completado",
  fase: "dedup",
  pct: 100,
  docs: 2,
  transcurrido: "13:22",
  eta: "—"
}];
const PHASE_LABELS = {
  descarga: "Descarga",
  conversion: "Conversión",
  extraccion: "Extracción",
  grafo: "Escritura a grafo",
  dedup: "Deduplicación"
};
Object.assign(window, {
  LIFECYCLE,
  PLANS,
  BANDS,
  PLATFORM_KPIS,
  CRITICAL,
  MONTHS,
  TRENDS,
  ORGS,
  ACCESS_CODES,
  PAYMENTS,
  ACCOUNT_STATE,
  SUPPORT,
  JOBS,
  PHASE_LABELS
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/platform/data.jsx", error: String((e && e.message) || e) }); }

// ui_kits/platform/ingresos.jsx
try { (() => {
/* DOCYAN — Consola del fundador. Ingresos:
   registrar pago manual (org, monto, moneda, concepto), historial,
   estado de cuenta por org (pagos, suscripción, próxima fecha de corte). */

function fmtMoney(n, cur) {
  const v = n.toLocaleString("en-US");
  return cur === "MXN" ? "MXN " + v : "$" + v;
}
function RegisterPayment({
  onAdd
}) {
  const [org, setOrg] = useState("");
  const [monto, setMonto] = useState("");
  const [cur, setCur] = useState("USD");
  const [concepto, setConcepto] = useState("");
  const ok = org && monto && concepto;
  return /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "psec",
    style: {
      marginTop: 0
    }
  }, /*#__PURE__*/React.createElement("h2", null, "Registrar pago manual")), /*#__PURE__*/React.createElement("p", {
    className: "panel-lead"
  }, "Cobro manual durante el piloto. Queda en el historial y actualiza el estado de cuenta de la organizaci\xF3n."), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Organizaci\xF3n"), /*#__PURE__*/React.createElement("select", {
    className: "sel",
    value: org,
    onChange: e => setOrg(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Selecciona organizaci\xF3n\u2026"), ORGS.filter(o => o.estado !== "cancelada").map(o => /*#__PURE__*/React.createElement("option", {
    key: o.id,
    value: o.name
  }, o.name)))), /*#__PURE__*/React.createElement("div", {
    className: "frow"
  }, /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Monto"), /*#__PURE__*/React.createElement("input", {
    className: "inp mono",
    inputMode: "decimal",
    placeholder: "0.00",
    value: monto,
    onChange: e => setMonto(e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Moneda"), /*#__PURE__*/React.createElement("select", {
    className: "sel",
    value: cur,
    onChange: e => setCur(e.target.value)
  }, /*#__PURE__*/React.createElement("option", null, "USD"), /*#__PURE__*/React.createElement("option", null, "MXN"), /*#__PURE__*/React.createElement("option", null, "EUR"), /*#__PURE__*/React.createElement("option", null, "GBP"), /*#__PURE__*/React.createElement("option", null, "AUD")))), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Concepto"), /*#__PURE__*/React.createElement("input", {
    className: "inp",
    placeholder: "Ej. Suscripci\xF3n Profesional \xB7 junio",
    value: concepto,
    onChange: e => setConcepto(e.target.value)
  })), /*#__PURE__*/React.createElement("button", {
    className: "btn primary",
    style: {
      width: "100%"
    },
    disabled: !ok,
    onClick: () => {
      onAdd({
        fecha: "06 jun 2026",
        org,
        monto: parseFloat(monto) || 0,
        cur,
        concepto,
        metodo: "Transferencia"
      });
      setOrg("");
      setMonto("");
      setConcepto("");
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 15
  }), "Registrar pago"));
}
function IngresosView() {
  const [payments, setPayments] = useState(PAYMENTS);
  const [acctOrg, setAcctOrg] = useState("Farmacéutica Quálitas");
  const totalUSD = payments.filter(p => p.cur === "USD").reduce((s, p) => s + p.monto, 0);
  const acct = ACCOUNT_STATE[acctOrg];
  const acctPayments = payments.filter(p => p.org === acctOrg);
  return /*#__PURE__*/React.createElement("div", {
    className: "pwrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "psec"
  }, /*#__PURE__*/React.createElement("h2", null, "Ingresos"), /*#__PURE__*/React.createElement("span", {
    className: "scount mono"
  }, PLATFORM_KPIS.periodo)), /*#__PURE__*/React.createElement("div", {
    className: "kpis",
    style: {
      gridTemplateColumns: "repeat(3, 1fr)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "kpi"
  }, /*#__PURE__*/React.createElement("div", {
    className: "kpi-l"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "banknote",
    size: 13
  }), "Registrado (USD)"), /*#__PURE__*/React.createElement("div", {
    className: "kpi-v"
  }, "$", totalUSD.toLocaleString("en-US")), /*#__PURE__*/React.createElement("div", {
    className: "kpi-foot"
  }, /*#__PURE__*/React.createElement("div", {
    className: "kpi-d"
  }, payments.filter(p => p.cur === "USD").length, " pagos este periodo"))), /*#__PURE__*/React.createElement("div", {
    className: "kpi"
  }, /*#__PURE__*/React.createElement("div", {
    className: "kpi-l"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "clock-alert",
    size: 13
  }), "Saldo vencido"), /*#__PURE__*/React.createElement("div", {
    className: "kpi-v",
    style: {
      color: "var(--danger-600)"
    }
  }, "$1,297"), /*#__PURE__*/React.createElement("div", {
    className: "kpi-foot"
  }, /*#__PURE__*/React.createElement("div", {
    className: "kpi-d"
  }, "2 orgs en gracia \xB7 1 suspendida"))), /*#__PURE__*/React.createElement("div", {
    className: "kpi"
  }, /*#__PURE__*/React.createElement("div", {
    className: "kpi-l"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "repeat",
    size: 13
  }), "MRR estimado"), /*#__PURE__*/React.createElement("div", {
    className: "kpi-v"
  }, "$11,400"), /*#__PURE__*/React.createElement("div", {
    className: "kpi-foot"
  }, /*#__PURE__*/React.createElement("div", {
    className: "kpi-d"
  }, "suscripciones activas recurrentes")))), /*#__PURE__*/React.createElement("div", {
    className: "split",
    style: {
      marginTop: 18
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "psec",
    style: {
      marginTop: 0
    }
  }, /*#__PURE__*/React.createElement("h2", null, "Historial de pagos"), /*#__PURE__*/React.createElement("span", {
    className: "scount mono"
  }, payments.length)), /*#__PURE__*/React.createElement("div", {
    className: "ptbl-wrap"
  }, /*#__PURE__*/React.createElement("table", {
    className: "ptbl"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Fecha"), /*#__PURE__*/React.createElement("th", null, "Organizaci\xF3n"), /*#__PURE__*/React.createElement("th", null, "Concepto"), /*#__PURE__*/React.createElement("th", null, "M\xE9todo"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Monto"))), /*#__PURE__*/React.createElement("tbody", null, payments.map((p, i) => /*#__PURE__*/React.createElement("tr", {
    key: i
  }, /*#__PURE__*/React.createElement("td", {
    className: "t-num t-sub"
  }, p.fecha), /*#__PURE__*/React.createElement("td", {
    className: "t-name",
    style: {
      fontWeight: 600
    }
  }, p.org), /*#__PURE__*/React.createElement("td", {
    className: "t-sub"
  }, p.concepto), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("span", {
    className: "t-sub"
  }, p.metodo)), /*#__PURE__*/React.createElement("td", {
    className: "num t-num",
    style: {
      fontWeight: 600
    }
  }, fmtMoney(p.monto, p.cur), " ", /*#__PURE__*/React.createElement("span", {
    className: "t-sub",
    style: {
      fontWeight: 400
    }
  }, p.cur)))))))), /*#__PURE__*/React.createElement(RegisterPayment, {
    onAdd: p => setPayments([p, ...payments])
  })), /*#__PURE__*/React.createElement("div", {
    className: "psec",
    style: {
      marginTop: 24
    }
  }, /*#__PURE__*/React.createElement("h2", null, "Estado de cuenta por organizaci\xF3n")), /*#__PURE__*/React.createElement("div", {
    className: "acct-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "field",
    style: {
      maxWidth: 380,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("label", null, "Organizaci\xF3n"), /*#__PURE__*/React.createElement("select", {
    className: "sel",
    value: acctOrg,
    onChange: e => setAcctOrg(e.target.value)
  }, Object.keys(ACCOUNT_STATE).map(n => /*#__PURE__*/React.createElement("option", {
    key: n
  }, n)))), acct && /*#__PURE__*/React.createElement("div", {
    className: "split-bal"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "acct-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "al"
  }, "Suscripci\xF3n"), /*#__PURE__*/React.createElement("span", {
    className: "av"
  }, acct.suscripcion)), /*#__PURE__*/React.createElement("div", {
    className: "acct-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "al"
  }, "Pr\xF3xima fecha de corte"), /*#__PURE__*/React.createElement("span", {
    className: "av mono",
    style: acct.proximoCorte.startsWith("vencido") ? {
      color: "var(--danger-600)"
    } : null
  }, acct.proximoCorte)), /*#__PURE__*/React.createElement("div", {
    className: "acct-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "al"
  }, "Saldo vencido"), /*#__PURE__*/React.createElement("span", {
    className: "av mono",
    style: acct.saldoVencido > 0 ? {
      color: "var(--danger-600)"
    } : {
      color: "var(--success-600)"
    }
  }, "$", acct.saldoVencido.toLocaleString("en-US"), " USD"))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "t-id",
    style: {
      marginBottom: 8,
      fontSize: 10.5,
      letterSpacing: ".1em",
      textTransform: "uppercase"
    }
  }, "Pagos de esta org"), acctPayments.length ? acctPayments.map((p, i) => /*#__PURE__*/React.createElement("div", {
    className: "acct-row",
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "al"
  }, p.fecha, " \xB7 ", p.concepto), /*#__PURE__*/React.createElement("span", {
    className: "av mono"
  }, fmtMoney(p.monto, p.cur)))) : /*#__PURE__*/React.createElement("div", {
    className: "t-sub"
  }, "Sin pagos registrados este periodo.")))));
}
Object.assign(window, {
  IngresosView
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/platform/ingresos.jsx", error: String((e && e.message) || e) }); }

// ui_kits/platform/jobs.jsx
try { (() => {
/* DOCYAN — Consola del fundador. Jobs de ingesta cross-org (metadata operativa).
   org, estado, fase, progreso, tiempo — en vivo. Nunca el contenido del documento. */

const JOB_STATE = {
  procesando: {
    tone: "info",
    label: "Procesando"
  },
  encolado: {
    tone: "muted",
    label: "En cola"
  },
  completado: {
    tone: "ok",
    label: "Completado"
  },
  error: {
    tone: "danger",
    label: "Error"
  }
};
const PHASE_ORDER = ["descarga", "conversion", "extraccion", "grafo", "dedup"];
function JobsView({
  go
}) {
  const [jobs, setJobs] = useState(JOBS);

  /* Tic en vivo: los jobs en proceso avanzan; el feedback respira. Cosmético —
     en producción esto se sustituye por SSE/polling del backend (ver INGESTA-HANDOFF). */
  useEffect(() => {
    const id = setInterval(() => {
      setJobs(prev => prev.map(j => {
        if (j.estado !== "procesando") return j;
        let pct = j.pct + Math.random() * 2.4;
        let fase = j.fase;
        if (pct >= 100) {
          pct = 8;
          const idx = (PHASE_ORDER.indexOf(j.fase) + 1) % PHASE_ORDER.length;
          fase = PHASE_ORDER[idx];
        }
        return {
          ...j,
          pct,
          fase
        };
      }));
    }, 1100);
    return () => clearInterval(id);
  }, []);
  const counts = {
    procesando: jobs.filter(j => j.estado === "procesando").length,
    encolado: jobs.filter(j => j.estado === "encolado").length,
    error: jobs.filter(j => j.estado === "error").length,
    completado: jobs.filter(j => j.estado === "completado").length
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "pwrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "psec"
  }, /*#__PURE__*/React.createElement("h2", null, "Jobs de ingesta"), /*#__PURE__*/React.createElement("span", {
    className: "live-tag",
    style: {
      marginLeft: "auto"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "live-dot"
  }), "En vivo \xB7 cross-org")), /*#__PURE__*/React.createElement("div", {
    className: "kpis",
    style: {
      gridTemplateColumns: "repeat(4, 1fr)",
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "kpi"
  }, /*#__PURE__*/React.createElement("div", {
    className: "kpi-l"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "loader",
    size: 13
  }), "Procesando"), /*#__PURE__*/React.createElement("div", {
    className: "kpi-v"
  }, counts.procesando)), /*#__PURE__*/React.createElement("div", {
    className: "kpi"
  }, /*#__PURE__*/React.createElement("div", {
    className: "kpi-l"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "list-ordered",
    size: 13
  }), "En cola"), /*#__PURE__*/React.createElement("div", {
    className: "kpi-v"
  }, counts.encolado)), /*#__PURE__*/React.createElement("div", {
    className: "kpi"
  }, /*#__PURE__*/React.createElement("div", {
    className: "kpi-l"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x-octagon",
    size: 13
  }), "Con error"), /*#__PURE__*/React.createElement("div", {
    className: "kpi-v",
    style: {
      color: counts.error ? "var(--danger-600)" : "var(--fg)"
    }
  }, counts.error)), /*#__PURE__*/React.createElement("div", {
    className: "kpi"
  }, /*#__PURE__*/React.createElement("div", {
    className: "kpi-l"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "circle-check",
    size: 13
  }), "Completados hoy"), /*#__PURE__*/React.createElement("div", {
    className: "kpi-v"
  }, counts.completado))), /*#__PURE__*/React.createElement("div", {
    className: "ptbl-wrap"
  }, /*#__PURE__*/React.createElement("table", {
    className: "ptbl"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Job"), /*#__PURE__*/React.createElement("th", null, "Organizaci\xF3n"), /*#__PURE__*/React.createElement("th", null, "Estado"), /*#__PURE__*/React.createElement("th", null, "Fase"), /*#__PURE__*/React.createElement("th", null, "Progreso"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Docs"), /*#__PURE__*/React.createElement("th", null, "Tiempo"), /*#__PURE__*/React.createElement("th", null))), /*#__PURE__*/React.createElement("tbody", null, jobs.map(j => {
    const s = JOB_STATE[j.estado];
    const barCls = j.estado === "completado" ? "done" : j.estado === "error" ? "err" : "";
    return /*#__PURE__*/React.createElement("tr", {
      key: j.id,
      className: j.estado === "completado" ? "dim" : ""
    }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
      className: "t-id",
      style: {
        fontSize: 12,
        fontWeight: 600,
        color: "var(--fg)"
      }
    }, j.id), /*#__PURE__*/React.createElement("div", {
      className: "t-sub"
    }, j.lote)), /*#__PURE__*/React.createElement("td", {
      className: "t-name",
      style: {
        fontWeight: 600
      }
    }, j.org), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(Badge, {
      tone: s.tone,
      icon: j.estado === "procesando" ? "loader" : j.estado === "error" ? "x" : j.estado === "completado" ? "check" : "clock"
    }, s.label)), /*#__PURE__*/React.createElement("td", null, j.fase ? /*#__PURE__*/React.createElement("span", {
      className: "phase-tag"
    }, /*#__PURE__*/React.createElement("span", {
      className: "pix",
      style: {
        background: j.estado === "error" ? "var(--danger-600)" : "var(--accent)"
      }
    }), PHASE_LABELS[j.fase]) : /*#__PURE__*/React.createElement("span", {
      className: "t-sub",
      style: {
        color: "var(--fg-subtle)"
      }
    }, "\u2014"), j.estado === "error" && j.error && /*#__PURE__*/React.createElement("div", {
      className: "job-err"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "alert-triangle",
      size: 12
    }), j.error)), /*#__PURE__*/React.createElement("td", null, j.estado === "encolado" ? /*#__PURE__*/React.createElement("span", {
      className: "t-sub"
    }, j.eta) : /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "job-bar"
    }, /*#__PURE__*/React.createElement("i", {
      className: barCls,
      style: {
        width: Math.round(j.pct) + "%"
      }
    })), /*#__PURE__*/React.createElement("span", {
      className: "t-num t-sub"
    }, Math.round(j.pct), "%"))), /*#__PURE__*/React.createElement("td", {
      className: "num t-num"
    }, j.docs), /*#__PURE__*/React.createElement("td", {
      className: "t-num t-sub"
    }, j.estado === "procesando" ? /*#__PURE__*/React.createElement(React.Fragment, null, j.transcurrido, " \xB7 queda ", j.eta) : j.transcurrido), /*#__PURE__*/React.createElement("td", {
      style: {
        textAlign: "right"
      }
    }, j.estado === "error" ? /*#__PURE__*/React.createElement("button", {
      className: "btn ghost sm",
      onClick: () => go("soporte")
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "external-link",
      size: 13
    }), "Revisar") : /*#__PURE__*/React.createElement(Icon, {
      name: "more-horizontal",
      size: 16,
      color: "var(--fg-subtle)"
    })));
  })))), /*#__PURE__*/React.createElement("div", {
    className: "privacy"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "shield",
    size: 14
  }), "Solo metadata operativa: organizaci\xF3n, estado, fase y tiempo. La consola del fundador nunca ve el contenido de los documentos que estos jobs procesan."));
}
Object.assign(window, {
  JobsView
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/platform/jobs.jsx", error: String((e && e.message) || e) }); }

// ui_kits/platform/orgs.jsx
try { (() => {
/* DOCYAN — Consola del fundador. Organizaciones: tabla + detalle de org.
   Detalle = peso de almacenamiento, nº docs, tiempo de ingesta, cupo de ingestas/excedente,
   frecuencia de consultas (número, nunca causa). Metadata, nunca contenido. */

const ORG_FILTERS = [["todas", "Todas"], ["activa", "Activas"], ["gracia", "Gracia"], ["suspendida", "Suspendidas"], ["piloto", "Pilotos"], ["freemium", "Freemium"], ["cancelada", "Canceladas"]];
function OrgsTable({
  open
}) {
  const [filter, setFilter] = useState("todas");
  const [q, setQ] = useState("");
  const rows = ORGS.filter(o => (filter === "todas" || o.estado === filter) && (q === "" || o.name.toLowerCase().includes(q.toLowerCase()) || o.id.toLowerCase().includes(q.toLowerCase())));
  const counts = f => f === "todas" ? ORGS.length : ORGS.filter(o => o.estado === f).length;
  return /*#__PURE__*/React.createElement("div", {
    className: "pwrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "psec"
  }, /*#__PURE__*/React.createElement("h2", null, "Organizaciones"), /*#__PURE__*/React.createElement("span", {
    className: "scount mono"
  }, ORGS.length, " totales")), /*#__PURE__*/React.createElement("div", {
    className: "filters"
  }, ORG_FILTERS.map(([k, l]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    className: "fpill" + (filter === k ? " on" : ""),
    onClick: () => setFilter(k)
  }, l, /*#__PURE__*/React.createElement("span", {
    className: "fc"
  }, counts(k)))), /*#__PURE__*/React.createElement("div", {
    className: "fsearch"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "search",
    size: 14
  }), /*#__PURE__*/React.createElement("input", {
    placeholder: "Buscar org o ID\u2026",
    value: q,
    onChange: e => setQ(e.target.value)
  }))), /*#__PURE__*/React.createElement("div", {
    className: "ptbl-wrap"
  }, /*#__PURE__*/React.createElement("table", {
    className: "ptbl"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Organizaci\xF3n"), /*#__PURE__*/React.createElement("th", null, "Alta"), /*#__PURE__*/React.createElement("th", null, "Plan"), /*#__PURE__*/React.createElement("th", null, "Banda"), /*#__PURE__*/React.createElement("th", null, "Estado"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Usuarios"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Docs"), /*#__PURE__*/React.createElement("th", null))), /*#__PURE__*/React.createElement("tbody", null, rows.map(o => /*#__PURE__*/React.createElement("tr", {
    key: o.id,
    className: "clik" + (o.estado === "cancelada" ? " dim" : ""),
    onClick: () => open(o.id)
  }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
    className: "t-name"
  }, o.name), /*#__PURE__*/React.createElement("div", {
    className: "t-id"
  }, o.id, " \xB7 ", o.vertical)), /*#__PURE__*/React.createElement("td", {
    className: "t-sub"
  }, o.alta), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(PlanTag, {
    plan: o.plan
  })), /*#__PURE__*/React.createElement("td", {
    className: "t-num t-sub"
  }, o.banda), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(StatusBadge, {
    estado: o.estado,
    dias: o.dias
  })), /*#__PURE__*/React.createElement("td", {
    className: "num t-num"
  }, o.usuarios), /*#__PURE__*/React.createElement("td", {
    className: "num t-num"
  }, o.docs.toLocaleString("en-US")), /*#__PURE__*/React.createElement("td", {
    className: "chev-cell"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-right",
    size: 16
  }))))))));
}
function OrgDetail({
  org,
  back,
  go
}) {
  const o = org;
  const cupoPct = o.cupoMes ? Math.min(100, Math.round(o.cupoUsado / o.cupoMes * 100)) : 0;
  const barTone = cupoPct >= 95 ? "danger" : cupoPct >= 75 ? "warn" : "";
  const initials = o.name.split(" ").slice(0, 2).map(w => w[0]).join("");
  return /*#__PURE__*/React.createElement("div", {
    className: "pwrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "back-row"
  }, /*#__PURE__*/React.createElement("button", {
    className: "linkbtn",
    onClick: back
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-left",
    size: 15
  }), "Organizaciones")), /*#__PURE__*/React.createElement("div", {
    className: "od-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "od-mark"
  }, initials), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "od-name"
  }, o.name), /*#__PURE__*/React.createElement("div", {
    className: "od-meta"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mid"
  }, o.id), /*#__PURE__*/React.createElement("span", {
    className: "sep"
  }, "\xB7"), /*#__PURE__*/React.createElement(PlanTag, {
    plan: o.plan
  }), /*#__PURE__*/React.createElement(StatusBadge, {
    estado: o.estado,
    dias: o.dias
  }), /*#__PURE__*/React.createElement("span", {
    className: "sep"
  }, "\xB7"), /*#__PURE__*/React.createElement("span", {
    className: "mline"
  }, o.vertical, " \xB7 banda ", o.banda, " \xB7 alta ", o.alta))), /*#__PURE__*/React.createElement("div", {
    className: "od-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn ghost sm",
    onClick: () => go("ingresos")
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "receipt",
    size: 14
  }), "Estado de cuenta"), /*#__PURE__*/React.createElement("button", {
    className: "btn ghost sm",
    onClick: () => go("soporte")
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "life-buoy",
    size: 14
  }), "Soporte"))), /*#__PURE__*/React.createElement("div", {
    className: "metric-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "metric"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ml"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "hard-drive",
    size: 13
  }), "Peso de almacenamiento"), /*#__PURE__*/React.createElement("div", {
    className: "mv"
  }, o.storageGB, /*#__PURE__*/React.createElement("span", {
    className: "u"
  }, "GB")), /*#__PURE__*/React.createElement("div", {
    className: "ms"
  }, o.docs.toLocaleString("en-US"), " documentos \xB7 metadata de peso")), /*#__PURE__*/React.createElement("div", {
    className: "metric"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ml"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "files",
    size: 13
  }), "Documentos vivos"), /*#__PURE__*/React.createElement("div", {
    className: "mv"
  }, o.docs.toLocaleString("en-US")), /*#__PURE__*/React.createElement("div", {
    className: "ms"
  }, o.usuarios, " usuarios con acceso")), /*#__PURE__*/React.createElement("div", {
    className: "metric"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ml"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "timer",
    size: 13
  }), "Tiempo prom. de ingesta"), /*#__PURE__*/React.createElement("div", {
    className: "mv"
  }, o.avgIngestMin, /*#__PURE__*/React.createElement("span", {
    className: "u"
  }, "min")), /*#__PURE__*/React.createElement("div", {
    className: "ms"
  }, "por documento \xB7 \xFAltimos 30 d")), /*#__PURE__*/React.createElement("div", {
    className: "metric"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ml"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "activity",
    size: 13
  }), "Frecuencia de consultas"), /*#__PURE__*/React.createElement("div", {
    className: "mv"
  }, o.consultas30d.toLocaleString("en-US")), /*#__PURE__*/React.createElement("div", {
    className: "ms"
  }, "consultas / 30 d \xB7 frecuencia, no causa"))), /*#__PURE__*/React.createElement("div", {
    className: "split-bal",
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "psec",
    style: {
      marginTop: 0
    }
  }, /*#__PURE__*/React.createElement("h2", null, "Cupo de ingestas")), o.cupoMes > 0 ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "bal-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "bal-v mono"
  }, o.cupoMes - o.cupoUsado), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      color: "var(--fg-muted)"
    }
  }, "de ", o.cupoMes, " restantes este mes")), /*#__PURE__*/React.createElement("div", {
    className: "bar"
  }, /*#__PURE__*/React.createElement("i", {
    className: barTone,
    style: {
      width: cupoPct + "%"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: "var(--fg-muted)",
      marginTop: 8
    }
  }, "Usadas ", /*#__PURE__*/React.createElement("b", {
    className: "mono"
  }, o.cupoUsado), " de ", /*#__PURE__*/React.createElement("b", {
    className: "mono"
  }, o.cupoMes), " \xB7 adicionales este ciclo ", /*#__PURE__*/React.createElement("b", {
    className: "mono"
  }, "$", o.excedenteUSD.toLocaleString("en-US")))) : /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: "var(--fg-muted)",
      padding: "4px 0"
    }
  }, "Freemium \xB7 sin cupo de ingestas (l\xEDmite de 3 documentos vivos).")), /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "psec",
    style: {
      marginTop: 0
    }
  }, /*#__PURE__*/React.createElement("h2", null, "Suscripci\xF3n")), /*#__PURE__*/React.createElement("div", {
    className: "acct-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "al"
  }, "Plan"), /*#__PURE__*/React.createElement("span", {
    className: "av"
  }, o.plan, " \xB7 banda ", o.banda)), /*#__PURE__*/React.createElement("div", {
    className: "acct-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "al"
  }, "Estado de ciclo de vida"), /*#__PURE__*/React.createElement("span", {
    className: "av"
  }, /*#__PURE__*/React.createElement(StatusBadge, {
    estado: o.estado,
    dias: o.dias
  }))), /*#__PURE__*/React.createElement("div", {
    className: "acct-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "al"
  }, "Pr\xF3xima fecha de corte"), /*#__PURE__*/React.createElement("span", {
    className: "av mono" + (o.proximoCorte === "vencido" ? "" : ""),
    style: o.proximoCorte === "vencido" ? {
      color: "var(--danger-600)"
    } : null
  }, o.proximoCorte)))), /*#__PURE__*/React.createElement("div", {
    className: "privacy"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "shield",
    size: 14
  }), "Vista de metadata operativa. DOCYAN nunca expone el texto de los documentos de ", o.name, " ni el contenido de sus consultas \u2014 solo pesos, tiempos, estados y frecuencias."));
}
function OrgsView({
  go
}) {
  const [openId, setOpenId] = useState(null);
  const org = openId ? ORGS.find(o => o.id === openId) : null;
  if (org) return /*#__PURE__*/React.createElement(OrgDetail, {
    org: org,
    back: () => setOpenId(null),
    go: go
  });
  return /*#__PURE__*/React.createElement(OrgsTable, {
    open: setOpenId
  });
}
Object.assign(window, {
  OrgsView
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/platform/orgs.jsx", error: String((e && e.message) || e) }); }

// ui_kits/platform/resumen.jsx
try { (() => {
/* DOCYAN — Consola del fundador. Resumen de plataforma:
   banda crítica (acción) arriba → KPIs de un vistazo → tendencias. */

function CriticalBand({
  go
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      borderColor: "var(--cinnabar-200)",
      background: "linear-gradient(180deg, #FEFBF8, var(--surface) 60%)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "crit-head"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "siren",
    size: 18
  }), /*#__PURE__*/React.createElement("span", {
    className: "ct"
  }, "Requiere acci\xF3n"), /*#__PURE__*/React.createElement("span", {
    className: "cs"
  }, "\xB7 estado cr\xEDtico y oportunidades comerciales con fecha l\xEDmite")), /*#__PURE__*/React.createElement("div", {
    className: "crit-grid"
  }, CRITICAL.map((c, i) => /*#__PURE__*/React.createElement("div", {
    className: "crit-card k-" + c.kind,
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    className: "crit-ic"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: c.icon,
    size: 16
  })), /*#__PURE__*/React.createElement("div", {
    className: "crit-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "crit-t"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cn mono"
  }, c.n), c.label), /*#__PURE__*/React.createElement("div", {
    className: "crit-d"
  }, c.detail), /*#__PURE__*/React.createElement("button", {
    className: "crit-cta",
    onClick: () => go(c.to)
  }, c.cta, /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-right",
    size: 13
  })))))));
}
function KpiCards() {
  const k = PLATFORM_KPIS;
  return /*#__PURE__*/React.createElement("div", {
    className: "kpis"
  }, /*#__PURE__*/React.createElement("div", {
    className: "kpi"
  }, /*#__PURE__*/React.createElement("div", {
    className: "kpi-l"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "building-2",
    size: 13
  }), "Organizaciones"), /*#__PURE__*/React.createElement("div", {
    className: "kpi-v"
  }, k.orgs.value), /*#__PURE__*/React.createElement("div", {
    className: "kpi-foot"
  }, /*#__PURE__*/React.createElement("div", {
    className: "kpi-d"
  }, /*#__PURE__*/React.createElement("span", {
    className: "up"
  }, "\u25B2 ", k.orgs.delta), " ", k.orgs.sub), /*#__PURE__*/React.createElement(Spark, {
    data: TRENDS.orgs,
    color: "var(--success-600)"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "kpi"
  }, /*#__PURE__*/React.createElement("div", {
    className: "kpi-l"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "users",
    size: 13
  }), "Usuarios"), /*#__PURE__*/React.createElement("div", {
    className: "kpi-v"
  }, k.usuarios.value.toLocaleString("en-US")), /*#__PURE__*/React.createElement("div", {
    className: "kpi-foot"
  }, /*#__PURE__*/React.createElement("div", {
    className: "kpi-d"
  }, /*#__PURE__*/React.createElement("span", {
    className: "up"
  }, "\u25B2 ", k.usuarios.delta), " ", k.usuarios.sub))), /*#__PURE__*/React.createElement("div", {
    className: "kpi"
  }, /*#__PURE__*/React.createElement("div", {
    className: "kpi-l"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "hard-drive",
    size: 13
  }), "Almacenamiento"), /*#__PURE__*/React.createElement("div", {
    className: "kpi-v"
  }, k.almacenamiento.value, /*#__PURE__*/React.createElement("span", {
    className: "u"
  }, k.almacenamiento.unit)), /*#__PURE__*/React.createElement("div", {
    className: "kpi-foot"
  }, /*#__PURE__*/React.createElement("div", {
    className: "kpi-d"
  }, /*#__PURE__*/React.createElement("span", {
    className: "up"
  }, "\u25B2 ", k.almacenamiento.delta, " TB"), " ", k.almacenamiento.sub))), /*#__PURE__*/React.createElement("div", {
    className: "kpi"
  }, /*#__PURE__*/React.createElement("div", {
    className: "kpi-l"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "loader",
    size: 13
  }), "Jobs activos"), /*#__PURE__*/React.createElement("div", {
    className: "kpi-v"
  }, k.jobsActivos.value), /*#__PURE__*/React.createElement("div", {
    className: "kpi-foot"
  }, /*#__PURE__*/React.createElement("div", {
    className: "kpi-d"
  }, k.jobsActivos.sub))), /*#__PURE__*/React.createElement("div", {
    className: "kpi"
  }, /*#__PURE__*/React.createElement("div", {
    className: "kpi-l"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "banknote",
    size: 13
  }), "Ingresos"), /*#__PURE__*/React.createElement("div", {
    className: "kpi-v",
    style: {
      fontSize: 22
    }
  }, "$", k.ingresos.value, /*#__PURE__*/React.createElement("span", {
    className: "u"
  }, k.ingresos.unit)), /*#__PURE__*/React.createElement("div", {
    className: "kpi-foot"
  }, /*#__PURE__*/React.createElement("div", {
    className: "kpi-d"
  }, /*#__PURE__*/React.createElement("span", {
    className: "up"
  }, "\u25B2 ", k.ingresos.delta), " ", k.ingresos.sub), /*#__PURE__*/React.createElement(Spark, {
    data: TRENDS.ingresos,
    color: "var(--accent)"
  }))));
}
function Trends() {
  return /*#__PURE__*/React.createElement("div", {
    className: "trends"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tcard"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tcard-h"
  }, /*#__PURE__*/React.createElement("span", {
    className: "tcard-t"
  }, "Crecimiento de organizaciones"), /*#__PURE__*/React.createElement("span", {
    className: "tcard-v"
  }, TRENDS.orgs.at(-1))), /*#__PURE__*/React.createElement(AreaChart, {
    data: TRENDS.orgs,
    labels: MONTHS,
    color: "var(--success-600)",
    fill: "rgba(44,122,87,.10)"
  })), /*#__PURE__*/React.createElement("div", {
    className: "tcard"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tcard-h"
  }, /*#__PURE__*/React.createElement("span", {
    className: "tcard-t"
  }, "Ingresos por mes"), /*#__PURE__*/React.createElement("span", {
    className: "tcard-v"
  }, "$", TRENDS.ingresos.at(-1), "K", /*#__PURE__*/React.createElement("span", {
    className: "u"
  }, "USD"))), /*#__PURE__*/React.createElement(BarChart, {
    data: TRENDS.ingresos,
    labels: MONTHS,
    color: "var(--accent)"
  })), /*#__PURE__*/React.createElement("div", {
    className: "tcard"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tcard-h"
  }, /*#__PURE__*/React.createElement("span", {
    className: "tcard-t"
  }, "Consultas de plataforma"), /*#__PURE__*/React.createElement("span", {
    className: "tcard-v"
  }, TRENDS.consultas.at(-1), "K")), /*#__PURE__*/React.createElement(AreaChart, {
    data: TRENDS.consultas,
    labels: MONTHS,
    color: "var(--info-600)",
    fill: "rgba(62,110,120,.10)"
  })));
}
function ResumenView({
  go
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "pwrap"
  }, /*#__PURE__*/React.createElement(CriticalBand, {
    go: go
  }), /*#__PURE__*/React.createElement("div", {
    className: "psec"
  }, /*#__PURE__*/React.createElement("span", {
    className: "eb"
  }, "Estado de plataforma"), /*#__PURE__*/React.createElement("span", {
    className: "scount mono"
  }, PLATFORM_KPIS.periodo)), /*#__PURE__*/React.createElement(KpiCards, null), /*#__PURE__*/React.createElement("div", {
    className: "psec",
    style: {
      marginTop: 22
    }
  }, /*#__PURE__*/React.createElement("h2", null, "Tendencias"), /*#__PURE__*/React.createElement("span", {
    className: "more",
    onClick: () => go("orgs")
  }, "Ver organizaciones \u2192")), /*#__PURE__*/React.createElement(Trends, null), /*#__PURE__*/React.createElement("div", {
    className: "privacy",
    style: {
      marginTop: 18
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "shield",
    size: 14
  }), "Metadata s\xED, contenido nunca. La consola muestra n\xFAmeros, pesos, tiempos, estados y frecuencias \u2014 jam\xE1s el texto de un documento ni de una consulta de cliente."));
}
Object.assign(window, {
  ResumenView
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/platform/resumen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/platform/support.jsx
try { (() => {
/* DOCYAN — Consola del fundador. Soporte:
   bandeja unificada cross-org con contexto (org, usuario, pantalla de origen) + responder. */

const SUP_STATE = {
  abierto: {
    tone: "warn",
    label: "Abierto"
  },
  respondido: {
    tone: "info",
    label: "Respondido"
  },
  cerrado: {
    tone: "ok",
    label: "Cerrado"
  }
};
const SUP_PRIO = {
  alta: "danger",
  media: "warn",
  baja: "muted"
};
function SupportView() {
  const [threads, setThreads] = useState(SUPPORT);
  const [sel, setSel] = useState(SUPPORT[0].id);
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState("todos");
  const visible = threads.filter(t => filter === "todos" || (filter === "abiertos" ? t.estado === "abierto" : t.estado !== "abierto"));
  const active = threads.find(t => t.id === sel) || visible[0];
  function send() {
    if (!draft.trim()) return;
    setThreads(threads.map(t => t.id === active.id ? {
      ...t,
      estado: "respondido",
      ultima: "ahora",
      hilo: [...t.hilo, {
        from: "soporte",
        t: draft.trim(),
        at: "Hoy · ahora"
      }]
    } : t));
    setDraft("");
  }
  const abiertos = threads.filter(t => t.estado === "abierto").length;
  return /*#__PURE__*/React.createElement("div", {
    className: "pwrap",
    style: {
      maxWidth: "none"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "psec"
  }, /*#__PURE__*/React.createElement("h2", null, "Soporte"), /*#__PURE__*/React.createElement("span", {
    className: "scount mono"
  }, abiertos, " abiertos \xB7 ", threads.length, " hilos")), /*#__PURE__*/React.createElement("div", {
    className: "filters",
    style: {
      marginBottom: 14
    }
  }, [["todos", "Todos"], ["abiertos", "Abiertos"], ["resueltos", "Resueltos"]].map(([k, l]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    className: "fpill" + (filter === k ? " on" : ""),
    onClick: () => setFilter(k)
  }, l))), /*#__PURE__*/React.createElement("div", {
    className: "support-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sup-list"
  }, visible.map(t => {
    const s = SUP_STATE[t.estado];
    return /*#__PURE__*/React.createElement("div", {
      key: t.id,
      className: "sup-item" + (active && active.id === t.id ? " on" : ""),
      onClick: () => setSel(t.id)
    }, /*#__PURE__*/React.createElement("div", {
      className: "si-top"
    }, /*#__PURE__*/React.createElement("span", {
      className: "prio-dot t-" + SUP_PRIO[t.prioridad],
      title: "Prioridad " + t.prioridad
    }), /*#__PURE__*/React.createElement("span", {
      className: "si-org"
    }, t.org), /*#__PURE__*/React.createElement("span", {
      className: "si-time"
    }, t.ultima)), /*#__PURE__*/React.createElement("div", {
      className: "si-subj"
    }, t.asunto), /*#__PURE__*/React.createElement("div", {
      className: "si-foot"
    }, /*#__PURE__*/React.createElement("span", {
      className: "sup-ctx-pill"
    }, t.pantalla), /*#__PURE__*/React.createElement(Badge, {
      tone: s.tone
    }, s.label), /*#__PURE__*/React.createElement("span", {
      className: "si-id"
    }, t.id)));
  })), active && /*#__PURE__*/React.createElement("div", {
    className: "sup-thread"
  }, /*#__PURE__*/React.createElement("div", {
    className: "st-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sth-org"
  }, active.org), /*#__PURE__*/React.createElement("div", {
    className: "sth-subj"
  }, active.asunto), /*#__PURE__*/React.createElement("div", {
    className: "st-ctx"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ctx"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cl"
  }, "Usuario"), /*#__PURE__*/React.createElement("span", {
    className: "cv"
  }, active.user)), /*#__PURE__*/React.createElement("div", {
    className: "ctx"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cl"
  }, "Pantalla de origen"), /*#__PURE__*/React.createElement("span", {
    className: "cv"
  }, active.pantalla)), /*#__PURE__*/React.createElement("div", {
    className: "ctx"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cl"
  }, "Prioridad"), /*#__PURE__*/React.createElement("span", {
    className: "cv"
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: SUP_PRIO[active.prioridad]
  }, active.prioridad))), /*#__PURE__*/React.createElement("div", {
    className: "ctx"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cl"
  }, "Estado"), /*#__PURE__*/React.createElement("span", {
    className: "cv"
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: SUP_STATE[active.estado].tone
  }, SUP_STATE[active.estado].label))))), /*#__PURE__*/React.createElement("div", {
    className: "st-body"
  }, active.hilo.map((m, i) => /*#__PURE__*/React.createElement("div", {
    className: "msg " + m.from,
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    className: "mb"
  }, m.t), /*#__PURE__*/React.createElement("div", {
    className: "mt"
  }, m.from === "soporte" ? "DOCYAN soporte" : active.user.split(" · ")[0], " \xB7 ", m.at)))), /*#__PURE__*/React.createElement("div", {
    className: "st-reply"
  }, /*#__PURE__*/React.createElement("textarea", {
    placeholder: "Responder al hilo\u2026",
    value: draft,
    onChange: e => setDraft(e.target.value),
    onKeyDown: e => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn primary",
    onClick: send,
    disabled: !draft.trim()
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "send-horizontal",
    size: 15
  }), "Enviar")))), /*#__PURE__*/React.createElement("div", {
    className: "privacy",
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "shield",
    size: 14
  }), "El contexto del hilo es metadata (org, usuario, pantalla de origen). DOCYAN nunca adjunta el contenido del documento ni de la consulta que origin\xF3 el reporte."));
}
Object.assign(window, {
  SupportView
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/platform/support.jsx", error: String((e && e.message) || e) }); }

})();
