"use client";

import { useActionState, useEffect, useState } from "react";
import { createScheduleBlockAction, type FormActionState } from "@/lib/scheduling/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

const initialState: FormActionState = {};

function BlockTimeForm({
  date,
  members,
  onDone,
}: {
  date: string;
  members: { id: string; label: string }[];
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(createScheduleBlockAction, initialState);

  useEffect(() => {
    if (state.success) onDone();
  }, [state.success, onDone]);

  return (
    <Card className="w-full space-y-3 sm:w-80">
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="date" value={date} />
        {state.error && <Alert tone="danger">{state.error}</Alert>}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="start_time">From</Label>
            <Input id="start_time" name="start_time" type="time" required />
          </div>
          <div>
            <Label htmlFor="end_time">To</Label>
            <Input id="end_time" name="end_time" type="time" required />
          </div>
        </div>

        <div>
          <Label htmlFor="member_id">Who</Label>
          <Select id="member_id" name="member_id" defaultValue="">
            <option value="">Whole team</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.label}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="reason">Reason (optional)</Label>
          <Input id="reason" name="reason" placeholder="e.g. Holiday, time off" />
        </div>

        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Blocking…" : "Block time"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function BlockTimeControl({
  date,
  members,
}: {
  date: string;
  members: { id: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        + Block time
      </Button>
    );
  }

  return <BlockTimeForm date={date} members={members} onDone={() => setOpen(false)} />;
}
