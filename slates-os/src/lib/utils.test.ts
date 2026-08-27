import { describe, it, expect } from "vitest";
import { cn, initials, fullName, formatCents } from "./utils";

describe("cn", () => {
  it("joins truthy class names with a space", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });

  it("drops falsy values", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });

  it("returns an empty string when nothing is truthy", () => {
    expect(cn(false, null, undefined)).toBe("");
  });
});

describe("initials", () => {
  it("combines the first letter of each name, uppercased", () => {
    expect(initials("jane", "doe")).toBe("JD");
  });

  it("falls back to '?' when both names are missing", () => {
    expect(initials(null, null)).toBe("?");
    expect(initials(undefined, undefined)).toBe("?");
  });

  it("handles a missing last name", () => {
    expect(initials("Jane", null)).toBe("J");
  });

  it("trims whitespace before taking the first letter", () => {
    expect(initials("  Jane", "  Doe")).toBe("JD");
  });
});

describe("fullName", () => {
  it("joins first and last name with a space", () => {
    expect(fullName("Jane", "Doe")).toBe("Jane Doe");
  });

  it("omits a missing last name without a trailing space", () => {
    expect(fullName("Jane", null)).toBe("Jane");
  });

  it("returns an empty string when both are missing", () => {
    expect(fullName(null, null)).toBe("");
  });
});

describe("formatCents", () => {
  it("formats whole dollar amounts", () => {
    expect(formatCents(500000)).toBe("$5,000.00");
  });

  it("formats cents correctly", () => {
    expect(formatCents(1099)).toBe("$10.99");
  });

  it("formats zero", () => {
    expect(formatCents(0)).toBe("$0.00");
  });

  it("returns an em dash for null", () => {
    expect(formatCents(null)).toBe("—");
  });
});
