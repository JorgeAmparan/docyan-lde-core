"use client";

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Icon } from "@/components/icon";
import { DocyanMark } from "@/components/brand/docyan-mark";
import { QrFrame } from "@/components/brand/qr-frame";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

/**
 * First-run onboarding wizard (7 steps, from access.jsx OnboardingView).
 * URL drives the step (/onboarding/1..7). Progress is persisted best-effort via
 * PATCH /orgs/{id}/onboarding-state. Final step → /admin.
 */

const STEPS = [
  { slug: "welcome", icon: "sparkles", title: "Bienvenido a DOCYAN", lead: "Vamos a dejar tus documentos vivos en unos minutos. Siete pasos para tu primer CoDo consultable." },
  { slug: "org", icon: "building-2", title: "Nombra tu organización", lead: "Así identificamos tu cuenta y tus pares lingüísticos por defecto." },
  { slug: "codo", icon: "folder-tree", title: "Crea tu primer CoDo", lead: "Un CoDo es un contexto documental coherente — un equipo y todos sus documentos." },
  { slug: "ingest", icon: "upload-cloud", title: "Ingiere tu primer documento", lead: "Súbelo como está. Te mostramos el costo estimado antes de procesar." },
  { slug: "qr", icon: "qr-code", title: "Genera tu primer QR", lead: "Imprímelo y pégalo en el equipo. Es la puerta del colaborador al CoDo." },
  { slug: "ask", icon: "scan-line", title: "Haz tu primera consulta", lead: "Escanea, pregunta y recibe respuesta con cita a la fuente exacta." },
  { slug: "invite", icon: "users", title: "Invita a tus colaboradores", lead: "Ilimitados y sin costo. Entran escaneando — no necesitan cuenta." },
] as const;

const VERTICALS = [
  ["laboratorio", "Laboratorio ISO 17025"],
  ["maquiladora", "Maquiladora IMMEX"],
  ["pharma", "Farmacéutica"],
  ["mining", "Minería"],
  ["agribusiness", "Agroindustria"],
  ["agencia", "Agencia de traducción"],
  ["otro", "Otro"],
] as const;

const wizardSchema = z.object({
  orgName: z.string().min(2, "Ingresa el nombre de tu organización"),
  langPair: z.string(),
  codoName: z.string().min(2, "Nombra tu primer CoDo"),
  vertical: z.string(),
  criticidad: z.enum(["auto", "manual"]),
  invites: z.string(),
});
type WizardForm = z.infer<typeof wizardSchema>;

