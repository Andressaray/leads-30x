import { describe, expect, it } from "vitest";
import { cn } from "@/shared/lib/cn";

describe("cn", () => {
  it("une las clases y descarta las falsas", () => {
    expect(cn("a", false, null, undefined, "", "b")).toBe("a b");
  });

  it("devuelve cadena vacía si no hay clases", () => {
    expect(cn(false, null)).toBe("");
  });
});
