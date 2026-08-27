import { getCurrentOrgContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { canManageBusinessHours } from "@/lib/permissions";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { BusinessHoursForm } from "./business-hours-form";

export default async function BusinessHoursPage() {
  const context = await getCurrentOrgContext();
  if (!context) return null;

  const supabase = await createClient();
  const { data: hours } = await supabase
    .from("business_hours")
    .select("*")
    .eq("organization_id", context.organization.id);

  const canManage = canManageBusinessHours(context.role);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-xl font-semibold text-foreground">Business hours</h1>
      <Card>
        <CardTitle>Weekly hours</CardTitle>
        <CardDescription>
          {canManage
            ? "Used for the schedule and, later, online booking availability."
            : "Only owners and admins can edit business hours."}
        </CardDescription>
        <div className="mt-5">
          <BusinessHoursForm hours={hours ?? []} readOnly={!canManage} />
        </div>
      </Card>
    </div>
  );
}