export default function OnboardingStepPage({ params }: { params: Promise<{ step: string }> }) {
  const { step: stepParam } = use(params);
  const router = useRouter();
  const orgId = useAuth((s) => s.user?.org_id);

  const stepIndex = useMemo(() => {
    const n = Number(stepParam);
    if (Number.isFinite(n) && n >= 1 && n <= STEPS.length) return n - 1;
    return 0;
  }, [stepParam]);

  const cur = STEPS[stepIndex];
  const last = stepIndex === STEPS.length - 1;
  const [docFile, setDocFile] = useState<string | null>(null);

  const form = useForm<WizardForm>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      orgName: "Laboratorio Estándar SA de CV",
      langPair: "ES-MX · EN-US",
      codoName: "Centrífugas & rotores",
      vertical: "laboratorio",
      criticidad: "auto",
      invites: "",
    },
  });

  const persist = useMutation({
    // best-effort progress persistence
    mutationFn: (next: number) =>
      api.patch(`/orgs/${orgId ?? "me"}/onboarding-state`, {
        step: next + 1,
        completed: next >= STEPS.length - 1,
        ...form.getValues(),
      }),
  });

  function goto(next: number) {
    persist.mutate(next); // fire-and-forget; never blocks navigation
    if (next > STEPS.length - 1) {
      router.push("/admin");
      return;
    }
    router.push(`/onboarding/${next + 1}`);
  }

  return (
    <div className="onboard">
      <aside className="onb-rail">
        <div className="login-brand sm">
          <DocyanMark size={26} tone="light" />
          <span className="lw">
            DOCYAN<span className="lde">LDE</span>
          </span>
        </div>
        <div className="onb-steps">
          {STEPS.map((s, i) => (
            <div
              key={s.slug}
              className={"onb-step" + (i === stepIndex ? " on" : "") + (i < stepIndex ? " done" : "")}
              onClick={() => router.push(`/onboarding/${i + 1}`)}
            >
              <span className="osn">{i < stepIndex ? <Icon name="check" size={13} /> : i + 1}</span>
              {s.title}
            </div>
          ))}
        </div>
        <div className="onb-prog mono">
          {stepIndex + 1} / {STEPS.length}
        </div>
      </aside>

      <div className="onb-main">
        <div className="onb-card">
          <div className="onb-ic">
            <Icon name={cur.icon} size={30} />
          </div>
          <h1>{cur.title}</h1>
          <p className="onb-lead">{cur.lead}</p>

          <div className="onb-body">
            {cur.slug === "welcome" && (
              <div className="onb-hl">
                <div className="hl">
                  <Icon name="zap" size={18} />
                  <span>Time-to-value en días, no meses</span>
                </div>
                <div className="hl">
                  <Icon name="file-check" size={18} />
                  <span>Ingiere tus documentos como están</span>
                </div>
                <div className="hl">
                  <Icon name="link" size={18} />
                  <span>Cada respuesta cita su fuente exacta</span>
                </div>
              </div>
            )}

            {cur.slug === "org" && (
              <>
                <div className="field2">
                  <label>Organización</label>
                  <input {...form.register("orgName")} />
                  {form.formState.errors.orgName && (
                    <span style={{ fontSize: 12, color: "var(--warning-600)" }}>
                      {form.formState.errors.orgName.message}
                    </span>
                  )}
                </div>
                <div className="field2">
                  <label>Par lingüístico por defecto</label>
                  <Select value={form.watch("langPair")} onValueChange={(v) => form.setValue("langPair", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ES-MX · EN-US">ES-MX · EN-US</SelectItem>
                      <SelectItem value="EN-US · ES-MX">EN-US · ES-MX</SelectItem>
                      <SelectItem value="ES-ES · EN-GB">ES-ES · EN-GB</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {cur.slug === "codo" && (
              <>
                <div className="field2">
                  <label>Nombre del CoDo</label>
                  <input {...form.register("codoName")} />
                  {form.formState.errors.codoName && (
                    <span style={{ fontSize: 12, color: "var(--warning-600)" }}>
                      {form.formState.errors.codoName.message}
                    </span>
                  )}
                </div>
                <div className="field2">
                  <label>Vertical</label>
                  <Select value={form.watch("vertical")} onValueChange={(v) => form.setValue("vertical", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VERTICALS.map(([v, label]) => (
                        <SelectItem key={v} value={v}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="field2">
                  <label>Criticidad por segmento</label>
                  <div className="seg">
                    <button
                      type="button"
                      className={form.watch("criticidad") === "auto" ? "on" : ""}
                      onClick={() => form.setValue("criticidad", "auto")}
                    >
                      Inferencia automática
                    </button>
                    <button
                      type="button"
                      className={form.watch("criticidad") === "manual" ? "on" : ""}
                      onClick={() => form.setValue("criticidad", "manual")}
                    >
                      Definir manualmente
                    </button>
                  </div>
                  <span className="cfg-note">
                    {/* DESIGN: Decisión #15 — criticidad obligatoria, delegable a inferencia del pipeline. */}
                    Delegable a la inferencia automática del pipeline. Podrás ajustarla por CoDo después.
                  </span>
                </div>
              </>
            )}

            {cur.slug === "ingest" && (
              <>
                <label className="dropzone" style={{ cursor: "pointer", display: "flex" }}>
                  <input
                    type="file"
                    hidden
                    onChange={(e) => setDocFile(e.target.files?.[0]?.name ?? null)}
                  />
                  <Icon name="upload-cloud" size={26} />
                  <div className="dz-t">
                    {docFile ? docFile : <>Arrastra tu primer documento o <b>selecciona</b></>}
                  </div>
                  <div className="dz-m">Te mostramos el costo estimado antes de procesar</div>
                </label>
                {docFile && (
                  <div className="quote">
                    {/* DESIGN: quote shown via /mo/ingesta on the real Ingesta view; canned here. */}
                    <div className="qr2">
                      <span>Costo estimado</span>
                      <b className="mono">$58.40 USD</b>
                    </div>
                    <div className="qr2">
                      <span>Saldo disponible</span>
                      <b className="mono ok">$184.00 USD</b>
                    </div>
                  </div>
                )}
              </>
            )}

            {cur.slug === "qr" && (
              <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}>
                <QrFrame value="https://docyan.app/q/CODO-LAB-04" caption="CODO-LAB-04 · Hettich Rotina 380" />
              </div>
            )}

            {cur.slug === "ask" && (
              <div className="onb-ask">
                <div className="mctx">
                  <DocyanMark size={20} />
                  <div>
                    <div className="ml">Estás consultando</div>
                    <div className="mn">CODO-LAB-04 · Centrífuga Hettich</div>
                  </div>
                </div>
                <div className="onb-q">¿Torque del perno B?</div>
                <div className="onb-a">
                  <div className="mqlab">85 N·m</div>
                  <span className="cite">
                    <span className="brk" />
                    Manual VF-2 · §4.2.1 ↗
                  </span>
                </div>
              </div>
            )}

            {cur.slug === "invite" && (
              <>
                <div className="field2">
                  <label>Correos de colaboradores (opcional)</label>
                  <input placeholder="separa con comas — o solo comparte el QR" {...form.register("invites")} />
                </div>
                <div className="manual-note">
                  <Icon name="info" size={15} />
                  Los colaboradores no necesitan cuenta: el QR es su credencial.
                </div>
              </>
            )}
          </div>

          <div className="onb-nav">
            {stepIndex > 0 && (
              <button className="mini-btn" type="button" onClick={() => goto(stepIndex - 1)}>
                <Icon name="arrow-left" size={14} />
                Atrás
              </button>
            )}
            <button
              className="primary-btn"
              type="button"
              style={{ marginLeft: "auto" }}
              onClick={() => goto(stepIndex + 1)}
            >
              {last ? "Ir al dashboard" : "Continuar"}
              <Icon name="arrow-right" size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
