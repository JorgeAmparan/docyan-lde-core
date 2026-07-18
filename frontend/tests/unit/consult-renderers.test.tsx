import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { InformativaCard } from "@/app/(app)/consult/renderers/informativa-card";
import { GuiaPasoAPaso } from "@/app/(app)/consult/renderers/guia-paso-a-paso";
import { GraficosViewer } from "@/app/(app)/consult/renderers/graficos-viewer";
import { VideoPlayer } from "@/app/(app)/consult/renderers/video-player";
import { TroubleshootingTree } from "@/app/(app)/consult/renderers/troubleshooting-tree";
import { HistorialTimeline } from "@/app/(app)/consult/renderers/historial-timeline";
import { AlertasDashboard } from "@/app/(app)/consult/renderers/alertas-dashboard";
import { ComparativaView } from "@/app/(app)/consult/renderers/comparativa-view";
import { BilingualAlignment } from "@/app/(app)/consult/renderers/bilingual-alignment";
import type {
  AlertsDashboardPayload,
  BilingualAlignmentPayload,
  ComparativeViewPayload,
  DiagnosticTreePayload,
  DiagramViewerPayload,
  InfoCardPayload,
  ProcedureCardPayload,
  TimelinePayload,
  VideoPlayerPayload,
} from "@/app/(app)/consult/consult-data";

const noop = () => {};

/**
 * B9.5 §2 — las 8 tarjetas consumen el PAYLOAD REAL tipado contra OpenAPI (no
 * constantes locales). Cada test pasa el shape del backend y verifica que el dato
 * (y la cita) se rendericen.
 */

describe("Tipo 1 · InformativaCard", () => {
  it("renders value, unit and the real citation", () => {
    const payload: InfoCardPayload = {
      kind: "info_card",
      titulo: "Torque del perno B",
      match_multiple: false,
      especificaciones: [
        {
          nombre: "Torque",
          valor: "85",
          unidad: "N·m",
          cita: { documento_nombre: "Manual Rotina 380", seccion: "§4.2.1", pagina: 12 },
        },
      ],
      citas: [{ documento_nombre: "Manual Rotina 380", seccion: "§4.2.1", pagina: 12 }],
    };
    render(<InformativaCard payload={payload} saved={false} onSave={noop} onCite={noop} />);
    expect(screen.getByText("85")).toBeInTheDocument();
    expect(screen.getByText("N·m")).toBeInTheDocument();
    expect(screen.getByText(/Manual Rotina 380 · §4\.2\.1 · p\.12/)).toBeInTheDocument();
  });
});

describe("Tipo 2 · GuiaPasoAPaso", () => {
  it("renders steps, EPP and citation", () => {
    const payload: ProcedureCardPayload = {
      kind: "procedure_card",
      titulo: "Cambio de filtro",
      modo_ejecutar_paso_a_paso: false,
      pasos: [
        { orden: 1, descripcion: "Despresuriza el circuito.", epp: ["Guantes"], herramientas: ["Llave"], advertencias: ["No abrir presurizado."], precondiciones: [], postcondiciones: [] },
      ],
      citas: [{ documento_nombre: "Manual Rotina 380" }],
    };
    render(<GuiaPasoAPaso payload={payload} saved={false} onSave={noop} onCite={noop} />);
    expect(screen.getByText("Despresuriza el circuito.")).toBeInTheDocument();
    expect(screen.getByText("Guantes")).toBeInTheDocument();
    expect(screen.getByText(/No abrir presurizado/)).toBeInTheDocument();
    expect(screen.getByText(/Manual Rotina 380/)).toBeInTheDocument();
  });
});

describe("Tipo 3 · GraficosViewer", () => {
  it("renders labels from the payload (no hardcoded pins)", () => {
    const payload: DiagramViewerPayload = {
      kind: "diagram_viewer",
      titulo: "Rotor y cabezal",
      recurso_url: "https://x/rotor.png",
      etiquetas: [{ texto: "Tapa del rotor", x: 0.33, y: 0.26 }],
      leyenda_simbolica: [{ simbolo: "⚠", significado: "Punto caliente" }],
      citas: [],
    };
    render(<GraficosViewer payload={payload} saved={false} onSave={noop} onCite={noop} />);
    expect(screen.getByText("Tapa del rotor")).toBeInTheDocument();
    expect(screen.getByText(/Punto caliente/)).toBeInTheDocument();
  });
});

