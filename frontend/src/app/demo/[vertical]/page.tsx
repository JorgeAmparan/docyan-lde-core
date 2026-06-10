"use client";

import { use } from "react";
import { DemoConsult } from "@/components/commercial/demo-consult";
import { SiteLangProvider } from "@/lib/site-i18n";

/**
 * Public demo-CoDo explorer (route `demo:<vertical>` in the bundle). Full-screen,
 * no signup — runs the full consult flow for the chosen vertical. Lives outside
 * the (public) group (no nav/footer) and outside the middleware PROTECTED list.
 */
export default function DemoVerticalPage({ params }: { params: Promise<{ vertical: string }> }) {
  const { vertical } = use(params);
  return (
    <SiteLangProvider>
      <DemoConsult vkey={vertical} />
    </SiteLangProvider>
  );
}
