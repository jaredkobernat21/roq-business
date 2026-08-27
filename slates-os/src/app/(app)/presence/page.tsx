import Link from "next/link";
import { getCurrentOrgContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { getLabel } from "@/lib/labels";
import { formatBusinessHoursSummary } from "@/lib/business-hours";
import { formatCents } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { ComingSoon } from "@/components/app-shell/coming-soon";
import { BrowserIcon, PresenceIcon, StarIcon, PhotoIcon, ShareIcon } from "@/components/icons";

export default async function PresencePage() {
  const context = await getCurrentOrgContext();
  if (!context) return null;

  const org = context.organization;
  const supabase = await createClient();

  const [{ data: hours }, { data: services }] = await Promise.all([
    supabase.from("business_hours").select("*").eq("organization_id", org.id),
    supabase
      .from("services")
      .select("id, name, duration_minutes, starting_price_cents, is_active")
      .eq("organization_id", org.id)
      .order("created_at", { ascending: true }),
  ]);

  const hoursSummary = formatBusinessHoursSummary(hours ?? []);
  const serviceRows = services ?? [];
  const activeServiceCount = serviceRows.filter((service) => service.is_active).length;

  const contactFields = [
    { label: "Phone", value: org.phone },
    { label: "Website", value: org.website },
    { label: "Email", value: org.email },
    { label: "Address", value: org.address },
    { label: "Hours", value: hoursSummary },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          {getLabel(org.business_mode, "presence")}
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">How your business shows up online.</p>
      </div>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {org.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logo_url} alt="" className="h-14 w-14 shrink-0 rounded-[var(--radius-md)] object-cover" />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-surface-muted text-lg font-semibold text-foreground-muted">
                {org.name.trim().charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-base font-semibold text-foreground">{org.name}</p>
            </div>
          </div>
          <Link
            href="/settings"
            className="text-sm font-medium text-foreground underline underline-offset-2 hover:no-underline"
          >
            Edit profile →
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3 border-t border-border pt-5 sm:grid-cols-2">
          {contactFields.map((field) => (
            <div key={field.label} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-foreground-faint">{field.label}</span>
              <span className="truncate font-medium text-foreground">{field.value || "Not set"}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ComingSoon
          icon={BrowserIcon}
          title="Website preview"
          description="See a live preview of your booking website right from your dashboard."
        />
        <ComingSoon
          icon={PresenceIcon}
          title="Google Business Profile"
          description="Connect your Google Business Profile to manage it from ROQ OS."
        />
        <ComingSoon
          icon={StarIcon}
          title="Reviews"
          description="Collect and respond to customer reviews in one place."
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-0">
          <div className="flex items-center justify-between px-5 pt-5 sm:px-6 sm:pt-6">
            <h2 className="text-sm font-semibold text-foreground">
              Services <span className="font-normal text-foreground-faint">({activeServiceCount} active)</span>
            </h2>
            <Link href="/settings/services" className="text-xs font-medium text-foreground-muted hover:text-foreground">
              View all →
            </Link>
          </div>
          {serviceRows.length === 0 ? (
            <p className="px-5 py-6 text-sm text-foreground-muted sm:px-6">No services listed yet.</p>
          ) : (
            <div className="mt-4 divide-y divide-border">
              {serviceRows.slice(0, 5).map((service) => (
                <div key={service.id} className="flex items-center justify-between gap-3 px-5 py-3 sm:px-6">
                  <p className="truncate text-sm font-medium text-foreground">{service.name}</p>
                  <p className="shrink-0 text-xs text-foreground-muted">{formatCents(service.starting_price_cents)}</p>
                </div>
              ))}
            </div>
          )}
          <div className="h-5 sm:h-6" />
        </Card>
        <ComingSoon icon={PhotoIcon} title="Photos & media" description="Showcase your work with photos customers can see." />
        <ComingSoon
          icon={ShareIcon}
          title="Connected social profiles"
          description="Connect Facebook, Instagram, and more to manage them in one place."
        />
      </div>
    </div>
  );
}
