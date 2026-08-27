import type { ActivityEventType, JobStatus } from "@/lib/database.types";
import { JOB_STATUS_LABELS } from "@/lib/permissions";

export function formatActivityEvent(eventType: ActivityEventType, data: Record<string, unknown>): string {
  switch (eventType) {
    case "customer_created":
      return "Customer created";
    case "job_created":
      return `Job "${String(data.title ?? "")}" created`;
    case "job_status_changed": {
      const from = data.from as JobStatus | undefined;
      const to = data.to as JobStatus | undefined;
      const title = data.title ? `"${String(data.title)}" ` : "";
      const fromLabel = from ? JOB_STATUS_LABELS[from] : "unknown";
      const toLabel = to ? JOB_STATUS_LABELS[to] : "unknown";
      return `${title}moved from ${fromLabel} to ${toLabel}`;
    }
    default:
      return eventType;
  }
}
