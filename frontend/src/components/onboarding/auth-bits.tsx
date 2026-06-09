"use client";

import type { ReactNode } from "react";
import { Icon } from "@/components/icon";
import { BrandRow } from "@/components/brand/brand-row";

/* Panel de valor (tinta) del auth-split — portado de `auth.jsx` ValueAside. */
export function ValueAside({
  tag,
  title,
  sub,
  points,
  object,
}: {
  tag?: string;
  title: string;
  sub?: string;
  points?: Array<[string, string, string]>;
  object?: ReactNode;
}) {
  return (
    <aside className="auth-aside">
      <div className="aside-top">
        <BrandRow tone="light" size={28} />
        {tag && <span className="aside-tag">{tag}</span>}
      </div>
      <div className="aside-mid">
        <h1>{title}</h1>
        {sub && <p className="aside-sub">{sub}</p>}
        {points && (
          <ul className="aside-points">
            {points.map((p, i) => (
              <li key={i}>
                <span className="ap-ic">
                  <Icon name={p[0]} size={16} />
                </span>
                <span>
                  <b>{p[1]}</b>
                  <span className="ap-m">{p[2]}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {object}
      </div>
      <div className="aside-foot">
        <span className="d" />
        XCID SA de CV · México · multi-tenant aislado por organización
      </div>
    </aside>
  );
}

/* "Momento mágico" del aside (consulta citada). */
export function AsideMock() {
  return (
    <div className="aside-object">
      <span className="ao-q">¿Torque del perno B?</span>
      <div className="ao-a">
        <div className="ao-big">
          85 <small>N·m</small>
        </div>
        <span className="cite dark">
          <span className="brk" />
          Manual VF-2 · §4.2.1 ↗
        </span>
      </div>
    </div>
  );
}

/* Fuerza de contraseña 0-3. */
export function pwScore(v: string): number {
  if (!v) return 0;
  let s = 0;
  if (v.length >= 8) s++;
  if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++;
  if (/[0-9\W]/.test(v)) s++;
  return s;
}

/* Campo de contraseña con mostrar/ocultar + barra de fuerza (atoms.jsx PwField). */
export function PwField({
  label = "Contraseña",
  value,
  onChange,
  show,
  setShow,
  strength = false,
  placeholder = "Mínimo 8 caracteres",
  autoComplete,
  disabled = false,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  setShow: (v: boolean) => void;
  strength?: boolean;
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
}) {
  const sc = pwScore(value);
  return (
    <div className="field">
      <label>{label}</label>
      <div className="inp">
        <input
          type={show ? "text" : "password"}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          className="eye"
          type="button"
          aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
          onClick={() => setShow(!show)}
        >
          <Icon name={show ? "eye-off" : "eye"} size={17} />
        </button>
      </div>
      {strength && value && (
        <div className="pwbar">
          <i className={sc >= 1 ? (sc === 1 ? "mid" : "on") : ""} />
          <i className={sc >= 2 ? (sc === 2 ? "mid" : "on") : ""} />
          <i className={sc >= 3 ? "on" : ""} />
        </div>
      )}
    </div>
  );
}
