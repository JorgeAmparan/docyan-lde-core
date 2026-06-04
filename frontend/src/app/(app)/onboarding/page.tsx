import { redirect } from "next/navigation";

/** Onboarding entry — always start at step 1. */
export default function OnboardingIndex() {
  redirect("/onboarding/1");
}
