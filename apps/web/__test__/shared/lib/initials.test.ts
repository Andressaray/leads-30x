import { describe, expect, it } from "vitest";
import { initials } from "@/shared/lib/initials";

describe("initials", () => {
  it.each([
    ["Andrés Saray Gómez", "AG"],
    ["andrés saray", "AS"],
    ["Ana", "A"],
    ["  Luis   Pérez  ", "LP"],
    ["Ángela Óvalle", "ÁÓ"],
    ["", "?"],
    ["   ", "?"],
  ])("%j → %s", (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});
