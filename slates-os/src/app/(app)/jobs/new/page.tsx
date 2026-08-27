import { redirect } from "next/navigation";
import { getCurrentOrgContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { canCreateJobs } from "@/lib/permissions";
import { getLabel } from "@/lib/labels";
import { fullName } from "@/lib/utils";
import { NewJobForm } from "./new-job-form";

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ customer_id?: string; scheduled_date?: string }>;
}) {
  const { customer_id: preselectedCustomerId, scheduled_date: preselectedDate } = await searchParams;
  const context = await getCurrentOrgContext();
  if (!context) return null;
  if (!canCreateJobs(context.role)) {
    redirect("/jobs");
  }

  const supabase = await createClient();
  const [{ data: customers }, { data: services }, { data: members }] = await Promise.all([
    supabase
      .from("customers")
      .select("id, first_name, last_name, company_name")
      .eq("organization_id", context.organization.id)
      .order("first_name", { ascending: true }),
    supabase
      .from("services")
      .select("id, name")
      .eq("organization_id", context.organization.id)
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase.rpc("list_organization_members", { target_org_id: context.organization.id }),
  ]);

  const customerOptions = (customers ?? []).map((customer) => ({
    id: customer.id,
    label: [fullName(customer.first_name, customer.last_name), customer.company_name]
      .filter(Boolean)
      .join(" — "),
  }));

  const memberOptions = (members ?? [])
    .filter((member) => member.status === "active")
    .map((member) => ({
      id: member.user_id,
      label: fullName(member.first_name, member.last_name) || member.email || "Unnamed",
    }));

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-xl font-semibold text-foreground">
        Add {getLabel(context.organization.business_mode, "job")}
      </h1>
      <NewJobForm
        customers={customerOptions}
        services={services ?? []}
        members={memberOptions}
        preselectedCustomerId={preselectedCustomerId}
        preselectedDate={preselectedDate}
      />
    </div>
  );
}
