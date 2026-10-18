import { describe, expect, it } from "vitest";
import { whatsappLink } from "@/modules/contact/statuses";

describe("whatsappLink", () => {
  it("adds the 57 country code to a 10-digit mobile number and removes the symbols", () => {
    expect(whatsappLink("300 123-4567", "")).toBe("https://wa.me/573001234567");
  });

  it("respects a number that already has a country code", () => {
    expect(whatsappLink("+57 300 123 4567", "")).toBe("https://wa.me/573001234567");
  });

  it("encodes the message in ?text=", () => {
    expect(whatsappLink("3001234567", "Hola, ¿cómo están? & más")).toBe(
      "https://wa.me/573001234567?text=Hola%2C%20%C2%BFc%C3%B3mo%20est%C3%A1n%3F%20%26%20m%C3%A1s",
    );
  });
});
