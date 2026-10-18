import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MetricasPage from "@/modules/metricas/route";
import type { Costo, Metricas, MetricaCanal, MetricaFuente } from "@/modules/metricas/types";
import { sessionStore } from "@/shared/lib/session-store";
import { sesion } from "../../helpers/fixtures";
import { falla, llamada, mockFetch, ok } from "../../helpers/http";

const IND = { tasaRespuesta: 0.5, indiceCalidad: 70, tasaAlta: 0.4, costoPorRespuesta: 20000, costoPorLeadAlta: 50000 };
const EMB = { contactados: 10, respondieron: 5, interesados: 2, calificados: 5, alta: 2 };

const fuente = (f: string, c: Partial<MetricaFuente> = {}): MetricaFuente => ({
  fuente: f, leads: 40, contactables: 30, costo: { directo: 100000, general: 50000, contacto: 50000, total: 200000 }, cpl: 5000, ...EMB, ...IND, ...c,
});
const canal = (c: MetricaCanal["canal"]): MetricaCanal => ({ canal: c, contactos: 12, leadsContactados: 10, costo: 80000, costoPorContacto: 8000, ...EMB, ...IND });

function metricas(c: Partial<Metricas["totales"]> = {}): Metricas {
  return {
    periodo: { desde: "2026-10-01", hasta: "2026-10-18", dias: 18 },
    totales: { leads: 1250, contactados: 300, respondieron: 45, calificados: 20, alta: 8, costoTotal: 2500000, costoSinAsignar: 0, cpl: 2000, costoPorRespuesta: 55556, costoPorLeadAlta: 312500, indiceCalidad: 64, ...c },
    porFuente: [fuente("dane"), fuente("osm", { cpl: 1500 })],
    porCanal: [canal("email"), canal("dapta")],
    costos: {},
  };
}

const COSTO: Costo = { id: 3, canal: "dapta", tipo: "HORAS", descripcion: "Revisión de llamadas", monto: 400000, horas: 8, valorHora: 50000, desde: "2026-10-01", hasta: "2026-10-31" };

function Url() {
  return <output data-testid="url">{useLocation().search}</output>;
}

function abrir(url = "/metricas") {
  const Stub = createRoutesStub([{ path: "/metricas", Component: () => (<><MetricasPage /><Url /></>) }]);
  return render(<Stub initialEntries={[url]} />);
}

function api(opc: { m?: Metricas | Response; costos?: Costo[] } = {}) {
  return mockFetch({
    "/api/metricas": opc.m instanceof Response ? opc.m : ok(opc.m ?? metricas()),
    "GET /api/costos": ok(opc.costos ?? []),
    "POST /api/costos": ok({ ...COSTO, id: 10 }, 201),
    "DELETE /api/costos/3": ok({ id: 3 }),
  });
}

const kpi = (titulo: string) => screen.getByText(titulo, { selector: ".kpi span" }).parentElement!;
const sinEspacios = (s: string | null) => (s ?? "").replace(/\s/g, " ");

