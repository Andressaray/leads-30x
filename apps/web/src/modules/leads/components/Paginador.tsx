interface PaginadorProps {
  total: number;
  pagina: number;
  limite: number;
  onCambiar: (pagina: number) => void;
}

export function Paginador({ total, pagina, limite, onCambiar }: PaginadorProps) {
  if (!total) return null;
  const totalPaginas = Math.max(1, Math.ceil(total / limite));
  return (
    <div className="paginador">
      <span>
        {total} lead{total === 1 ? "" : "s"} · página {pagina} de {totalPaginas}
      </span>
      <div className="paginador-botones">
        <button type="button" disabled={pagina <= 1} onClick={() => onCambiar(pagina - 1)}>
          ‹ Anterior
        </button>
        <button type="button" disabled={pagina >= totalPaginas} onClick={() => onCambiar(pagina + 1)}>
          Siguiente ›
        </button>
      </div>
    </div>
  );
}
