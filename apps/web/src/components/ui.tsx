import { X } from "lucide-react";
import type { ReactNode } from "react";
import { priorityLabel, statusLabel, type OrderStatus, type Priority } from "../types";

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return <header className="page-header">
    <div>
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </div>
    {actions && <div className="page-actions">{actions}</div>}
  </header>;
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`badge status-${status}`}>{statusLabel[status]}</span>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={`priority priority-${priority}`}><i />{priorityLabel[priority]}</span>;
}

export function EmptyState({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><strong>{title}</strong><p>{description}</p></div>;
}

export function Loading() {
  return <div className="loading"><span /><span /><span /></div>;
}

export function Modal({ open, title, children, onClose, wide = false }: { open: boolean; title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  if (!open) return null;
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <div className={`modal ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-header"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Fechar"><X size={20} /></button></div>
      {children}
    </div>
  </div>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

// Entrada financeira: os dígitos preenchem a partir dos centavos (ex.: 1, 12, 123 → 0,01 / 0,12 / 1,23).
export function MoneyInput({ value, onChange, disabled, required }: { value: number; onChange: (value: number) => void; disabled?: boolean; required?: boolean }) {
  const text = value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return <div className="money-input"><span>R$</span><input inputMode="numeric" value={text} disabled={disabled} required={required} onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "").slice(-12) || 0) / 100)} /></div>;
}

export function ErrorBanner({ message }: { message: string }) {
  return <div className="error-banner" role="alert">{message}</div>;
}
