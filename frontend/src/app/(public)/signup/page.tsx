import { redirect } from "next/navigation";

/**
 * Signup entry — server component. Redirects to step 1 of the checkout, carrying
 * a `?plan=` slug forward (set by the pricing page "Empezar" CTA) so step 1 can
 * pre-select it.
 */
export default async function SignupIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan } = await searchParams;
  const qs = plan ? `?plan=${encodeURIComponent(plan)}` : "";
  redirect(`/signup/1${qs}`);
}
