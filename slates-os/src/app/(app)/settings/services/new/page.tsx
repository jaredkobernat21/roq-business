import { redirect } from "next/navigation";
import { getCurrentOrgContext } from "@/lib/session";
import { canManageServices } from "@/lib/permissions";
import { createServiceAction } from "@/lib/services/actions";
import { Card } from "@/components/ui/card";
import { ServiceForm } from "../service-form";

export default async function NewServicePage() {
  const context = await getCurrentOrgContext();
  if (!context) return null;
  if (!canManageServices(context.role)) {
    redirect("/settings/services");
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-xl font-semibold text-foreground">Add service</h1>
      <Card>
        <ServiceForm action={createServiceAction} submitLabel="Add service" />
      </Card>
    </div>
  );
}
