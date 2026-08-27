import Link from "next/link";
import { getCurrentOrgContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { canManagePaymentConnections } from "@/lib/permissions";
import { getStripeConnectAuthorizeUrl, isStripeConfigured } from "@/lib/stripe/connect";
import { disconnectStripeAction } from "@/lib/payments/actions";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ stripe_connected?: string; stripe_error?: string }>;
}) {
  const { stripe_connected, stripe_error } = await searchParams;
  const context = await getCurrentOrgContext();
  if (!context) return null;

  const supabase = await createClient();
  const { data: connection } = await supabase
    .from("payment_connections")
    .select("status, external_account_id")
    .eq("organization_id", context.organization.id)
    .eq("provider", "stripe")
    .maybeSingle();

  const canManage = canManagePaymentConnections(context.role);
  const isConnected = connection?.status === "connected";
  const configured = isStripeConfigured();
  const authorizeUrl = configured ? getStripeConnectAuthorizeUrl(context.organization.id) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold text-foreground">Integrations</h1>

      {stripe_connected && <Alert tone="success">Stripe connected.</Alert>}
      {stripe_error && <Alert tone="danger">Couldn&apos;t connect Stripe ({stripe_error}).</Alert>}

      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Stripe</CardTitle>
            <CardDescription>
              Payments — customers pay invoices directly into your own Stripe account. ROQ OS never touches
              the money or stores card details.
            </CardDescription>
          </div>
          <Badge tone={isConnected ? "success" : "neutral"}>
            {isConnected ? "Connected" : "Not connected"}
          </Badge>
        </div>

        {isConnected && connection && (
          <p className="mt-3 text-xs text-foreground-faint">Account: {connection.external_account_id}</p>
        )}

        <div className="mt-4">
          {!canManage ? (
            <p className="text-sm text-foreground-muted">Only owners and admins can manage payment connections.</p>
          ) : !configured ? (
            <p className="text-sm text-foreground-muted">
              Stripe isn&apos;t configured for this ROQ OS instance yet — an admin needs to set{" "}
              <code className="rounded bg-surface-muted px-1 py-0.5">STRIPE_SECRET_KEY</code> and{" "}
              <code className="rounded bg-surface-muted px-1 py-0.5">STRIPE_CONNECT_CLIENT_ID</code>.
            </p>
          ) : isConnected ? (
            <form action={disconnectStripeAction}>
              <Button type="submit" size="sm" variant="secondary">
                Disconnect
              </Button>
            </form>
          ) : authorizeUrl ? (
            <a href={authorizeUrl}>
              <Button size="sm">Connect Stripe</Button>
            </a>
          ) : null}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>QuickBooks</CardTitle>
            <CardDescription>Sync invoices and payments to your accounting.</CardDescription>
          </div>
          <Badge tone="neutral">Coming soon</Badge>
        </div>
      </Card>

      <Link href="/customers/import" className="block">
        <Card className="flex items-center justify-between transition-colors hover:bg-surface-hover">
          <div>
            <CardTitle>Customer import</CardTitle>
            <CardDescription>Bring in your existing customer list from a CSV export.</CardDescription>
          </div>
          <Badge tone="success">Available</Badge>
        </Card>
      </Link>
    </div>
  );
}
