import { redirect } from "next/navigation";
import { getCurrentOrgContext } from "@/lib/session";
import { canManageCustomers } from "@/lib/permissions";
import { getLabel } from "@/lib/labels";
import { ImportWizard } from "./import-wizard";

export default async function ImportCustomersPage() {
  const context = await getCurrentOrgContext();
  if (!context) return null;
  if (!canManageCustomers(context.role)) {
    redirect("/customers");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          Import {getLabel(context.organization.business_mode, "customers").toLowerCase()}
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Upload a CSV export from your current system, match up the columns, and review before importing.
        </p>
      </div>
      <ImportWizard />
    </div>
  );
}
