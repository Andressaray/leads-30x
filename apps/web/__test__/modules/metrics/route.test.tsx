import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MetricsPage from "@/modules/metrics/route";
import type { Cost, Metrics, ChannelMetric, SourceMetric } from "@/modules/metrics/types";
import { sessionStore } from "@/shared/lib/session-store";
import { session } from "../../helpers/fixtures";
import { failure, call, mockFetch, ok } from "../../helpers/http";

const IND = { replyRate: 0.5, qualityIndex: 70, highRate: 0.4, costPerReply: 20000, costPerHighLead: 50000 };
const EMB = { contacted: 10, replied: 5, interested: 2, qualified: 5, high: 2 };

const source = (f: string, c: Partial<SourceMetric> = {}): SourceMetric => ({
  source: f, leads: 40, contactables: 30, cost: { direct: 100000, general: 50000, contact: 50000, total: 200000 }, cpl: 5000, ...EMB, ...IND, ...c,
});
const channel = (c: ChannelMetric["channel"]): ChannelMetric => ({ channel: c, outreach: 12, contactedLeads: 10, cost: 80000, costPerContact: 8000, ...EMB, ...IND });

function metrics(c: Partial<Metrics["totals"]> = {}): Metrics {
  return {
    period: { from: "2026-10-01", to: "2026-10-18", days: 18 },
    totals: { leads: 1250, contacted: 300, replied: 45, qualified: 20, high: 8, totalCost: 2500000, unassignedCost: 0, cpl: 2000, costPerReply: 55556, costPerHighLead: 312500, qualityIndex: 64, ...c },
    bySource: [source("dane"), source("osm", { cpl: 1500 })],
    byChannel: [channel("email"), channel("dapta")],
    costs: {},
  };
}

const COST: Cost = { id: 3, channel: "dapta", type: "HOURS", description: "Revisión de llamadas", amount: 400000, hours: 8, hourlyRate: 50000, from: "2026-10-01", to: "2026-10-31" };

function Url() {
  return <output data-testid="url">{useLocation().search}</output>;
}

function open(url = "/metrics") {
  const Stub = createRoutesStub([{ path: "/metrics", Component: () => (<><MetricsPage /><Url /></>) }]);
  return render(<Stub initialEntries={[url]} />);
}

function api(opc: { m?: Metrics | Response; costs?: Cost[] } = {}) {
  return mockFetch({
    "/api/metrics": opc.m instanceof Response ? opc.m : ok(opc.m ?? metrics()),
    "GET /api/costs": ok(opc.costs ?? []),
    "POST /api/costs": ok({ ...COST, id: 10 }, 201),
    "DELETE /api/costs/3": ok({ id: 3 }),
  });
}

const kpi = (title: string) => screen.getByText(title, { selector: ".kpi span" }).parentElement!;
const noSpaces = (s: string | null) => (s ?? "").replace(/\s/g, " ");

