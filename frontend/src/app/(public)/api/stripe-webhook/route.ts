import Stripe from "stripe";
import { api } from "@/lib/api-client";

/**
 * Stripe webhook receiver.
 *
 * B9.1: real account config + the `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`
 * are provisioned under Jorge's Stripe account. Until then this endpoint returns
 * 503 (Stripe not configured) so it never silently no-ops a real event.
 *
 * Signature is verified against the RAW body (Next `req.text()`), so this must run
 * on the Node.js runtime (Web Crypto/edge body handling would break Stripe's HMAC).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lazily instantiate Stripe inside the handler so a missing key never crashes the build. */
function getStripe(secret: string): Stripe {
  return new Stripe(secret);
}

/** Best-effort FAT audit forward — never fails the webhook if the backend is down. */
async function forwardFat(family: string, action: string, payload: Record<string, unknown>) {
  try {
    await api.post("/admin/fat/event", {
      family, // one of the 9 FAT families (here: "ingesta"/"governance"/"system")
      action,
      source: "stripe-webhook",
      payload,
    });
  } catch {
    // Swallow — audit forwarding is best-effort; webhook ack must still return 200.
  }
}

/** Best-effort backend hand-off (org provisioning / subscription state). */
async function forwardBackend(path: string, payload: Record<string, unknown>) {
  try {
    await api.post(path, payload);
  } catch {
    // Swallow — Stripe retries on non-2xx, but we ack to avoid duplicate side effects;
    // reconciliation happens via the backend's own polling in B9.1.
  }
}

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret || !webhookSecret) {
    return new Response(
      JSON.stringify({ error: "Stripe not configured (B9.1)" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response(JSON.stringify({ error: "Missing stripe-signature header" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rawBody = await req.text();
  const stripe = getStripe(secret);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return new Response(JSON.stringify({ error: `Webhook signature verification failed: ${message}` }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      // Activate subscription + provision org + welcome (best-effort).
      await forwardBackend("/admin/subscriptions/activate", {
        stripe_session_id: session.id,
        stripe_customer: session.customer,
        stripe_subscription: session.subscription,
        customer_email: session.customer_details?.email ?? session.customer_email,
        metadata: session.metadata ?? {},
      });
      await forwardFat("governance", "subscription.activated", {
        session_id: session.id,
        customer: session.customer,
      });
      break;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      await forwardBackend("/admin/subscriptions/invoice-paid", {
        stripe_invoice_id: invoice.id,
        stripe_customer: invoice.customer,
        amount_paid: invoice.amount_paid,
        currency: invoice.currency,
      });
      await forwardFat("governance", "invoice.payment_succeeded", {
        invoice_id: invoice.id,
        amount_paid: invoice.amount_paid,
      });
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      await forwardBackend("/admin/subscriptions/invoice-failed", {
        stripe_invoice_id: invoice.id,
        stripe_customer: invoice.customer,
        attempt_count: invoice.attempt_count,
      });
      await forwardFat("governance", "invoice.payment_failed", {
        invoice_id: invoice.id,
        attempt_count: invoice.attempt_count,
      });
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      await forwardBackend("/admin/subscriptions/updated", {
        stripe_subscription: sub.id,
        stripe_customer: sub.customer,
        status: sub.status,
        cancel_at_period_end: sub.cancel_at_period_end,
      });
      await forwardFat("governance", "subscription.updated", {
        subscription_id: sub.id,
        status: sub.status,
      });
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await forwardBackend("/admin/subscriptions/deleted", {
        stripe_subscription: sub.id,
        stripe_customer: sub.customer,
      });
      await forwardFat("governance", "subscription.deleted", {
        subscription_id: sub.id,
      });
      break;
    }

    default:
      // Unhandled event types are acknowledged so Stripe stops retrying.
      await forwardFat("system", "stripe.event.unhandled", { type: event.type, id: event.id });
      break;
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
