"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Icon } from "@/components/icon";
import { useSignup } from "@/lib/signup-store";

const VERTICALS = [
  ["laboratorio", "Laboratorio (ISO 17025)"],
  ["maquiladora", "Maquiladora / IMMEX"],
  ["pharma", "Farmacéutica"],
  ["mining", "Minería"],
  ["agribusiness", "Agroexportación"],
  ["agencia", "Agencia de traducción"],
  ["otro", "Otro"],
] as const;

const COUNTRIES = [
  ["MX", "México"],
  ["US", "Estados Unidos"],
  ["CA", "Canadá"],
  ["ES", "España"],
  ["DE", "Alemania"],
  ["FR", "Francia"],
  ["GB", "Reino Unido"],
  ["AU", "Australia"],
  ["AR", "Argentina"],
  ["CO", "Colombia"],
  ["CL", "Chile"],
  ["OTRO", "Otro"],
] as const;

const SIZES = [
  ["1-10", "1–10 personas"],
  ["11-50", "11–50 personas"],
  ["51-200", "51–200 personas"],
  ["200+", "Más de 200"],
] as const;

export const accountSchema = z.object({
  email: z.string().min(1, "Correo requerido").email("Correo inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  orgName: z.string().min(2, "Nombre de organización requerido"),
  vertical: z.string().min(1),
  country: z.string().min(1),
  orgSize: z.string().min(1),
});

export type AccountForm = z.infer<typeof accountSchema>;

/**
 * Step 2 — account + organization. Exposes `submit()` via ref so the page's
 * "Continuar" button can trigger validation before advancing.
 */
export function StepAccount({ formId }: { formId: string }) {
  const account = useSignup((s) => s.account);
  const setAccount = useSignup((s) => s.setAccount);
  const markStepReached = useSignup((s) => s.markStepReached);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AccountForm>({
    resolver: zodResolver(accountSchema),
    defaultValues: account,
  });

  const onValid = (data: AccountForm) => {
    setAccount(data);
    markStepReached(3);
    // Navigation is handled by the page listening for the form's submit success
    // via the hidden submit button targeting this formId.
    window.dispatchEvent(new CustomEvent("signup:advance", { detail: { from: 2 } }));
  };

  return (
    <form id={formId} onSubmit={handleSubmit(onValid)} noValidate>
      <h2>Crea tu cuenta</h2>
      <p className="lead">Datos de acceso y de tu organización.</p>

      <div className="field">
        <label>Correo de trabajo</label>
        <input placeholder="nombre@laboratorio.mx" autoComplete="email" {...register("email")} />
        {errors.email && <span style={{ color: "var(--danger-600)", fontSize: 12 }}>{errors.email.message}</span>}
      </div>

      <div className="row2c">
        <div className="field">
          <label>Contraseña</label>
          <input type="password" placeholder="••••••••" autoComplete="new-password" {...register("password")} />
          {errors.password && (
            <span style={{ color: "var(--danger-600)", fontSize: 12 }}>{errors.password.message}</span>
          )}
        </div>
        <div className="field">
          <label>Organización</label>
          <input placeholder="Laboratorio Estándar" {...register("orgName")} />
          {errors.orgName && (
            <span style={{ color: "var(--danger-600)", fontSize: 12 }}>{errors.orgName.message}</span>
          )}
        </div>
      </div>

      <div className="row2c">
        <div className="field">
          <label>Vertical</label>
          <select {...register("vertical")}>
            {VERTICALS.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>País</label>
          <select {...register("country")}>
            {COUNTRIES.map(([c, label]) => (
              <option key={c} value={c}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label>Tamaño aproximado</label>
        <select {...register("orgSize")}>
          {SIZES.map(([s, label]) => (
            <option key={s} value={s}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        className="btn sec"
        style={{ width: "100%", justifyContent: "center", marginTop: 6 }}
        disabled
        title="Disponible en B9.1"
      >
        <Icon name="chrome" size={16} />
        Continuar con Google (próximamente)
      </button>
    </form>
  );
}
