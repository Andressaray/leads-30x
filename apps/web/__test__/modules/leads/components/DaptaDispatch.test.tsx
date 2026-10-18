import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DaptaDispatch } from "@/modules/leads/components/DaptaDispatch";
import type { DaptaStatus } from "@/modules/contact";
import { lead } from "../../../helpers/fixtures";
import { failure, call, mockFetch, ok } from "../../../helpers/http";

const DAPTA: DaptaStatus = { mode: "active", contacts: true, webhook: true, urlWebhook: null };

const LEADS = [
  lead({ id: 1, name: "Uno" }),
  lead({ id: 2, name: "Dos" }),
  lead({ id: 3, name: "Calificado", quality: "HIGH" }),
  lead({ id: 4, name: "Bloqueado", doNotContact: true }),
];

describe("EnvioDapta", () => {
  it("it is not shown if Dapta is disabled or does not respond", async () => {
    const f = mockFetch({ "/api/dapta/status": ok({ ...DAPTA, mode: "disabled" }) });
    const { container, unmount } = render(<DaptaDispatch leads={LEADS} onSent={vi.fn()} />);
    await vi.waitFor(() => expect(f).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
    unmount();

    mockFetch({ "/api/dapta/status": failure(500, "caída") });
    const other = render(<DaptaDispatch leads={LEADS} onSent={vi.fn()} />);
    await new Promise((r) => setTimeout(r, 0));
    expect(other.container).toBeEmptyDOMElement();
  });

  it("only sends the ones that are neither qualified nor blocked, after confirmation", async () => {
    const f = mockFetch({
      "/api/dapta/status": ok(DAPTA),
      "POST /api/dapta/dispatches": ok({
        sent: 1,
        skipped: 1,
        results: [
          { leadId: 1, ok: true, reason: null },
          { leadId: 2, ok: false, reason: "Fuera del horario legal" },
        ],
      }),
    });
    const onSent = vi.fn();
    render(<DaptaDispatch leads={LEADS} onSent={onSent} />);

    expect(await screen.findByText("2 leads de esta página sin calificar.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Enviar a Dapta" }));
    expect(screen.getByText(/¿Mandar 2 leads a Dapta\? El agente los llamará/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Sí, enviar" }));

    const notice = await screen.findByRole("status");
    expect(notice).toHaveTextContent("1 enviado a Dapta, 1 omitido.");
    expect(notice).toHaveTextContent("Dos: Fuera del horario legal");
    expect(call(f, 1).body).toEqual({ leadIds: [1, 2] });
    expect(onSent).toHaveBeenCalledOnce();
  });

  it("it can be cancelled without sending anything", async () => {
    const f = mockFetch({ "/api/dapta/status": ok(DAPTA) });
    render(<DaptaDispatch leads={LEADS} onSent={vi.fn()} />);
    await userEvent.click(await screen.findByRole("button", { name: "Enviar a Dapta" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByRole("button", { name: "Enviar a Dapta" })).toBeInTheDocument();
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("if none was sent it does not reload the table and marks it as an error", async () => {
    mockFetch({
      "/api/dapta/status": ok(DAPTA),
      "POST /api/dapta/dispatches": ok({ sent: 0, skipped: 1, results: [{ leadId: 1, ok: false, reason: "Sin teléfono" }] }),
    });
    const onSent = vi.fn();
    render(<DaptaDispatch leads={[lead({ id: 1, name: "Uno" })]} onSent={onSent} />);
    expect(await screen.findByText("1 lead de esta página sin calificar.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Enviar a Dapta" }));
    await userEvent.click(screen.getByRole("button", { name: "Sí, enviar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("0 enviados a Dapta, 1 omitido.Uno: Sin teléfono");
    expect(onSent).not.toHaveBeenCalled();
  });

  it("shows the error if the API fails", async () => {
    mockFetch({ "/api/dapta/status": ok(DAPTA), "POST /api/dapta/dispatches": failure(503, "Dapta no responde") });
    render(<DaptaDispatch leads={LEADS} onSent={vi.fn()} />);
    await userEvent.click(await screen.findByRole("button", { name: "Enviar a Dapta" }));
    await userEvent.click(screen.getByRole("button", { name: "Sí, enviar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Dapta no responde");
    expect(screen.getByRole("button", { name: "Sí, enviar" })).toBeEnabled();
  });

  it("in simulated mode it warns and disables the button if everything is qualified", async () => {
    mockFetch({ "/api/dapta/status": ok({ ...DAPTA, mode: "simulated" }) });
    render(<DaptaDispatch leads={[lead({ quality: "LOW" })]} onSent={vi.fn()} />);
    expect(await screen.findByText(/Todos los leads de esta página ya están calificados\. Dapta está en modo simulado/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar a Dapta" })).toBeDisabled();
  });
});
