import { notFound } from "next/navigation";
import { getCurrentOrgContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { canManageServices } from "@/lib/permissions";
import { updateServiceAction } from "@/lib/services/actions";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ServiceForm } from "../service-form";

export default async function EditServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await getCurrentOrgContext();
  if (!context) return null;

  const supabase = await createClient();
  const { data: service } = await supabase
    .from("services")
    .select("*")
    .eq("id", id)
    .eq("organization_id", context.organization.id)
    .maybeSingle();

  if (!service) {
    notFound();
  }

  const canManage = canManageServices(context.role);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-xl font-semibold text-foreground">{service.name}</h1>
      <Card>
        <CardTitle>Service details</CardTitle>
        <CardDescription>
          {canManage ? "Editable by owners and admins." : "Only owners and admins can edit services."}
        </CardDescription>
        <div className="mt-5">
          <ServiceForm
            service={service}
            action={updateServiceAction}
            submitLabel="Save changes"
            readOnly={!canManage}
          />
        </div>
      </Card>
    </div>
  );
}