describe("Tipo 4 · VideoPlayer", () => {
  it("renders the video resource and chapters", () => {
    const payload: VideoPlayerPayload = {
      kind: "video_player",
      titulo: "Montaje del rotor",
      video_url: "https://x/clip.mp4",
      capitulos: [{ titulo: "Preparación", inicio_seg: 0 }],
      subtitulos: [],
      subtitulos_disponibles_en_par_activo: false,
      citas: [],
    };
    render(<VideoPlayer payload={payload} saved={false} onSave={noop} onCite={noop} />);
    expect(screen.getByText("Montaje del rotor")).toBeInTheDocument();
    expect(screen.getByText("Preparación")).toBeInTheDocument();
  });
});

describe("Tipo 5 · TroubleshootingTree", () => {
  it("renders the node question and option labels", () => {
    const payload: DiagnosticTreePayload = {
      kind: "diagnostic_tree",
      titulo: "No arranca",
      nodo_actual_id: "n1",
      pregunta: "¿Enciende el panel?",
      opciones: [
        { etiqueta: "Sí", siguiente_nodo_id: "n2" },
        { etiqueta: "No", siguiente_nodo_id: "n3" },
      ],
      es_hoja: false,
      citas: [],
    };
    render(<TroubleshootingTree payload={payload} saved={false} onSave={noop} onCite={noop} onNavigate={noop} />);
    expect(screen.getByText("¿Enciende el panel?")).toBeInTheDocument();
    expect(screen.getByText("Sí")).toBeInTheDocument();
    expect(screen.getByText("No")).toBeInTheDocument();
  });
});

describe("Tipo 6 · HistorialTimeline", () => {
  it("renders events from the payload", () => {
    const payload: TimelinePayload = {
      kind: "timeline",
      titulo: "Historial",
      eventos: [{ tipo: "consulta", descripcion: "Torque del perno B", timestamp: "2026-06-08" }],
      certificados_vigencia: [],
      observaciones: [],
      mediciones: [],
      patrones_edb: { consultas_frecuentes: ["torque"], problemas_recurrentes: [], observaciones_acumuladas: [] },
      citas: [],
    };
    render(<HistorialTimeline payload={payload} saved={false} onSave={noop} />);
    expect(screen.getByText("Torque del perno B")).toBeInTheDocument();
  });
});

describe("Tipo 7 · AlertasDashboard — línea ABSOLUTA §11.1", () => {
  const payload: AlertsDashboardPayload = {
    kind: "alerts_dashboard",
    titulo: "Alertas",
    solo_administrativas: true,
    alertas: [
      { descripcion: "Calibración vence el 2026-06-20", fecha_vencimiento: "2026-06-20", urgencia: "alta", administrativa: true },
      { descripcion: "MSDS expira el 2026-07-01", fecha_vencimiento: "2026-07-01", urgencia: "media", administrativa: true },
    ],
    citas: [],
  };

  it("renders the mandatory administrative-only banner", () => {
    render(<AlertasDashboard payload={payload} saved={false} onSave={vi.fn()} onCite={vi.fn()} />);
    expect(
      screen.getByText(/Recordatorios administrativos\. No constituyen instrucciones operativas ni clínicas/i),
    ).toBeInTheDocument();
  });

  it("never uses ANSI danger red — only warn/caution severities", () => {
    const { container } = render(<AlertasDashboard payload={payload} saved={false} onSave={vi.fn()} onCite={vi.fn()} />);
    const cards = container.querySelectorAll(".al-card");
    expect(cards.length).toBeGreaterThan(0);
    cards.forEach((c) => {
      expect(c.className).not.toContain("danger");
      expect(c.className).toMatch(/s-(warn|caution)/);
    });
  });

  it("shows the source citation per alert (.al-cite) when the backend provides one", () => {
    const conCita: AlertsDashboardPayload = {
      ...payload,
      alertas: [
        {
          descripcion: "Calibración vence el 2026-06-20",
          fecha_vencimiento: "2026-06-20",
          urgencia: "alta",
          administrativa: true,
          cita: { documento_nombre: "Certificado de calibración", pagina: 2 },
        },
      ],
    };
    render(<AlertasDashboard payload={conCita} saved={false} onSave={vi.fn()} onCite={vi.fn()} />);
    expect(screen.getByText(/Certificado de calibración · p\.2/)).toBeInTheDocument();
  });
});

