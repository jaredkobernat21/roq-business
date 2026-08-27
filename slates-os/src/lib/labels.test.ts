import { describe, it, expect } from "vitest";
import { getLabel } from "./labels";

describe("getLabel", () => {
  it("resolves a label for the service_business mode", () => {
    expect(getLabel("service_business", "job")).toBe("Job");
    expect(getLabel("service_business", "customers")).toBe("Customers");
  });

  it("resolves the universal top-nav tab labels", () => {
    // Displayed as "Now"/"Profile", not "Home"/"Presence" — see the doc
    // comment on LABELS in labels.ts for why. The internal keys stay
    // home/presence regardless.
    expect(getLabel("service_business", "home")).toBe("Now");
    expect(getLabel("service_business", "presence")).toBe("Profile");
    expect(getLabel("service_business", "work")).toBe("Work");
  });

  it("falls back to service_business labels for an unrecognized mode", () => {
    // Cast past the type since this simulates an org row with a mode value
    // this build of the app doesn't know about yet.
    expect(getLabel("nonexistent_mode" as never, "job")).toBe("Job");
  });
});
