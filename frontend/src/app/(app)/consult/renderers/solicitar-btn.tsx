"use client";

/* PROVISIONAL-ED2 — Botón contextual "Solicitar" (ED-2 §2.8).
 * Se renderiza SOLO donde el backend marcó el dato accionable (payload §2.4). El
 * sistema muestra la affordance; el humano decide. Vocabulario visual existente
 * (`.savebtn`). Se reemplaza por el porteo fiel del prototipo en ED-4. */
import { Icon } from "@/components/icon";

export function SolicitarBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="savebtn" onClick={onClick}>
      <Icon name="send" size={14} />
      Solicitar
    </button>
  );
}