describe("Metrics", () => {
  // Only the date is faked (userEvent needs the real timers).
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date("2026-10-18T15:00:00Z"), toFake: ["Date"] });
    sessionStore.set(session());
  });
  afterEach(() => vi.useRealTimers());

  it("by default it requests the current month and shows the indicators", async () => {
    const f = api();
    open();
    expect(await screen.findByText("1.250")).toBeInTheDocument();
    expect(Object.fromEntries(call(f).url.searchParams)).toEqual({ from: "2026-10-01", to: "2026-10-18" });
    expect(screen.getByRole("button", { name: "Este mes" })).toHaveAttribute("aria-pressed", "true");
    expect(noSpaces(kpi("Costo por lead (CPL)").textContent)).toMatch(/\$ ?2\.000/);
    expect(kpi("Calidad promedio")).toHaveTextContent("64");
    expect(kpi("Costo total")).toHaveTextContent("18 días");
  });

  it("the quick periods and the dates change the URL and recalculate", async () => {
    const f = api();
    open();
    await screen.findByText("1.250");

    await userEvent.click(screen.getByRole("button", { name: "Mes pasado" }));
    expect(screen.getByTestId("url")).toHaveTextContent("?from=2026-09-01&to=2026-09-30");
    await vi.waitFor(() =>
      expect(f.mock.calls.some((_c, i) => call(f, i).url.search === "?from=2026-09-01&to=2026-09-30")).toBe(true),
    );
    expect(screen.getByRole("button", { name: "Mes pasado" })).toHaveAttribute("aria-pressed", "true");
  });

  it("ignores malformed dates in the URL", async () => {
    const f = api();
    open("/metrics?from=ayer&to=2026-10-10");
    await screen.findByText("1.250");
    expect(call(f).url.search).toBe("?from=2026-10-01&to=2026-10-10");
  });

  it("compares by source or by channel", async () => {
    api();
    open();
    await screen.findByText("1.250");
    const table = () => screen.getAllByRole("table")[0];
    expect(within(table()).getByText("DANE")).toBeInTheDocument();
    expect(within(table()).getByText("OpenStreetMap")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Por canal de contacto" }));
    expect(screen.getByTestId("url")).toHaveTextContent("?view=channel");
    expect(within(table()).getByText("Correo")).toBeInTheDocument();
    expect(within(table()).getByText("Dapta")).toBeInTheDocument();
  });

  it("without costs it warns that the CPL comes out as zero (and whom to ask for them)", async () => {
    api({ m: metrics({ totalCost: 0, cpl: 0 }) });
    open();
    expect(await screen.findByText("No hay costos registrados en este periodo.")).toBeInTheDocument();
    expect(screen.getByText(/Pídele a un administrador/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Registrar costo" })).not.toBeInTheDocument();
  });

  it("warns about the costs that could not be split", async () => {
    api({ m: metrics({ unassignedCost: 150000 }) });
    open();
    expect(await screen.findByText(/150\.000 no se pudieron repartir entre las fuentes\./)).toBeInTheDocument();
  });

  it("if the API fails it says so", async () => {
    api({ m: failure(500, "Consulta muy pesada") });
    open();
    expect(await screen.findByText("No se pudieron calcular las métricas.")).toBeInTheDocument();
    expect(screen.getByText("Consulta muy pesada")).toBeInTheDocument();
  });

  describe("costs (administrator)", () => {
    beforeEach(() => sessionStore.set(session({ role: "ADMIN" })));

    it("lists the costs with their hours breakdown and allows deleting them", async () => {
      const f = api({ costs: [COST] });
      open();
      const row = (await screen.findByText("Revisión de llamadas")).closest("tr")!;
      expect(noSpaces(row.textContent)).toMatch(/8 h × \$ ?50\.000/);
      expect(noSpaces(row.textContent)).toMatch(/\$ ?400\.000/);

      await userEvent.click(within(row).getByRole("button", { name: "Borrar" }));
      await vi.waitFor(() => expect(f.mock.calls.some((_c, i) => call(f, i).init.method === "DELETE")).toBe(true));
    });

    it("records an expense with the page period by default", async () => {
      const f = api();
      open();
      expect(await screen.findByText(/Registra el primero para calcular el CPL/)).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Registrar costo" }));

      await userEvent.selectOptions(screen.getByLabelText("Cargado a"), "dapta");
      await userEvent.type(screen.getByLabelText("Descripción"), "Minutos de Dapta");
      await userEvent.type(screen.getByLabelText("Monto (COP)"), "120000");
      await userEvent.click(screen.getByRole("button", { name: "Guardar costo" }));

      await screen.findByRole("button", { name: "Registrar costo" });
      const post = f.mock.calls.map((_c, i) => call(f, i)).find((c) => c.init.method === "POST")!;
      expect(post.body).toEqual({ channel: "dapta", type: "EXPENSE", description: "Minutos de Dapta", amount: 120000, from: "2026-10-01", to: "2026-10-18" });
    });

    it("team hours calculate the total", async () => {
      const f = api();
      open();
      await userEvent.click(await screen.findByRole("button", { name: "Registrar costo" }));
      await userEvent.click(screen.getByRole("radio", { name: "Horas del equipo" }));
      await userEvent.type(screen.getByLabelText("Descripción"), "Revisión manual");
      await userEvent.type(screen.getByLabelText("Horas"), "2.5");
      await userEvent.type(screen.getByLabelText("Valor de la hora (COP)"), "40000");
      expect(noSpaces(screen.getByText("Total").nextElementSibling!.textContent)).toMatch(/\$ ?100\.000/);

      await userEvent.click(screen.getByRole("button", { name: "Guardar costo" }));
      await screen.findByRole("button", { name: "Registrar costo" });
      const post = f.mock.calls.map((_c, i) => call(f, i)).find((c) => c.init.method === "POST")!;
      expect(post.body).toMatchObject({ channel: "general", type: "HOURS", hours: 2.5, hourlyRate: 40000 });
    });
  });
});