describe("Métricas", () => {
  // Solo se finge la fecha (los timers reales los necesita userEvent).
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date("2026-10-18T15:00:00Z"), toFake: ["Date"] });
    sessionStore.set(sesion());
  });
  afterEach(() => vi.useRealTimers());

  it("por defecto pide el mes en curso y muestra los indicadores", async () => {
    const f = api();
    abrir();
    expect(await screen.findByText("1.250")).toBeInTheDocument();
    expect(Object.fromEntries(llamada(f).url.searchParams)).toEqual({ desde: "2026-10-01", hasta: "2026-10-18" });
    expect(screen.getByRole("button", { name: "Este mes" })).toHaveAttribute("aria-pressed", "true");
    expect(sinEspacios(kpi("Costo por lead (CPL)").textContent)).toMatch(/\$ ?2\.000/);
    expect(kpi("Calidad promedio")).toHaveTextContent("64");
    expect(kpi("Costo total")).toHaveTextContent("18 días");
  });

  it("los periodos rápidos y las fechas cambian la URL y recalculan", async () => {
    const f = api();
    abrir();
    await screen.findByText("1.250");

    await userEvent.click(screen.getByRole("button", { name: "Mes pasado" }));
    expect(screen.getByTestId("url")).toHaveTextContent("?desde=2026-09-01&hasta=2026-09-30");
    await vi.waitFor(() =>
      expect(f.mock.calls.some((_c, i) => llamada(f, i).url.search === "?desde=2026-09-01&hasta=2026-09-30")).toBe(true),
    );
    expect(screen.getByRole("button", { name: "Mes pasado" })).toHaveAttribute("aria-pressed", "true");
  });

  it("ignora fechas mal formadas en la URL", async () => {
    const f = api();
    abrir("/metricas?desde=ayer&hasta=2026-10-10");
    await screen.findByText("1.250");
    expect(llamada(f).url.search).toBe("?desde=2026-10-01&hasta=2026-10-10");
  });

  it("compara por fuente o por canal", async () => {
    api();
    abrir();
    await screen.findByText("1.250");
    const tabla = () => screen.getAllByRole("table")[0];
    expect(within(tabla()).getByText("DANE")).toBeInTheDocument();
    expect(within(tabla()).getByText("OpenStreetMap")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Por canal de contacto" }));
    expect(screen.getByTestId("url")).toHaveTextContent("?vista=canal");
    expect(within(tabla()).getByText("Correo")).toBeInTheDocument();
    expect(within(tabla()).getByText("Dapta")).toBeInTheDocument();
  });

  it("sin costos avisa que el CPL sale en cero (y a quién pedírselos)", async () => {
    api({ m: metricas({ costoTotal: 0, cpl: 0 }) });
    abrir();
    expect(await screen.findByText("No hay costos registrados en este periodo.")).toBeInTheDocument();
    expect(screen.getByText(/Pídele a un administrador/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Registrar costo" })).not.toBeInTheDocument();
  });

  it("avisa los costos que no se pudieron repartir", async () => {
    api({ m: metricas({ costoSinAsignar: 150000 }) });
    abrir();
    expect(await screen.findByText(/150\.000 no se pudieron repartir entre las fuentes\./)).toBeInTheDocument();
  });

  it("si la API falla lo avisa", async () => {
    api({ m: falla(500, "Consulta muy pesada") });
    abrir();
    expect(await screen.findByText("No se pudieron calcular las métricas.")).toBeInTheDocument();
    expect(screen.getByText("Consulta muy pesada")).toBeInTheDocument();
  });

  describe("costos (administrador)", () => {
    beforeEach(() => sessionStore.set(sesion({ rol: "ADMIN" })));

    it("lista los costos con su detalle por horas y deja borrarlos", async () => {
      const f = api({ costos: [COSTO] });
      abrir();
      const fila = (await screen.findByText("Revisión de llamadas")).closest("tr")!;
      expect(sinEspacios(fila.textContent)).toMatch(/8 h × \$ ?50\.000/);
      expect(sinEspacios(fila.textContent)).toMatch(/\$ ?400\.000/);

      await userEvent.click(within(fila).getByRole("button", { name: "Borrar" }));
      await vi.waitFor(() => expect(f.mock.calls.some((_c, i) => llamada(f, i).init.method === "DELETE")).toBe(true));
    });

    it("registra un gasto con el periodo de la página por defecto", async () => {
      const f = api();
      abrir();
      expect(await screen.findByText(/Registra el primero para calcular el CPL/)).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Registrar costo" }));

      await userEvent.selectOptions(screen.getByLabelText("Cargado a"), "dapta");
      await userEvent.type(screen.getByLabelText("Descripción"), "Minutos de Dapta");
      await userEvent.type(screen.getByLabelText("Monto (COP)"), "120000");
      await userEvent.click(screen.getByRole("button", { name: "Guardar costo" }));

      await screen.findByRole("button", { name: "Registrar costo" });
      const post = f.mock.calls.map((_c, i) => llamada(f, i)).find((c) => c.init.method === "POST")!;
      expect(post.body).toEqual({ canal: "dapta", tipo: "GASTO", descripcion: "Minutos de Dapta", monto: 120000, desde: "2026-10-01", hasta: "2026-10-18" });
    });

    it("las horas del equipo calculan el total", async () => {
      const f = api();
      abrir();
      await userEvent.click(await screen.findByRole("button", { name: "Registrar costo" }));
      await userEvent.click(screen.getByRole("radio", { name: "Horas del equipo" }));
      await userEvent.type(screen.getByLabelText("Descripción"), "Revisión manual");
      await userEvent.type(screen.getByLabelText("Horas"), "2.5");
      await userEvent.type(screen.getByLabelText("Valor de la hora (COP)"), "40000");
      expect(sinEspacios(screen.getByText("Total").nextElementSibling!.textContent)).toMatch(/\$ ?100\.000/);

      await userEvent.click(screen.getByRole("button", { name: "Guardar costo" }));
      await screen.findByRole("button", { name: "Registrar costo" });
      const post = f.mock.calls.map((_c, i) => llamada(f, i)).find((c) => c.init.method === "POST")!;
      expect(post.body).toMatchObject({ canal: "general", tipo: "HORAS", horas: 2.5, valorHora: 40000 });
    });
  });
});
