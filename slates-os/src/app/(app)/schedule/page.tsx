import { ComingSoon } from "@/components/app-shell/coming-soon";
import { ScheduleIcon } from "@/components/icons";

export default function SchedulePage() {
  return (
    <ComingSoon
      icon={ScheduleIcon}
      title="Schedule"
      description="A calendar view of appointments and technician assignments is coming in a later phase."
    />
  );
}
