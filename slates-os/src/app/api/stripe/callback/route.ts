import { NextResponse, type NextRequest } from "next/server";
import { getStripeClient } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrgContext, getCurrentUser } from "@/lib/session";
import { canManagePaymentConnections } from "@/lib/permissions";
import { siteUrl } from "@/lib/site-url";

function redirectToIntegrations(query: string) {
  return NextResponse.redirect(new URL(`/settings/integrations?${query}`, siteUrl()));
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const oauthError = request.nextUrl.searchParams.get("error");

  if (oauthError) {
    return redirectToIntegrations(`stripe_error=${encodeURIComponent(oauthError)}`);
  }
  if (!code) {
    return redirectToIntegrations("stripe_error=missing_code");
  }

  const [context, user] = await Promise.all([getCurrentOrgContext(), getCurrentUser()]);

  // state carries the organization id from when the connect link was
  // generated — this both scopes the callback to the right org and acts as
  // a CSRF check (only meaningful if it matches the session initiating it).
  if (!context || !user || !canManagePaymentConnections(context.role) || context.organization.id !== state) {
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
