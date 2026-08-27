import Stripe from "stripe";

let cached: Stripe | null = null;

/** Server-only. Never import this from a Client Component. */
export function getStripeClient(): Stripe {
  if (!cached) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY is not set — see .env.local.example.");
    }
    cached = new Stripe(secretKey);
  }
  return cached;
}
