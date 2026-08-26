import { ComingSoon } from "@/components/app-shell/coming-soon";
import { CustomersIcon } from "@/components/icons";

export default function CustomersPage() {
  return (
    <ComingSoon
      icon={CustomersIcon}
      title="Customers"
      description="Your customer list, contact info, and history will live here in a future phase."
    />
  );
}
