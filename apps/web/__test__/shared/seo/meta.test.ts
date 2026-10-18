import { describe, expect, it } from "vitest";
import { buildMeta, SITE_NAME } from "@/shared/seo/meta";

describe("buildMeta", () => {
  it("by default: site name and noindex", () => {
    expect(buildMeta()).toEqual([{ title: SITE_NAME }, { name: "robots", content: "noindex, nofollow" }]);
  });

  it("with title and description", () => {
    expect(buildMeta({ title: "Métricas", description: "Costos", noindex: false })).toEqual([
      { title: `Métricas · ${SITE_NAME}` },
      { name: "description", content: "Costos" },
    ]);
  });
});
