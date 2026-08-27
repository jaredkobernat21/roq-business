import { describe, it, expect } from "vitest";
import { formatActivityEvent } from "./activity";

describe("formatActivityEvent", () => {
  it("formats customer_created with no data needed", () => {
    expect(formatActivityEvent("customer_created", {})).toBe("Customer created");
  });

  it("formats job_created with the job title", () => {
    expect(formatActivityEvent("job_created", { title: "Fix leaky faucet" })).toBe(
      'Job "Fix leaky faucet" created'
    );
  });

  it("formats job_created with an empty title if none was recorded", () => {
    expect(formatActivityEvent("job_created", {})).toBe('Job "" created');
  });

  it("formats job_status_changed with title and both statuses", () => {
    expect(
      formatActivityEvent("job_status_changed", { title: "Fix leaky faucet", from: "scheduled", to: "completed" })
    ).toBe('"Fix leaky faucet" moved from Scheduled to Completed');
  });

  it("formats job_status_changed without a title", () => {
    expect(formatActivityEvent("job_status_changed", { from: "lead", to: "estimate" })).toBe(
      "moved from Lead to Estimate"
    );
  });

  it("falls back to 'unknown' for a missing from/to status", () => {
    expect(formatActivityEvent("job_status_changed", { to: "completed" })).toBe(
      "moved from unknown to Completed"
    );
  });

  it("falls back to the raw event type for an unrecognized event", () => {
    expect(formatActivityEvent("something_else" as never, {})).toBe("something_else");
  });
});
