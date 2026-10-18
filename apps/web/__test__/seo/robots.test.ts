import { describe, expect, it } from "vitest";
import { loader } from "@/seo/robots";

describe("robots.txt", () => {
  it("forbids indexing the whole site", async () => {
    const res = loader();
    expect(res.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    await expect(res.text()).resolves.toBe("User-agent: *\nDisallow: /\n");
  });
});
