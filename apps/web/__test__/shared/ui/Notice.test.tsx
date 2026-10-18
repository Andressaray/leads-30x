import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Notice } from "@/shared/ui";

describe("Notice", () => {
  it("an error is announced as an alert with its details", () => {
    render(<Notice type="error" title="Falló" details={["DANE: timeout", "OSM: 429"]} className="extra" />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveClass("notice", "notice-error", "extra");
    expect(alert).toHaveTextContent("Falló");
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(["DANE: timeout", "OSM: 429"]);
  });

  it("an informational notice is a status, without a list when there are no details", () => {
    render(
      <Notice type="info" title="Buscando…">
        Puede tardar
      </Notice>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Buscando…Puede tardar");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
