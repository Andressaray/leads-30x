import { describe, expect, it } from "vitest";
import { cn } from "@/shared/lib/cn";

describe("cn", () => {
  it("joins the classes and drops the falsy ones", () => {
    expect(cn("a", false, null, undefined, "", "b")).toBe("a b");
  });

  it("returns an empty string when there are no classes", () => {
    expect(cn(false, null)).toBe("");
  });
});
