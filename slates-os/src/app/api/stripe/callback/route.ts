import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getStripeClient } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrgContext, getCurrentUser } from "@/lib/session";
import { canManagePaymentConnections } from "@/lib/permissions";
import { STRIPE_OAUTH_STATE_COOKIE, parseStripeOAuthStateCookie } from "@/lib/stripe/oauth-state";
import { siteUrl } from "@/lib/site-url";

function redirectToIntegrations(query: string) {
  return NextResponse.redirect(new URL(`/settings/integrations?${query}`, siteUrl()));
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const oauthError = request.nextUrl.searchParams.get("error");

  const cookieStore = await cookies();
  const expected = parseStripeOAuthStateCookie(cookieStore.get(STRIPE_OAUTH_STATE_COOKIE)?.value);
  // Single use, whatever the outcome — a state that has been presented once
  // must not be replayable.
  cookieStore.delete(STRIPE_OAUTH_STATE_COOKIE);

  if (oauthError) {
    return redirectToIntegrations(`stripe_error=${encodeURIComponent(oauthError)}`);
  }
  if (!code) {
    return redirectToIntegrations("stripe_error=missing_code");
  }

  // The state must match the one this browser was issued at /api/stripe/connect.
  // Without this, an attacker who completes their own Connect authorization can
  // hand the resulting code to a signed-in owner and have *their* Stripe account
  // attached to the victim's Space — which would silently route that Space's
  // invoice payments to the attacker. The org id alone can't carry this weight:
  // it isn't secret, so it would be trivial to forge.
  if (!expected || !state || state !== expected.state) {
    return redirectToIntegrations("stripe_error=invalid_state");
  }

  const [context, user] = await Promise.all([getCurrentOrgContext(), getCurrentUser()]);

  if (
    !context ||
    !user ||
    !canManagePaymentConnections(context.role) ||
    context.organization.id !== expected.organizationId
  ) {
    return redirectToIntegrations("stripe_error=unauthorized");
  }

  try {
    const stripe = getStripeClient();
    const token = await stripe.oauth.token({ grant_type: "authorization_code", code });

    if (!token.stripe_user_id) {
      return redirectToIntegrations("stripe_error=no_account");
    }

    const supabase = await createClient();
    const { error } = await supabase.from("payment_connections").upsert(
      {
        organization_id: context.organization.id,
        provider: "stripe",
        external_account_id: token.stripe_user_id,
        status: "connected",
        connected_by: user.id,
        connected_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,provider" }
    );

    if (error) {
      return redirectToIntegrations(`stripe_error=${encodeURIComponent(error.message)}`);
    }

    return redirectToIntegrations("stripe_connected=1");
  } catch {
    return redirectToIntegrations("stripe_error=exchange_failed");
  }
}
