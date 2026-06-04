import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "ok" | "warn" | "danger" }) {
  const tones = {
    neutral: "bg-amate-100 text-fg-muted",
    ok: "bg-success-100 text-success-600",
    warn: "bg-warning-100 text-warning-600",
    danger: "bg-danger-100 text-danger-600",
  } as const;
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", tones[tone], className)}
      {...props}
    />
  );
}
