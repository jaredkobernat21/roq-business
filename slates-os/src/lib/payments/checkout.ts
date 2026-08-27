"use server";

import { getStripeClient } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site-url";

export async function getInvoiceStripeAccount(invoiceId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_invoice_stripe_account", { target_invoice_id: invoiceId });
  return data ?? null;
}

export async function createInvoiceCheckoutSession(
  invoiceId: string
): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient();

  const { data: connectedAccountId } = await supabase.rpc("get_invoice_stripe_account", {
    target_invoice_id: invoiceId,
  });
  if (!connectedAccountId) {
    return { error: "Online payment isn't set up for this business yet." };
  }

  const { data: invoice } = await supabase.rpc("get_invoice_for_viewing", { target_invoice_id: invoiceId });
  if (!invoice) {
    return { error: "Invoice not found." };
  }

  const amountDueCents = invoice.total_cents - invoice.amount_paid_cents;
  if (amountDueCents <= 0) {
    return { error: "This invoice is already paid." };
  }

  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: `Invoice #${invoice.invoice_number} — ${invoice.organization.name}` },
            unit_amount: amountDueCents,
          },
          quantity: 1,
        },
      ],
      metadata: { invoice_id: invoiceId },
      payment_intent_data: { metadata: { invoice_id: invoiceId } },
      success_url: `${siteUrl()}/invoice/${invoiceId}?paid=1`,
      cancel_url: `${siteUrl()}/invoice/${invoiceId}`,
    },
    // Direct charge on the connected account — funds land with the
    // business, not ROQ OS. See docs note in the payments migration.
    { stripeAccount: connectedAccountId }
  );

  if (!session.url) {
    return { error: "Could not start checkout." };
  }

  return { url: session.url };
}
