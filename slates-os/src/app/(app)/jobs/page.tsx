import { ComingSoon } from "@/components/app-shell/coming-soon";
import { JobsIcon } from "@/components/icons";

export default function JobsPage() {
  return (
    <ComingSoon
      icon={JobsIcon}
      title="Jobs"
      description="Track job status from lead to completion once job management ships."
    />
  );
}
