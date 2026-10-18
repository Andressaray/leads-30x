import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EnvioDapta } from "@/modules/leads/components/EnvioDapta";
import type { EstadoDapta } from "@/modules/contacto";
import { lead } from "../../../helpers/fixtures";
import { falla, llamada, mockFetch, ok } from "../../../helpers/http";

const DAPTA: EstadoDapta = { modo: "activo", contacta: true, webhook: true, urlWebhook: null };

const LEADS = [
  lead({ id: 1, nombre: "Uno" }),
  lead({ id: 2, nombre: "Dos" }),
  lead({ id: 3, nombre: "Calificado", calidad: "ALTA" }),
  lead({ id: 4, nombre: "Bloqueado", noContactar: true }),
];

describe("EnvioDapta", () => {
  it("no se muestra si Dapta está desactivado o no responde", async () => {
    const f = mockFetch({ "/api/dapta/estado": ok({ ...DAPTA, modo: "desactivado" }) });
    const { container, unmount } = render(<EnvioDapta leads={LEADS} onEnviados={vi.fn()} />);
    await vi.waitFor(() => expect(f).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
    unmount();

    mockFetch({ "/api/dapta/estado": falla(500, "caída") });
    const otro = render(<EnvioDapta leads={LEADS} onEnviados={vi.fn()} />);
    await new Promise((r) => setTimeout(r, 0));
    expect(otro.container).toBeEmptyDOMElement();
  });

  it("solo manda los que no están calificados ni bloqueados, previa confirmación", async () => {
    const f = mockFetch({
      "/api/dapta/estado": ok(DAPTA),
      "POST /api/dapta/envios": ok({
        enviados: 1,
        omitidos: 1,
        resultados: [
          { leadId: 1, ok: true, motivo: null },
          { leadId: 2, ok: false, motivo: "Fuera del horario legal" },
        ],
      }),
    });
    const onEnviados = vi.fn();
    render(<EnvioDapta leads={LEADS} onEnviados={onEnviados} />);

    expect(await screen.findByText("2 leads de esta página sin calificar.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Enviar a Dapta" }));
    expect(screen.getByText(/¿Mandar 2 leads a Dapta\? El agente los llamará/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Sí, enviar" }));

    const aviso = await screen.findByRole("status");
    expect(aviso).toHaveTextContent("1 enviado a Dapta, 1 omitido.");
    expect(aviso).toHaveTextContent("Dos: Fuera del horario legal");
    expect(llamada(f, 1).body).toEqual({ leadIds: [1, 2] });
    expect(onEnviados).toHaveBeenCalledOnce();
  });

  it("se puede cancelar sin mandar nada", async () => {
    const f = mockFetch({ "/api/dapta/estado": ok(DAPTA) });
    render(<EnvioDapta leads={LEADS} onEnviados={vi.fn()} />);
    await userEvent.click(await screen.findByRole("button", { name: "Enviar a Dapta" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByRole("button", { name: "Enviar a Dapta" })).toBeInTheDocument();
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("si ninguno se envió no recarga la tabla y lo marca como error", async () => {
    mockFetch({
      "/api/dapta/estado": ok(DAPTA),
      "POST /api/dapta/envios": ok({ enviados: 0, omitidos: 1, resultados: [{ leadId: 1, ok: false, motivo: "Sin teléfono" }] }),
    });
    const onEnviados = vi.fn();
    render(<EnvioDapta leads={[lead({ id: 1, nombre: "Uno" })]} onEnviados={onEnviados} />);
    expect(await screen.findByText("1 lead de esta página sin calificar.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Enviar a Dapta" }));
    await userEvent.click(screen.getByRole("button", { name: "Sí, enviar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("0 enviados a Dapta, 1 omitido.Uno: Sin teléfono");
    expect(onEnviados).not.toHaveBeenCalled();
  });

  it("muestra el error si la API falla", async () => {
    mockFetch({ "/api/dapta/estado": ok(DAPTA), "POST /api/dapta/envios": falla(503, "Dapta no responde") });
    render(<EnvioDapta leads={LEADS} onEnviados={vi.fn()} />);
    await userEvent.click(await screen.findByRole("button", { name: "Enviar a Dapta" }));
    await userEvent.click(screen.getByRole("button", { name: "Sí, enviar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Dapta no responde");
    expect(screen.getByRole("button", { name: "Sí, enviar" })).toBeEnabled();
  });

  it("en modo simulado lo advierte y deshabilita el botón si todo está calificado", async () => {
    mockFetch({ "/api/dapta/estado": ok({ ...DAPTA, modo: "simulado" }) });
    render(<EnvioDapta leads={[lead({ calidad: "BAJA" })]} onEnviados={vi.fn()} />);
    expect(await screen.findByText(/Todos los leads de esta página ya están calificados\. Dapta está en modo simulado/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar a Dapta" })).toBeDisabled();
  });
});
