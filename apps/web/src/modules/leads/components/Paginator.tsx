interface PaginatorProps {
  total: number;
  page: number;
  limit: number;
  onChange: (page: number) => void;
}

export function Paginator({ total, page, limit, onChange }: PaginatorProps) {
  if (!total) return null;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="paginator">
      <span>
        {total} lead{total === 1 ? "" : "s"} · página {page} de {totalPages}
      </span>
      <div className="paginator-buttons">
        <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          ‹ Anterior
        </button>
        <button type="button" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
          Siguiente ›
        </button>
      </div>
    </div>
  );
}
