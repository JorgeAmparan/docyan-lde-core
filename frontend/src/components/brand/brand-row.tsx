import { DocyanMark } from "./docyan-mark";

/**
 * Lockup DOCYAN LDE (mark + wordmark). Portado del kit B13 (`atoms.jsx` → BrandRow).
 * `tone="light"` para superficies de tinta oscura (panel de valor del auth-split).
 */
export function BrandRow({
  size = 26,
  tone = "ink",
}: {
  size?: number;
  tone?: "ink" | "light";
}) {
  return (
    <div className={"brand-row" + (tone === "light" ? " light" : "")}>
      <DocyanMark size={size} tone={tone} />
      <span className="wm">
        DOCYAN<span className="lde">LDE</span>
      </span>
    </div>
  );
}
