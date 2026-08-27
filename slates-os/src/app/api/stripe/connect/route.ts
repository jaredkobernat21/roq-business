import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentOrgContext } from "@/lib/session";
import { canManagePaymentConnections } from "@/lib/permissions";
import { getStripeConnectAuthorizeUrl } from "@/lib/stripe/connect";
import { STRIPE_OAUTH_STATE_COOKIE } from "@/lib/stripe/oauth-state";
import { siteUrl } from "@/lib/site-url";

/**
 * Starts the Stripe Connect handshake.
 *
 * This exists as a route handler rather than a plain link to Stripe because
 * the OAuth `state` has to be a secret this browser holds: it is minted here,
 * stored in an httpOnly cookie, and compared in the callback. A Server
 * Component can't set cookies, so it can't mint one — see the callback route
 * for what this defends against.
 */
export async function GET() {
  const context = await getCurrentOrgContext();
  if (!context || !canManagePaymentConnections(context.role)) {
    return NextResponse.redirect(new URL("/settings/integrations?stripe_error=unauthorized", siteUrl()));
  }

  const state = crypto.randomUUID();
  const authorizeUrl = getStripeConnectAuthorizeUrl(state);
  if (!authorizeUrl) {
    return NextResponse.redirect(new URL("/settings/integrations?stripe_error=not_configured", siteUrl()));
  }

  const cookieStore = await cookies();
  cookieStore.set(STRIPE_OAUTH_STATE_COOKIE, `${state}:${context.organization.id}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/stripe",
    // The handshake is a single round trip through Stripe. Ten minutes is
    // generous for that and short enough that an abandoned attempt expires.
    maxAge: 600,
  });

  return NextResponse.redirect(authorizeUrl);
}
