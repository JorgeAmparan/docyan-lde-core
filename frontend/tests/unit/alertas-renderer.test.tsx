import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AlertasDashboard } from "@/app/(app)/consult/renderers/alertas-dashboard";

/**
 * REGULATORY ABSOLUTE (CLAUDE.md §11.1): the Alertas renderer MUST show the
 * administrative-only banner and MUST NOT use ANSI danger red. This line cannot
 * be crossed — it is a legal requirement, so it carries a test.
 */
describe("AlertasDashboard — administrative-only line", () => {
  it("renders the mandatory administrative-reminder banner", () => {
    render(<AlertasDashboard saved={false} onSave={vi.fn()} onCite={vi.fn()} />);
    expect(
      screen.getByText(/Recordatorios administrativos\. No constituyen instrucciones operativas ni clínicas/i),
    ).toBeInTheDocument();
  });

  it("never uses ANSI danger red — only warn/caution severities", () => {
    const { container } = render(<AlertasDashboard saved={false} onSave={vi.fn()} onCite={vi.fn()} />);
    const cards = container.querySelectorAll(".alert-card");
    expect(cards.length).toBeGreaterThan(0);
    cards.forEach((c) => {
      expect(c.className).not.toContain("s-danger");
      expect(c.className).not.toContain("danger");
      expect(c.className).toMatch(/s-(warn|caution)/);
    });
  });
});
