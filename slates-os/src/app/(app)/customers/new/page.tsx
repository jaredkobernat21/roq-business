import { redirect } from "next/navigation";
import { getCurrentOrgContext } from "@/lib/session";
import { canManageCustomers } from "@/lib/permissions";
import { getLabel } from "@/lib/labels";
import { NewCustomerForm } from "./new-customer-form";

export default async function NewCustomerPage() {
  const context = await getCurrentOrgContext();
  if (!context) return null;
  if (!canManageCustomers(context.role)) {
    redirect("/customers");
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-xl font-semibold text-foreground">
        Add {getLabel(context.organization.business_mode, "customer")}
      </h1>
      <NewCustomerForm />
    </div>
  );
}
