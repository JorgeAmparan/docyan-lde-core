import { describe, it, expect } from "vitest";
import {
  citaLabel,
  citaToSource,
  errorAnswer,
  mapResueltaToAnswer,
  type ConsultaResuelta,
} from "@/app/(app)/consult/consult-data";

/** B9.5 §2.1 — el mapeo deriva el kind del DISCRIMINADOR `payload.kind`. */

function envelope(payloadKind: string): ConsultaResuelta {
  return {
    tipo_intencion: "x",
    score: 1,
    ruta: "r",
    metodo: "heuristico",
    cruces: [],
    degradado: false,
    // minimal valid payloads per kind
    payload: { kind: payloadKind, titulo: "t" } as unknown as ConsultaResuelta["payload"],
  } as ConsultaResuelta;
}

describe("mapResueltaToAnswer", () => {
  const cases: Array<[string, string]> = [
    ["info_card", "info"],
    ["procedure_card", "steps"],
    ["diagram_viewer", "diagram"],
    ["video_player", "video"],
    ["diagnostic_tree", "troubleshoot"],
    ["timeline", "history"],
    ["alerts_dashboard", "alerts"],
    ["comparative_view", "compare"],
  ];
  it.each(cases)("maps payload.kind %s → answer kind %s", (pk, ak) => {
    expect(mapResueltaToAnswer(envelope(pk), "q").kind).toBe(ak);
  });

  it("uses cache mode when contexto_ccp.cache_hit", () => {
    const e = envelope("info_card");
    e.contexto_ccp = { modo_respuesta: "cache_hit", cache_hit: true, costo_estimado_centavos: 0, latencia_ms: 0 };
    expect(mapResueltaToAnswer(e, "q").mode).toBe("cache");
  });
});

describe("citation helpers", () => {
  it("builds a label doc · § · p.N", () => {
    expect(citaLabel({ documento_nombre: "Manual", seccion: "§4", pagina: 12 })).toBe("Manual · §4 · p.12");
  });
  it("returns null for empty cita", () => {
    expect(citaLabel(null)).toBeNull();
    expect(citaLabel({})).toBeNull();
  });
  it("builds a source overlay from a cita", () => {
    const s = citaToSource({ documento_nombre: "Manual", seccion: "§4", pagina: 12 });
    expect(s?.title).toBe("Manual");
    expect(s?.ref).toContain("§4");
  });
});

describe("errorAnswer", () => {
  it("is kind error with the message", () => {
    const a = errorAnswer("q", "boom");
    expect(a.kind).toBe("error");
    expect(a.errorMsg).toBe("boom");
  });
});
