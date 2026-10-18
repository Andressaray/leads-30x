/**
 * Ejecuta tareas una a la vez, en orden de llegada. Las fuentes son servicios
 * públicos con límite por IP, así que no conviene lanzar búsquedas en paralelo.
 */
export class ColaSerial {
  private cola: Promise<unknown> = Promise.resolve();
  private pendientes = 0;

  get enEspera(): number {
    return this.pendientes;
  }

  ejecutar<T>(tarea: () => Promise<T>): Promise<T> {
    this.pendientes += 1;
    const resultado = this.cola.then(() => tarea());
    this.cola = resultado.catch(() => undefined);
    return resultado.finally(() => {
      this.pendientes -= 1;
    });
  }
}
