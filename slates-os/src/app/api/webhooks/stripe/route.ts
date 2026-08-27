import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";

/**
 * Called directly by Stripe's servers — no browser, no session, no cookies.
 * Trust is established entirely by the signature check below, which is why
 * proxy.ts exempts /api/webhooks from the normal login redirect. The actual
 * write happens through record_stripe_payment (security definer, granted to
 * anon) rather than any table grant — see the payments migration.
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });
  }

  const rawBody = await request.text();
  const stripe = getStripeClient();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const invoiceId = session.metadata?.invoice_id;
    const amountTotal = session.amount_total;
    const paymentIntentId =
      typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;

    if (!invoiceId || !amountTotal || !paymentIntentId) {
      // The customer has paid, but this event can't be tied back to an
      // invoice. Retrying won't add the missing fields, so acknowledge it —
      // but say so loudly, because it means a real payment went unrecorded.
      console.error("[stripe-webhook] paid session missing fields; payment not recorded", {
        eventId: event.id,
        sessionId: session.id,
        hasInvoiceId: Boolean(invoiceId),
        hasAmount: Boolean(amountTotal),
        hasPaymentIntent: Boolean(paymentIntentId),
      });
      return NextResponse.json({ received: true, recorded: false });
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc("record_stripe_payment", {
      target_invoice_id: invoiceId,
      stripe_payment_id: paymentIntentId,
      amount_cents: amountTotal,
    });

    if (error) {
      // Fail loudly rather than acknowledging. A 2xx here tells Stripe the
      // event is handled and it will never redeliver — so a transient
      // database error would leave a paid invoice permanently marked unpaid,
      // with nothing to reconcile against. Any non-2xx puts the event back
      // into Stripe's retry schedule instead, and record_stripe_payment is
      // idempotent on (provider, external_payment_id), so a redelivery that
      // succeeds can't double-count.
      console.error("[stripe-webhook] failed to record payment", {
        eventId: event.id,
        invoiceId,
        paymentIntentId,
        error: error.message,
      });
      return NextResponse.json({ error: "Failed to record payment" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
