import { getCurrentOrgContext, getCurrentProfile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { Card, CardDescription } from "@/components/ui/card";
import { ROLE_LABELS } from "@/lib/permissions";
import { fullName } from "@/lib/utils";
import {
  CustomersIcon,
  JobsIcon,
  ScheduleIcon,
} from "@/components/icons";

async function getActiveMemberCount(organizationId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("organization_members")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("status", "active");
  return count ?? 0;
}

export default async function HomePage() {
  const context = await getCurrentOrgContext();
  const profile = await getCurrentProfile();
  if (!context) return null;

  const memberCount = await getActiveMemberCount(context.organization.id);
  const name = fullName(profile?.first_name, profile?.last_name) || "there";

  const placeholderCards = [
    { icon: ScheduleIcon, label: "Today's Jobs" },
    { icon: CustomersIcon, label: "New Leads" },
    { icon: JobsIcon, label: "Awaiting Payment" },
    { icon: JobsIcon, label: "Revenue" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-foreground-muted">{context.organization.name}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          Welcome back, {name}
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardDescription className="mt-0 text-xs uppercase tracking-wide text-foreground-faint">
            Signed in as
          </CardDescription>
          <p className="mt-1.5 text-sm font-medium text-foreground">
            {fullName(profile?.first_name, profile?.last_name) || "—"}
          </p>
        </Card>
        <Card>
          <CardDescription className="mt-0 text-xs uppercase tracking-wide text-foreground-faint">
            Your role
          </CardDescription>
          <p className="mt-1.5 text-sm font-medium text-foreground">{ROLE_LABELS[context.role]}</p>
        </Card>
        <Card>
          <CardDescription className="mt-0 text-xs uppercase tracking-wide text-foreground-faint">
            Team members
          </CardDescription>
          <p className="mt-1.5 text-sm font-medium text-foreground">{memberCount}</p>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Overview</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {placeholderCards.map(({ icon: Icon, label }) => (
            <Card key={label} className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] bg-surface-muted text-foreground-muted">
                  <Icon className="h-[18px] w-[18px]" />
                </div>
                <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-medium text-foreground-faint">
                  Soon
                </span>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-foreground-faint">
                  {label}
                </p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground-faint">
                  —
                </p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
