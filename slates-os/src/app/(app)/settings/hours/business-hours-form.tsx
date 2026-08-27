"use client";

import { useActionState } from "react";
import { updateBusinessHoursAction, type FormActionState } from "@/lib/scheduling/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { DAYS_OF_WEEK } from "@/lib/scheduling/days";
import type { Database } from "@/lib/database.types";

const initialState: FormActionState = {};

export function BusinessHoursForm({
  hours,
  readOnly,
}: {
  hours: Database["public"]["Tables"]["business_hours"]["Row"][];
  readOnly: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateBusinessHoursAction, initialState);
  const hoursByDay = new Map(hours.map((h) => [h.day_of_week, h]));

  return (
    <form action={formAction} className="space-y-1">
      {state.error && <Alert tone="danger" className="mb-4">{state.error}</Alert>}
      {state.success && <Alert tone="success" className="mb-4">Saved.</Alert>}

      {DAYS_OF_WEEK.map((day) => {
        const existing = hoursByDay.get(day.value);
        return (
          <div key={day.value} className="flex flex-wrap items-center gap-3 border-b border-border py-3 last:border-0">
            <label className="flex w-32 shrink-0 items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                name={`is_open_${day.value}`}
                defaultChecked={existing?.is_open ?? false}
                disabled={readOnly}
                className="h-4 w-4 rounded border-border-strong"
              />
              {day.label}
            </label>
            <Input
              type="time"
              name={`open_time_${day.value}`}
              defaultValue={existing?.open_time?.slice(0, 5) ?? "09:00"}
              disabled={readOnly}
              className="w-32"
              aria-label={`${day.label} opening time`}
            />
            <span className="text-sm text-foreground-muted">to</span>
            <Input
              type="time"
              name={`close_time_${day.value}`}
              defaultValue={existing?.close_time?.slice(0, 5) ?? "17:00"}
              disabled={readOnly}
              className="w-32"
              aria-label={`${day.label} closing time`}
            />
          </div>
        );
      })}

      {!readOnly && (
        <Button type="submit" disabled={pending} className="mt-5">
          {pending ? "Saving…" : "Save hours"}
        </Button>
      )}
    </form>
  );
}
