import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { QuoteCard } from "@/components/ingesta/quote-card";

/**
 * Sprint UI-2 §3 — unit de la tarjeta de cotización: freemium (valor tachado +
 * descuento + $0.00), pago (real + saldo) y tipo no cubierto (aviso honesto).
 * Presentacional puro: sin red, sin store.
 */

describe("QuoteCard — freemium", () => {
  it("muestra el valor real TACHADO, el descuento −100% y Total $0.00", () => {
    render(
      <QuoteCard
        name="NOM-052.pdf"
        tipo="NOM"
        isFreemium
        valueUsd={15}
        totalUsd={0.12}
        currency="USD"
      />,
    );
    // Valor real visible (ancla de valor) y tachado.
    expect(screen.getByTestId("quote-struck")).toHaveTextContent("$15.00 USD");
    // Descuento freemium explícito.
    expect(screen.getByTestId("quote-discount")).toHaveTextContent(/Freemium −100%/);
    // Total cobrado = 0.
    expect(screen.getByTestId("quote-total")).toHaveTextContent("$0.00 USD");
  });
});

describe("QuoteCard — plan pago", () => {
  it("muestra la cotización real y el saldo, sin tachado", () => {
    render(
      <QuoteCard
        name="manual.pdf"
        tipo="manual técnico"
        isFreemium={false}
        valueUsd={15}
        totalUsd={3.4}
        currency="USD"
        saldoUsd={42}
      />,
    );
    expect(screen.getByTestId("quote-total")).toHaveTextContent("$3.40 USD");
    expect(screen.getByText(/Saldo: \$42\.00 USD/)).toBeInTheDocument();
    // Sin elemento tachado en planes pagos.
    expect(screen.queryByTestId("quote-struck")).toBeNull();
    expect(screen.queryByTestId("quote-discount")).toBeNull();
  });
});

describe("QuoteCard — tipo no cubierto por schema", () => {
  it("muestra el aviso honesto ANTES de aprobar", () => {
    render(
      <QuoteCard
        name="raro.bin"
        tipo={null}
        isFreemium
        valueUsd={15}
        totalUsd={0.1}
        currency="USD"
        tipoNoCubierto
      />,
    );
    expect(screen.getByTestId("quote-tipo-warning")).toHaveTextContent(
      /aún no está optimizado; la consulta puede ser limitada/i,
    );
  });
});

describe("QuoteCard — rechazada y quitar", () => {
  it("dice el rechazo (no lo oculta) y permite quitar", () => {
    const onRemove = vi.fn();
    render(
      <QuoteCard
        name="caro.pdf"
        isFreemium={false}
        valueUsd={20}
        totalUsd={9}
        currency="USD"
        saldoUsd={1}
        rejected
        onRemove={onRemove}
      />,
    );
    expect(screen.getByTestId("quote-rejected")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Quitar/i }));
    expect(onRemove).toHaveBeenCalledOnce();
  });
});