describe("Tipo 8 · ComparativaView", () => {
  it("renders field diffs and flags safety changes", () => {
    const payload: ComparativeViewPayload = {
      kind: "comparative_view",
      titulo: "Rev C vs D",
      estrategia: "versiones_documento",
      referencia_izquierda: "rev-c",
      referencia_derecha: "rev-d",
      diferencias: [
        { campo: "Torque", valor_izquierda: "80", valor_derecha: "85", es_cambio_seguridad: true },
      ],
      cacheada: false,
      computo_asincrono: false,
      citas: [],
    };
    render(<ComparativaView payload={payload} saved={false} onSave={noop} onCite={noop} />);
    expect(screen.getByText(/Torque/)).toBeInTheDocument();
    expect(screen.getByText(/relevantes para seguridad/)).toBeInTheDocument();
  });
});

describe("Tipo 9 · BilingualAlignment — memoria_traduccion (Pista B)", () => {
  it("renders aligned source↔target segments and the terminology lock", () => {
    const payload: BilingualAlignmentPayload = {
      kind: "bilingual_alignment",
      titulo: "Memoria de traducción · en-US → es-MX",
      par_linguistico: "en-US → es-MX",
      desde_memoria: true,
      lock_terminologico_activo: true,
      segmentos: [
        {
          texto_origen: "Stop the machine and apply lock-out/tag-out before service.",
          texto_destino: "Detén la máquina y aplica bloqueo/etiquetado (LOTO) antes del servicio.",
          idioma_origen: "en-US",
          idioma_destino: "es-MX",
          tipo_segmento: "advertencia",
          lock: [{ termino_origen: "lock-out/tag-out", termino_destino: "bloqueo/etiquetado (LOTO)" }],
          cita: { documento_nombre: "Memoria de traducción", fragmento: "Stop the machine and apply lock-out/tag-out before service." },
        },
      ],
      citas: [{ documento_nombre: "Memoria de traducción", fragmento: "Stop the machine and apply lock-out/tag-out before service." }],
    };
    render(<BilingualAlignment payload={payload} saved={false} onSave={noop} onCite={noop} />);
    expect(screen.getByText(/Stop the machine and apply lock-out\/tag-out/)).toBeInTheDocument();
    expect(screen.getByText(/Detén la máquina y aplica bloqueo\/etiquetado/)).toBeInTheDocument();
    expect(screen.getByText("EN-US")).toBeInTheDocument();
    expect(screen.getByText("ES-MX")).toBeInTheDocument();
    // Lock terminológico (candado) — equivalencia fijada.
    expect(screen.getByText("bloqueo/etiquetado (LOTO)")).toBeInTheDocument();
    expect(screen.getByText(/equivalencias fijadas/)).toBeInTheDocument();
  });

  it("is honest when there is no memory for the pair (no invented equivalences)", () => {
    const payload: BilingualAlignmentPayload = {
      kind: "bilingual_alignment",
      titulo: "Memoria de traducción · en-US → es-MX",
      par_linguistico: "en-US → es-MX",
      desde_memoria: false,
      lock_terminologico_activo: false,
      segmentos: [],
      citas: [],
    };
    render(<BilingualAlignment payload={payload} saved={false} onSave={noop} onCite={noop} />);
    expect(screen.getByText(/No hay memoria de traducción para el par/)).toBeInTheDocument();
    expect(screen.queryByText("EN-US")).not.toBeInTheDocument();
  });
});
