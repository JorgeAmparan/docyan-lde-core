"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Icon } from "@/components/icon";
import { Badge, PrivacyNote, StateBlock } from "@/components/platform/atoms";
import { usePlatformApi, CODE_STATE, fmtInt, fmtDate, type AccessCodeOut } from "@/lib/platform";

export default function CodigosPage() {
  const pf = usePlatformApi();
  const qc = useQueryClient();

  const codes = useQuery({ queryKey: ["platform", "codes"], queryFn: () => pf.get<{ items: AccessCodeOut[] }>("/platform/access-codes"), enabled: !!pf.token });

  const [cuota, setCuota] = useState(50); // valor cerrado F2: Esencial
  const [dias, setDias] = useState(60);   // valor cerrado F2: piloto 60 días
  const [nota, setNota] = useState("");
  const [generated, setGenerated] = useState<AccessCodeOut | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const generar = useMutation({
    mutationFn: () => pf.post<AccessCodeOut>("/platform/access-codes", {
      tipo: "piloto", cuota_documentos: cuota, dias_vigencia: dias, nota: nota.trim() || undefined,
    }),
    onSuccess: (row) => {
      setGenerated(row);
      setNota("");
      qc.invalidateQueries({ queryKey: ["platform", "codes"] });
      toast.success("Código generado");
    },
    onError: () => toast.error("No se pudo generar el código"),
  });

  const revocar = useMutation({
    mutationFn: (code: string) => pf.post<AccessCodeOut>(`/platform/access-codes/${code}/revoke`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform", "codes"] }); toast.success("Código revocado"); },
    onError: () => toast.error("No se pudo revocar"),
  });

  const copy = (code: string) => {
    void navigator.clipboard?.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied((c) => (c === code ? null : c)), 1500);
  };

  if (codes.isLoading) return <StateBlock>Cargando códigos…</StateBlock>;
  if (codes.isError) return <StateBlock kind="error">No se pudieron cargar los códigos de acceso.</StateBlock>;

  const items = codes.data?.items ?? [];
  const activos = items.filter((c) => c.status === "active").length;

  return (
    <>
      <div className="psec"><h2>Códigos de acceso</h2><span className="scount">{activos} activos · {items.length} totales</span></div>

      <div className="split">
        <div className="ptbl-wrap">
          <table className="ptbl">
            <thead>
              <tr><th>Código</th><th>Estado</th><th className="num">Cuota</th><th>Vence</th><th>Organización</th><th /></tr>
            </thead>
            <tbody>
              {items.map((c) => {
                const st = CODE_STATE[c.status] ?? { label: c.status, tone: "muted" as const };
                const dim = c.status === "expired" || c.status === "revoked";
                return (
                  <tr key={c.code} className={dim ? "dim" : ""}>
                    <td>
                      <div className="code-cell">
                        <span className="code-mono">{c.code}</span>
                        <button className="copybtn" aria-label="Copiar código" onClick={() => copy(c.code)}>
                          <Icon name={copied === c.code ? "check" : "copy"} size={13} />
                        </button>
                      </div>
                      {c.nota && <div className="t-sub" style={{ marginTop: 2 }}>{c.nota}</div>}
                      <div className="t-id">generado {fmtDate(c.created_at)}</div>
                    </td>
                    <td><Badge tone={st.tone}>{st.label}</Badge></td>
                    <td className="num t-num">{fmtInt(c.cuota_documentos)}<div className="t-sub">docs</div></td>
                    <td className="t-sub t-num">{fmtDate(c.expires_at)}</td>
                    <td className="t-sub">{c.org_generada ?? <span style={{ color: "var(--fg-subtle)" }}>sin asignar</span>}{c.redeemed_at && <div className="t-id">canjeado {fmtDate(c.redeemed_at)}</div>}</td>
                    <td style={{ textAlign: "right" }}>
                      {c.status === "active"
                        ? <button className="pbtn danger sm" disabled={revocar.isPending} onClick={() => revocar.mutate(c.code)}><Icon name="ban" size={13} /> Revocar</button>
                        : <span className="t-sub">{st.label}</span>}
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && <tr><td colSpan={6}><div className="pstate">Aún no hay códigos.</div></td></tr>}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <div className="psec" style={{ margin: "0 0 6px" }}><h2>Generar código de piloto</h2></div>
          <p className="panel-lead">Habilita un piloto con cuota de documentos y vencimiento. Se canjea una sola vez al crear la organización.</p>
          <div className="frow">
            <div className="field">
              <label htmlFor="cuota">Cuota de documentos</label>
              <select id="cuota" className="sel" value={cuota} onChange={(e) => setCuota(Number(e.target.value))}>
                <option value={25}>25 docs</option>
                <option value={50}>50 docs · Esencial</option>
                <option value={100}>100 docs</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="dias">Vence en</label>
              <select id="dias" className="sel" value={dias} onChange={(e) => setDias(Number(e.target.value))}>
                <option value={14}>14 días</option>
                <option value={30}>30 días</option>
                <option value={45}>45 días</option>
                <option value={60}>60 días · piloto</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="nota">Nota interna <span className="hint">(opcional)</span></label>
            <input id="nota" className="inp" value={nota} onChange={(e) => setNota(e.target.value)}
              placeholder="Ej. piloto Lab Saltillo — referido por Delta Norte" />
          </div>
          <button className="pbtn primary full" disabled={generar.isPending} onClick={() => generar.mutate()}>
            <Icon name="ticket-plus" size={15} /> {generar.isPending ? "Generando…" : "Generar código"}
          </button>

          {generated && (
            <div className="code-result">
              <div className="cr-lab">Código generado</div>
              <div className="cr-code">{generated.code}</div>
              <div className="cr-meta">Cuota {generated.cuota_documentos} docs · vence {fmtDate(generated.expires_at)} · cópialo y compártelo con el piloto</div>
            </div>
          )}
        </div>
      </div>

      <PrivacyNote>Códigos y cuotas son datos administrativos del fundador. La nota interna es metadata, nunca contenido de cliente.</PrivacyNote>
    </>
  );
}
