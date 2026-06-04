import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CitationChip } from "@/components/brand/citation-chip";
import { DocyanMark } from "@/components/brand/docyan-mark";
import { QrFrame } from "@/components/brand/qr-frame";

/** The brand objects are the signature of the product — the cinnabar citation
 *  pedigree (clickable, threads to source) and the corner-bracket mark. */
describe("brand objects", () => {
  it("CitationChip shows its label and threads to source on click", () => {
    const onOpen = vi.fn();
    render(<CitationChip label="Manual VF-2 · §4.2.1" onOpen={onOpen} />);
    const chip = screen.getByRole("button", { name: /Manual VF-2/ });
    expect(chip).toHaveTextContent("Manual VF-2 · §4.2.1");
    expect(chip).toHaveClass("cite");
    fireEvent.click(chip);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("DocyanMark renders an accessible SVG", () => {
    const { container } = render(<DocyanMark />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg).toHaveAttribute("aria-label", "DOCYAN");
  });

  it("QrFrame renders a labelled QR grid inside the cinnabar bracket frame", () => {
    const { container } = render(<QrFrame value="codo-lab-04" caption="CODO-LAB-04" />);
    expect(screen.getByText("CODO-LAB-04")).toBeInTheDocument();
    expect(container.querySelector(".qr-frame")).toBeTruthy();
    expect(container.querySelectorAll(".qb")).toHaveLength(4); // 4 corner brackets
    expect(container.querySelector('[role="img"]')).toHaveAttribute("aria-label", expect.stringContaining("codo-lab-04"));
  });
});
