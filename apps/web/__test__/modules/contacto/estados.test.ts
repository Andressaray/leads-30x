import { describe, expect, it } from "vitest";
import { enlaceWhatsapp } from "@/modules/contacto/estados";

describe("enlaceWhatsapp", () => {
  it("agrega el indicativo 57 a un celular de 10 dígitos y quita los signos", () => {
    expect(enlaceWhatsapp("300 123-4567", "")).toBe("https://wa.me/573001234567");
  });

  it("respeta un número que ya trae indicativo", () => {
    expect(enlaceWhatsapp("+57 300 123 4567", "")).toBe("https://wa.me/573001234567");
  });

  it("codifica el mensaje en ?text=", () => {
    expect(enlaceWhatsapp("3001234567", "Hola, ¿cómo están? & más")).toBe(
      "https://wa.me/573001234567?text=Hola%2C%20%C2%BFc%C3%B3mo%20est%C3%A1n%3F%20%26%20m%C3%A1s",
    );
  });
});
