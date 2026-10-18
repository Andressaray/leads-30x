import { afterEach, describe, expect, it, vi } from "vitest";
import { descargarBlob } from "@/shared/lib/download";

describe("descargarBlob", () => {
  const { createObjectURL, revokeObjectURL } = URL;
  afterEach(() => {
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
  });

  it("crea un enlace con el nombre, lo pulsa y libera la URL", () => {
    URL.createObjectURL = vi.fn(() => "blob:fake");
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.href).toBe("blob:fake");
      expect(this.download).toBe("leads.csv");
    });

    descargarBlob(new Blob(["a,b"]), "leads.csv");

    expect(click).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fake");
  });
});
