import { describe, it, expect } from "vitest";
import { guessTargetField, analyzeMappedRows, applyMapping, type MappedImportRow } from "./import-fields";

describe("guessTargetField", () => {
  it("matches common header synonyms", () => {
    expect(guessTargetField("First Name")).toBe("first_name");
    expect(guessTargetField("Mobile Phone")).toBe("phone");
    expect(guessTargetField("E-Mail")).toBe("email");
    expect(guessTargetField("Zip Code")).toBe("postal_code");
    expect(guessTargetField("Business Name")).toBe("company_name");
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(guessTargetField("  FIRST NAME  ")).toBe("first_name");
  });

  it("falls back to 'skip' for an unrecognized header", () => {
    expect(guessTargetField("Favorite Color")).toBe("skip");
  });
});

function row(rowNumber: number, overrides: Partial<MappedImportRow> = {}): MappedImportRow {
  return {
    rowNumber,
    raw: {},
    first_name: "Jane",
    last_name: "",
    company_name: "",
    phone: "",
    email: "",
    address_line1: "",
    city: "",
    state: "",
    postal_code: "",
    notes: "",
    ...overrides,
  };
}

describe("analyzeMappedRows", () => {
  it("counts a fully valid row as ready with no issues", () => {
    const { readyCount, issuesByRow } = analyzeMappedRows([row(1, { email: "jane@example.com" })]);
    expect(readyCount).toBe(1);
    expect(issuesByRow.size).toBe(0);
  });

  it("flags a missing first name", () => {
    const { readyCount, issuesByRow } = analyzeMappedRows([row(1, { first_name: "" })]);
    expect(readyCount).toBe(0);
    expect(issuesByRow.get(1)).toContain("Missing first name");
  });

  it("flags an invalid email", () => {
    const { issuesByRow } = analyzeMappedRows([row(1, { email: "not-an-email" })]);
    expect(issuesByRow.get(1)).toContain("Invalid email");
  });

  it("flags duplicate emails across rows, case-insensitively", () => {
    const rows = [row(1, { email: "Jane@Example.com" }), row(2, { email: "jane@example.com" })];
    const { issuesByRow } = analyzeMappedRows(rows);
    expect(issuesByRow.get(1)).toContain("Duplicate email in file");
    expect(issuesByRow.get(2)).toContain("Duplicate email in file");
  });

  it("flags duplicate phone numbers across rows", () => {
    const rows = [row(1, { phone: "555-1234" }), row(2, { phone: "555-1234" })];
    const { issuesByRow } = analyzeMappedRows(rows);
    expect(issuesByRow.get(1)).toContain("Duplicate phone in file");
    expect(issuesByRow.get(2)).toContain("Duplicate phone in file");
  });

  it("does not flag a phone or email that only appears once", () => {
    const rows = [row(1, { email: "a@example.com", phone: "111" }), row(2, { email: "b@example.com", phone: "222" })];
    const { readyCount, issuesByRow } = analyzeMappedRows(rows);
    expect(readyCount).toBe(2);
    expect(issuesByRow.size).toBe(0);
  });
});

describe("applyMapping", () => {
  it("maps raw CSV columns to target fields and trims values", () => {
    const raw = { "First Name": "  Jane  ", "Some Column": "ignored" };
    const mapping = { "First Name": "first_name" as const, "Some Column": "skip" as const };
    const mapped = applyMapping(raw, mapping, 1);
    expect(mapped.first_name).toBe("Jane");
    expect(mapped.company_name).toBe("");
    expect(mapped.raw).toBe(raw);
    expect(mapped.rowNumber).toBe(1);
  });

  it("ignores columns with no mapping entry at all", () => {
    const raw = { Unmapped: "value" };
    const mapped = applyMapping(raw, {}, 2);
    expect(mapped.notes).toBe("");
  });
});
