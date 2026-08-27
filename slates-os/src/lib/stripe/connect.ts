import { getStripeClient } from "@/lib/stripe/client";
import { siteUrl } from "@/lib/site-url";

/**
 * Null if Stripe Connect isn't configured yet (env vars unset) — callers should
 * show a setup hint instead of a broken link.
 *
 * `state` must be an unguessable value minted per handshake and held in an
 * httpOnly cookie; see /api/stripe/connect. It is deliberately not the
 * organization id: an org id is not a secret, so using it as the state would
 * make the callback forgeable.
 */
export function getStripeConnectAuthorizeUrl(state: string): string | null {
  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;
  if (!clientId || !process.env.STRIPE_SECRET_KEY) return null;

  const stripe = getStripeClient();
  return stripe.oauth.authorizeUrl({
    client_id: clientId,
    response_type: "code",
    scope: "read_write",
    redirect_uri: `${siteUrl()}/api/stripe/callback`,
    state,
  });
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_CONNECT_CLIENT_ID);
}
