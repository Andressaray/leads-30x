import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadBlob } from "@/shared/lib/download";

describe("downloadBlob", () => {
  const { createObjectURL, revokeObjectURL } = URL;
  afterEach(() => {
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
  });

  it("creates a link with the name, clicks it and releases the URL", () => {
    URL.createObjectURL = vi.fn(() => "blob:fake");
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.href).toBe("blob:fake");
      expect(this.download).toBe("leads.csv");
    });

    downloadBlob(new Blob(["a,b"]), "leads.csv");

    expect(click).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fake");
  });
});
