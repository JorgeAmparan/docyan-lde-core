import { FlowHero } from "@/components/commercial/flow-hero";
import { DemoExplore, ThreeLevelsFlow, GovernanceSection, MoatSchematic } from "@/components/commercial/landing-flow-sections";
import { Problem, HowItWorks, Verticals, Differentiators, Regulatory } from "@/components/commercial/landing-sections";

/**
 * DOCYAN Landing v2 (FLOW) — the default landing. Recreated 1:1 from the design
 * bundle `landing-flow.jsx` LandingFlow: playable FLOW hero with a 5-vertical
 * selector + functional citation → source doc, a public demo-CoDo explorer, the
 * three-levels progression, "Gobernanza por diseño", and the moat schematic.
 * The Nav + Footer come from the (public) layout. Landing v1 lives at /landing-v1.
 */
export default function LandingFlowPage() {
  return (
    <>
      <FlowHero />
      <DemoExplore />
      <Problem />
      <HowItWorks />
      <ThreeLevelsFlow />
      <GovernanceSection />
      <MoatSchematic />
      <Verticals />
      <Differentiators />
      <Regulatory />
    </>
  );
}
