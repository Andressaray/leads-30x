// Panel lateral para contactar un lead: elegir canal, enviar o registrar, anotar la respuesta y ver el historial.
// Se abre desde la tabla de leads; al cerrarlo, la tabla se refresca si algo cambió.
import { useEffect, useId, useRef, useState } from "react";
import { mensajeDeError } from "@/shared/lib/http";
import { cn } from "@/shared/lib/cn";
import { useSesion } from "@/shared/hooks/use-session";
import { Aviso, IconoCerrar, Skeleton } from "@/shared/ui";
import { useFicha } from "../hooks/use-ficha";
import { marcarNoContactar } from "../services/contacto.service";
import type { CanalConPermiso, FichaContacto } from "../types";
import { EstadoChip } from "./EstadoChip";
import { FormCorreo, FormLlamada, FormRespuesta, FormWhatsapp } from "./FormulariosContacto";
import { Historial } from "./Historial";
import { CalidadChip } from "./CalidadChip";
import { SeccionCalificacion } from "./SeccionCalificacion";

const PESTANAS: { canal: CanalConPermiso; etiqueta: string }[] = [
  { canal: "EMAIL", etiqueta: "Correo" },
  { canal: "WHATSAPP", etiqueta: "WhatsApp" },
  { canal: "LLAMADA", etiqueta: "Llamada" },
];

const capitalizar = (s: string) => s.toLocaleLowerCase("es-CO").replace(/(^|\s)\p{L}/gu, (l) => l.toLocaleUpperCase("es-CO"));

/** Pestaña inicial: la del último canal usado esta semana o, si no, el primero que tenga datos. */
function pestanaInicial(f: FichaContacto): CanalConPermiso {
  const ultimo = f.interacciones.find((i) => i.sentido === "SALIENTE" && i.canal !== "OTRO")?.canal;
  // La llamada de Dapta cuenta como llamada (regla de un canal por semana).
  if (ultimo && ultimo !== "OTRO") return ultimo === "DAPTA" ? "LLAMADA" : ultimo;
  if (f.canales.email.length) return "EMAIL";
  if (f.canales.whatsapp.length) return "WHATSAPP";
  return "LLAMADA";
}

interface PanelContactoProps {
  leadId: number;
  onCerrar: (huboCambios: boolean) => void;
}

export function PanelContacto({ leadId, onCerrar }: PanelContactoProps) {
  const ficha = useFicha(leadId);
  const yo = useSesion()?.usuario;
  const [cambios, setCambios] = useState(false);
  const [exito, setExito] = useState<string | null>(null);
  const tituloId = useId();
  const panel = useRef<HTMLElement>(null);
  const cerrar = () => onCerrar(cambios);

  // Escape cierra; el foco entra al panel y vuelve a donde estaba al cerrarlo. La página de atrás no se desplaza.
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>(".panel-cerrar")?.focus();
    const scroll = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = scroll;
      previo?.focus({ preventScroll: true });
    };
  }, []);
  const cerrarRef = useRef(cerrar);
  useEffect(() => {
    cerrarRef.current = cerrar;
  });
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && cerrarRef.current();
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, []);

  function hecho(mensaje: string) {
    setCambios(true);
    setExito(mensaje);
    ficha.recargar();
  }

  return (
    <>
      <div className="panel-fondo" aria-hidden="true" onClick={cerrar} />
      <aside ref={panel} className="panel-contacto" role="dialog" aria-modal="true" aria-labelledby={tituloId}>
        <header className="panel-cabecera">
          <div>
            <h2 id={tituloId}>{ficha.estado === "listo" ? ficha.ficha.lead.nombre : "Contactar"}</h2>
            {ficha.estado === "listo" && (
              <p>
                {capitalizar(ficha.ficha.lead.municipio)}, {ficha.ficha.lead.departamento}
                {ficha.ficha.lead.contactadoPor &&
                  (ficha.ficha.lead.contactadoPor.id === yo?.id ? " · Lo trabajas tú" : ` · Lo trabaja ${ficha.ficha.lead.contactadoPor.fullName}`)}
              </p>
            )}
          </div>
          <button type="button" className="panel-cerrar" onClick={cerrar} aria-label="Cerrar">
            <IconoCerrar />
          </button>
        </header>

        <div className="panel-cuerpo">
          {ficha.estado === "cargando" && (
            <div className="panel-cargando">
              <Skeleton width="40%" height={14} />
              <Skeleton width="100%" height={180} />
              <Skeleton width="70%" height={14} />
            </div>
          )}
          {ficha.estado === "error" && <Aviso tipo="error" titulo="No se pudo cargar el lead." detalles={[ficha.mensaje]} />}
          {ficha.estado === "listo" && (
            <ContenidoFicha key={leadId} ficha={ficha.ficha} plantillas={ficha.plantillas} exito={exito} onHecho={hecho} />
          )}
        </div>
      </aside>
    </>
  );
}

interface ContenidoProps {
  ficha: FichaContacto;
  plantillas: Parameters<typeof FormCorreo>[0]["plantillas"];
  exito: string | null;
  onHecho: (mensaje: string) => void;
}

