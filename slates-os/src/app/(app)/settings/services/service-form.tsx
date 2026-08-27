"use client";

import { useActionState } from "react";
import type { FormActionState } from "@/lib/services/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import type { Database } from "@/lib/database.types";

const initialState: FormActionState = {};

export function ServiceForm({
  service,
  action,
  submitLabel,
  readOnly = false,
}: {
  service?: Database["public"]["Tables"]["services"]["Row"];
  action: (state: FormActionState, formData: FormData) => Promise<FormActionState>;
  submitLabel: string;
  readOnly?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {service && <input type="hidden" name="service_id" value={service.id} />}
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.success && <Alert tone="success">Saved.</Alert>}

      <div>
        <Label htmlFor="name">Service name</Label>
        <Input
          id="name"
          name="name"
          defaultValue={service?.name}
          disabled={readOnly}
          required
          autoFocus={!service}
        />
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          rows={2}
          defaultValue={service?.description ?? ""}
          disabled={readOnly}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="duration_minutes">Duration (minutes)</Label>
          <Input
            id="duration_minutes"
            name="duration_minutes"
            type="number"
            min={1}
            defaultValue={service?.duration_minutes ?? ""}
            disabled={readOnly}
          />
        </div>
        <div>
          <Label htmlFor="starting_price">Starting price (USD)</Label>
          <Input
            id="starting_price"
            name="starting_price"
            type="number"
            min={0}
            step="0.01"
            defaultValue={
              service?.starting_price_cents != null ? (service.starting_price_cents / 100).toFixed(2) : ""
            }
            placeholder="Leave blank if not public"
            disabled={readOnly}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={service?.is_active ?? true}
          disabled={readOnly}
          className="h-4 w-4 rounded border-border-strong"
        />
        Active
      </label>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          name="bookable_online"
          defaultChecked={service?.bookable_online ?? false}
          disabled={readOnly}
          className="h-4 w-4 rounded border-border-strong"
        />
        Available for online booking
      </label>

      {!readOnly && (
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      )}
    </form>
  );
}
