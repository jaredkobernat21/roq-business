export const STRIPE_OAUTH_STATE_COOKIE = "stripe_oauth_state";

/**
 * The cookie holds `<random-state>:<organization-id>`. Both halves matter:
 * the random half proves this browser started the handshake, and the org id
 * pins the result to the Space that was active when it did — so a connection
 * can't land on a different Space if the user switches mid-flow.
 */
export function parseStripeOAuthStateCookie(
  value: string | undefined
): { state: string; organizationId: string } | null {
  if (!value) return null;
  const separator = value.indexOf(":");
  if (separator <= 0) return null;

  const state = value.slice(0, separator);
  const organizationId = value.slice(separator + 1);
  if (!state || !organizationId) return null;

  return { state, organizationId };
}
