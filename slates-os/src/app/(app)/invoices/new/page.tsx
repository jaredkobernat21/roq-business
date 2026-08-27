import { redirect } from "next/navigation";
import { getCurrentOrgContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { canManageInvoices } from "@/lib/permissions";
import { getLabel } from "@/lib/labels";
import { fullName } from "@/lib/utils";
import { NewInvoiceForm } from "./new-invoice-form";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ customer_id?: string; job_id?: string }>;
}) {
  const { customer_id: preselectedCustomerId, job_id: preselectedJobId } = await searchParams;
  const context = await getCurrentOrgContext();
  if (!context) return null;
  if (!canManageInvoices(context.role)) {
    redirect("/invoices");
  }

  const supabase = await createClient();
  const { data: customers } = await supabase
    .from("customers")
    .select("id, first_name, last_name, company_name")
    .eq("organization_id", context.organization.id)
    .order("first_name", { ascending: true });

  const customerOptions = (customers ?? []).map((customer) => ({
    id: customer.id,
    label: [fullName(customer.first_name, customer.last_name), customer.company_name]
      .filter(Boolean)
      .join(" — "),
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold text-foreground">
        New {getLabel(context.organization.business_mode, "invoice")}
      </h1>
      <NewInvoiceForm
        customers={customerOptions}
        preselectedCustomerId={preselectedCustomerId}
        preselectedJobId={preselectedJobId}
      />
    </div>
  );
}
