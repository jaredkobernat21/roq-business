"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/input";

export function ScheduleMemberFilter({
  members,
  selected,
  view,
  date,
}: {
  members: { id: string; label: string }[];
  selected?: string;
  view: "day" | "week";
  date: string;
}) {
  const router = useRouter();

  if (members.length === 0) return null;

  return (
    <Select
      className="w-48"
      value={selected ?? ""}
      onChange={(e) => {
        const member = e.target.value;
        const memberQuery = member ? `&member=${member}` : "";
        router.push(`/schedule?view=${view}&date=${date}${memberQuery}`);
      }}
    >
      <option value="">Everyone</option>
      {members.map((member) => (
        <option key={member.id} value={member.id}>
          {member.label}
        </option>
      ))}
    </Select>
  );
}
