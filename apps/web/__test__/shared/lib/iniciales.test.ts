import { describe, expect, it } from "vitest";
import { iniciales } from "@/shared/lib/iniciales";

describe("iniciales", () => {
  it.each([
    ["Andrés Saray Gómez", "AG"],
    ["andrés saray", "AS"],
    ["Ana", "A"],
    ["  Luis   Pérez  ", "LP"],
    ["Ángela Óvalle", "ÁÓ"],
    ["", "?"],
    ["   ", "?"],
  ])("%j → %s", (nombre, esperado) => {
    expect(iniciales(nombre)).toBe(esperado);
  });
});
