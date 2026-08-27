"use client";

import { useActionState } from "react";
import { updateJobAction, type FormActionState } from "@/lib/jobs/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { JOB_STATUSES, JOB_STATUS_LABELS } from "@/lib/permissions";
import type { Database } from "@/lib/database.types";

const initialState: FormActionState = {};

function toDateInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toTimeInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function JobEditForm({
  job,
  members,
  readOnly,
}: {
  job: Database["public"]["Tables"]["jobs"]["Row"];
  members: { id: string; label: string }[];
  readOnly: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateJobAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="job_id" value={job.id} />
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.success && <Alert tone="success">Saved.</Alert>}

      <div>
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" defaultValue={job.title} disabled={readOnly} required />
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          rows={2}
          defaultValue={job.description ?? ""}
          disabled={readOnly}
        />
      </div>

      <div>
        <Label htmlFor="status">Status</Label>
        <Select id="status" name="status" defaultValue={job.status} disabled={readOnly}>
          {JOB_STATUSES.map((status) => (
            <option key={status} value={status}>
              {JOB_STATUS_LABELS[status]}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="scheduled_date">Scheduled for</Label>
        <div className="grid grid-cols-2 gap-3">
          <Input
            id="scheduled_date"
            name="scheduled_date"
            type="date"
            aria-label="Scheduled date"
            defaultValue={toDateInput(job.scheduled_at)}
            disabled={readOnly}
          />
          <Input
            id="scheduled_time"
            name="scheduled_time"
            type="time"
            aria-label="Scheduled time"
            defaultValue={toTimeInput(job.scheduled_at)}
            disabled={readOnly}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="duration_minutes">Duration (minutes)</Label>
        <Input
          id="duration_minutes"
          name="duration_minutes"
          type="number"
          min={1}
          defaultValue={job.duration_minutes ?? ""}
          disabled={readOnly}
        />
      </div>

      <div>
        <Label htmlFor="assigned_to">Assigned to</Label>
        <Select id="assigned_to" name="assigned_to" defaultValue={job.assigned_to ?? ""} disabled={readOnly}>
          <option value="">Unassigned</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.label}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={3} defaultValue={job.notes ?? ""} disabled={readOnly} />
      </div>

      {!readOnly && (
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      )}
    </form>
  );
}
