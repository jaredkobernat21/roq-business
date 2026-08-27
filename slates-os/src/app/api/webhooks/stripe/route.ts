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

    if (invoiceId && amountTotal && paymentIntentId) {
      const supabase = await createClient();
      await supabase.rpc("record_stripe_payment", {
        target_invoice_id: invoiceId,
        stripe_payment_id: paymentIntentId,
        amount_cents: amountTotal,
      });
    }
  }

  return NextResponse.json({ received: true });
}
