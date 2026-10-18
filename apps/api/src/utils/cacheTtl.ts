/**
 * Caché en memoria con vencimiento (TTL) y tamaño máximo. Al llenarse descarta
 * la entrada más antigua. Se pierde al reiniciar el servidor, a propósito: los
 * leads ya quedan guardados en la base; esto solo evita volver a pedirle lo
 * mismo a las fuentes públicas durante unas horas.
 */
export class CacheTtl<V> {
  private readonly datos = new Map<string, { valor: V; vence: number }>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntradas = 100,
    private readonly ahora: () => number = Date.now
  ) {}

  get activa(): boolean {
    return this.ttlMs > 0 && this.maxEntradas > 0;
  }

  get(clave: string): V | undefined {
    const e = this.datos.get(clave);
    if (!e) return undefined;
    if (e.vence <= this.ahora()) {
      this.datos.delete(clave);
      return undefined;
    }
    return e.valor;
  }

  set(clave: string, valor: V): void {
    if (!this.activa) return;
    this.datos.delete(clave);
    while (this.datos.size >= this.maxEntradas) {
      const masAntigua = this.datos.keys().next().value;
      if (masAntigua === undefined) break;
      this.datos.delete(masAntigua);
    }
    this.datos.set(clave, { valor, vence: this.ahora() + this.ttlMs });
  }

  get tamano(): number {
    return this.datos.size;
  }
}

/** Rechaza si la promesa no termina en `ms`. La tarea de fondo sigue, pero ya no se espera. */
export function conLimiteDeTiempo<T>(promesa: Promise<T>, ms: number, mensaje: string): Promise<T> {
  if (!(ms > 0) || !Number.isFinite(ms)) return promesa;
  let temporizador: NodeJS.Timeout | undefined;
  const limite = new Promise<never>((_, rechazar) => {
    temporizador = setTimeout(() => rechazar(new Error(mensaje)), ms);
    temporizador.unref?.();
  });
  return Promise.race([promesa, limite]).finally(() => clearTimeout(temporizador));
}
