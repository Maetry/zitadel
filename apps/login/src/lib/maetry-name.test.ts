import { describe, expect, test } from "vitest";
import { joinName, splitName } from "./maetry-name";

describe("splitName", () => {
  test("first word is the given name, the rest the family name", () => {
    expect(splitName("Anna Maria Smith")).toEqual({ firstName: "Anna", lastName: "Maria Smith" });
  });

  test("one word fills both names", () => {
    expect(splitName("Anna")).toEqual({ firstName: "Anna", lastName: "Anna" });
  });

  test("extra whitespace is dropped", () => {
    expect(splitName("  Anna   Smith ")).toEqual({ firstName: "Anna", lastName: "Smith" });
  });
});

describe("joinName", () => {
  test("restores the typed name", () => {
    for (const name of ["Anna", "Anna Smith", "Anna Maria Smith"]) {
      const { firstName, lastName } = splitName(name);
      expect(joinName(firstName, lastName)).toBe(name);
    }
  });

  test("uses whichever provider name is present", () => {
    expect(joinName("Anna", undefined)).toBe("Anna");
    expect(joinName(undefined, "Smith")).toBe("Smith");
    expect(joinName(undefined, undefined)).toBe("");
  });
});
