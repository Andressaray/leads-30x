// Lista desplegable con el estilo de la app (avatar, detalle, marca de elegido). Accesible:
// botón + listbox con flechas, Inicio/Fin, Enter/Espacio, Escape y búsqueda por la primera letra.
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

export interface OpcionSelector {
  valor: string;
  etiqueta: string;
  /** Segunda línea, más tenue. */
  detalle?: string;
  /** Va antes del texto (avatar, ícono). */
  inicio?: ReactNode;
  /** Va al final de la fila (etiqueta "Tú", conteo…). */
  fin?: ReactNode;
  /** Dibuja una línea divisoria después de esta opción. */
  separada?: boolean;
}

interface SelectorProps {
  etiqueta: string;
  opciones: OpcionSelector[];
  valor: string;
  onCambiar: (valor: string) => void;
  deshabilitado?: boolean;
  /** Texto del botón cuando el valor no está entre las opciones. */
  placeholder?: string;
  className?: string;
}

const sinTildes = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

const Chevron = () => (
  <svg className="selector-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const Check = () => (
  <svg className="selector-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

function Texto({ opcion }: { opcion: OpcionSelector }) {
  return (
    <span className="selector-texto">
      <span className="selector-titulo">{opcion.etiqueta}</span>
      {opcion.detalle && <span className="selector-detalle">{opcion.detalle}</span>}
    </span>
  );
}

export function Selector({ etiqueta, opciones, valor, onCambiar, deshabilitado, placeholder = "Elige una opción…", className }: SelectorProps) {
  const id = useId();
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const raiz = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const lista = useRef<HTMLUListElement>(null);

  const elegida = opciones.find((o) => o.valor === valor);
  const idOpcion = (i: number) => `${id}-op-${i}`;

  // Al abrir: foco en la lista y cierre con un clic afuera.
  useEffect(() => {
    if (!abierto) return;
    lista.current?.focus();
    const fuera = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("pointerdown", fuera);
    return () => document.removeEventListener("pointerdown", fuera);
  }, [abierto]);

  // La opción activa siempre a la vista.
  useEffect(() => {
    if (abierto) document.getElementById(`${id}-op-${activo}`)?.scrollIntoView({ block: "nearest" });
  }, [abierto, activo, id]);

  function abrir() {
    setActivo(Math.max(0, opciones.findIndex((o) => o.valor === valor)));
    setAbierto(true);
  }

  function cerrar(enfocarBoton = true) {
    setAbierto(false);
    if (enfocarBoton) boton.current?.focus();
  }

  function elegir(i: number) {
    const o = opciones[i];
    if (o && o.valor !== valor) onCambiar(o.valor);
    cerrar();
  }

  function teclaBoton(e: KeyboardEvent<HTMLButtonElement>) {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      abrir();
    }
  }

  function teclaLista(e: KeyboardEvent<HTMLUListElement>) {
    const ultimo = opciones.length - 1;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActivo((i) => Math.min(ultimo, i + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActivo((i) => Math.max(0, i - 1));
        break;
      case "Home":
        e.preventDefault();
        setActivo(0);
        break;
      case "End":
        e.preventDefault();
        setActivo(ultimo);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        elegir(activo);
        break;
      case "Escape":
        e.preventDefault();
        cerrar();
        break;
      case "Tab":
        cerrar(false);
        break;
      default:
        if (e.key.length === 1 && /\S/.test(e.key)) {
          // Salta a la siguiente opción que empiece por esa letra.
          const letra = sinTildes(e.key);
          for (let paso = 1; paso <= opciones.length; paso++) {
            const i = (activo + paso) % opciones.length;
            if (sinTildes(opciones[i].etiqueta).startsWith(letra)) {
              setActivo(i);
              break;
            }
          }
        }
    }
  }

  return (
    <div ref={raiz} className={cn("selector", abierto && "abierto", className)}>
      <span className="selector-etiqueta" id={`${id}-etq`}>
        {etiqueta}
      </span>
      <button
        ref={boton}
        type="button"
        className="selector-boton"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={abierto ? `${id}-lista` : undefined}
        aria-labelledby={`${id}-etq ${id}-val`}
        disabled={deshabilitado}
        onClick={() => (abierto ? cerrar() : abrir())}
        onKeyDown={teclaBoton}
      >
        {elegida?.inicio}
        <span id={`${id}-val`} className="selector-valor">
          {elegida ? <Texto opcion={elegida} /> : <span className="selector-titulo selector-placeholder">{placeholder}</span>}
        </span>
        {elegida?.fin}
        <Chevron />
      </button>

      {abierto && (
        <ul
          ref={lista}
          id={`${id}-lista`}
          role="listbox"
          tabIndex={-1}
          className="selector-lista"
          aria-labelledby={`${id}-etq`}
          aria-activedescendant={idOpcion(activo)}
          onKeyDown={teclaLista}
        >
          {opciones.map((o, i) => (
            <li
              key={o.valor}
              id={idOpcion(i)}
              role="option"
              aria-selected={o.valor === valor}
              className={cn("selector-opcion", i === activo && "activa", o.valor === valor && "elegida", o.separada && "separada")}
              onPointerMove={() => i !== activo && setActivo(i)}
              onClick={() => elegir(i)}
            >
              {o.inicio}
              <Texto opcion={o} />
              {o.fin}
              <Check />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