function ContenidoFicha({ ficha, plantillas, exito, onHecho }: ContenidoProps) {
  const yo = useSesion()?.usuario;
  const [pestana, setPestana] = useState<CanalConPermiso>(() => pestanaInicial(ficha));
  const { lead, permiso } = ficha;
  const bloqueoCanal = permiso.motivo ?? permiso.porCanal[pestana];
  // Los bloqueos "duros" (no contactar, no interesado, de otra persona) ocultan los formularios;
  // los de horario o frecuencia los dejan ver, con el botón deshabilitado y el motivo.
  const esDeOtro = Boolean(lead.contactadoPorId && lead.contactadoPorId !== yo?.id && yo?.rol !== "ADMIN");
  const bloqueoDuro = lead.noContactar || lead.estadoContacto === "NO_INTERESADO" || esDeOtro;
  const Form = pestana === "EMAIL" ? FormCorreo : pestana === "WHATSAPP" ? FormWhatsapp : FormLlamada;

  return (
    <>
      <div className="panel-estado">
        <EstadoChip estado={lead.estadoContacto} noContactar={lead.noContactar} />
        {lead.calidad && <CalidadChip calidad={lead.calidad} puntaje={lead.puntaje} />}
        {lead.respondioEn && <span>Respondió el {new Date(lead.respondioEn).toLocaleDateString("es-CO")}</span>}
      </div>

      {exito && (
        <div className="aviso aviso-exito" role="status">
          <span aria-hidden>✓</span>
          <div className="aviso-titulo">{exito}</div>
        </div>
      )}
      {ficha.correo.modo === "simulado" && (
        <Aviso tipo="info" className="aviso-compacto" titulo="Correo en modo simulado">
          No hay SMTP configurado: los correos se registran pero no salen. Configura SMTP_HOST en la API para enviarlos.
        </Aviso>
      )}
      {ficha.correo.modo === "desactivado" && (
        <Aviso tipo="error" className="aviso-compacto" titulo="El envío de correo no está configurado en el servidor (falta SMTP_HOST)." />
      )}

      <section className="panel-seccion">
        <h3>Contactar</h3>
        {bloqueoDuro ? (
          <Aviso tipo="error" className="aviso-compacto" titulo={permiso.motivo ?? "No se puede contactar a este lead."} />
        ) : (
          <>
            <div className="pestanas" role="tablist" aria-label="Canal">
              {PESTANAS.map((p) => (
                <button
                  key={p.canal}
                  type="button"
                  role="tab"
                  aria-selected={pestana === p.canal}
                  className={cn("pestana", pestana === p.canal && "activa")}
                  onClick={() => setPestana(p.canal)}
                >
                  {p.etiqueta}
                </button>
              ))}
            </div>
            {bloqueoCanal && <Aviso tipo="info" className="aviso-compacto aviso-ley" titulo={bloqueoCanal} />}
            <Form key={pestana} ficha={ficha} plantillas={plantillas} bloqueo={bloqueoCanal} onHecho={onHecho} />
          </>
        )}
      </section>

      {lead.estadoContacto !== "PENDIENTE" && !esDeOtro && (
        <section className="panel-seccion">
          <h3>Registrar respuesta</h3>
          <FormRespuesta ficha={ficha} onHecho={onHecho} />
        </section>
      )}

      <section className="panel-seccion">
        <h3>Calificación</h3>
        <SeccionCalificacion ficha={ficha} soloLectura={esDeOtro} onHecho={onHecho} />
      </section>

      <section className="panel-seccion">
        <h3>Historial</h3>
        <Historial interacciones={ficha.interacciones} />
      </section>

      {!lead.noContactar && <NoContactar leadId={lead.id} onHecho={onHecho} />}
    </>
  );
}

function NoContactar({ leadId, onHecho }: { leadId: number; onHecho: (m: string) => void }) {
  const [confirmando, setConfirmando] = useState(false);
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function confirmar() {
    try {
      await marcarNoContactar(leadId, nota || undefined);
      onHecho("Listo: no se le volverá a escribir ni llamar.");
    } catch (err) {
      setError(mensajeDeError(err));
    }
  }

  if (!confirmando) {
    return (
      <button type="button" className="btn-enlace btn-peligro" onClick={() => setConfirmando(true)}>
        Pidió no volver a ser contactado
      </button>
    );
  }
  return (
    <div className="confirmar-baja">
      <p>Nadie del equipo podrá volver a escribirle ni llamarlo. Esto no se puede deshacer desde la app.</p>
      <input placeholder="Cómo lo pidió (opcional)" maxLength={1000} value={nota} onChange={(e) => setNota(e.target.value)} />
      {error && <Aviso tipo="error" className="aviso-compacto" titulo={error} />}
      <div className="confirmar-botones">
        <button type="button" onClick={() => setConfirmando(false)}>
          Cancelar
        </button>
        <button type="button" className="btn-peligro-solido" onClick={confirmar}>
          Sí, no contactar más
        </button>
      </div>
    </div>
  );
}
