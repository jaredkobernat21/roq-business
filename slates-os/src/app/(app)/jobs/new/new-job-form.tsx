"use client";

import { useActionState } from "react";
import { createJobAction, type FormActionState } from "@/lib/jobs/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { JOB_STATUSES, JOB_STATUS_LABELS } from "@/lib/permissions";

const initialState: FormActionState = {};

export function NewJobForm({
  customers,
  services,
  members,
  preselectedCustomerId,
  preselectedDate,
}: {
  customers: { id: string; label: string }[];
  services: { id: string; name: string }[];
  members: { id: string; label: string }[];
  preselectedCustomerId?: string;
  preselectedDate?: string;
}) {
  const [state, formAction, pending] = useActionState(createJobAction, initialState);

  return (
    <form action={formAction} className="space-y-6">
      {state.error && <Alert tone="danger">{state.error}</Alert>}

      <Card className="space-y-4">
        <div>
          <Label htmlFor="customer_id">Customer</Label>
          <Select id="customer_id" name="customer_id" defaultValue={preselectedCustomerId ?? ""} required>
            <option value="" disabled>
              Select a customer
            </option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.label}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="service_id">Service (optional)</Label>
          <Select id="service_id" name="service_id" defaultValue="">
            <option value="">No service selected</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" placeholder="Defaults to the service name if left blank" />
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" name="description" rows={2} />
        </div>
      </Card>

      <Card className="space-y-4">
        <div>
          <Label htmlFor="status">Status</Label>
          <Select id="status" name="status" defaultValue={preselectedDate ? "scheduled" : "lead"}>
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
              defaultValue={preselectedDate}
            />
            <Input id="scheduled_time" name="scheduled_time" type="time" aria-label="Scheduled time" />
          </div>
        </div>

        <div>
          <Label htmlFor="duration_minutes">Duration (minutes)</Label>
          <Input id="duration_minutes" name="duration_minutes" type="number" min={1} />
        </div>

        <div>
          <Label htmlFor="assigned_to">Assigned to</Label>
          <Select id="assigned_to" name="assigned_to" defaultValue="">
            <option value="">Unassigned</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.label}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <Card>
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={3} />
      </Card>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating…" : "Create job"}
      </Button>
    </form>
  );
}
