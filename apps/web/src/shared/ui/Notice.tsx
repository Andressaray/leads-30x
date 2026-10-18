import type { ReactNode } from "react";

interface NoticeProps {
  type: "error" | "info";
  title: ReactNode;
  details?: ReactNode[];
  children?: ReactNode;
  className?: string;
}

export function Notice({ type, title, details = [], children, className }: NoticeProps) {
  return (
    <div className={`notice notice-${type}${className ? ` ${className}` : ""}`} role={type === "error" ? "alert" : "status"}>
      <span className="notice-icon" aria-hidden>
        {type === "error" ? "⚠" : "⏳"}
      </span>
      <div>
        <div className="notice-title">{title}</div>
        {children}
        {details.length > 0 && (
          <ul className="notice-details">
            {details.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
