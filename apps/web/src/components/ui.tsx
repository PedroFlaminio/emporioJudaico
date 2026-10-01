import { ChevronDown, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
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
// Máscara que preenche da direita para a esquerda: o cursor fica sempre no final.
function caretToEnd(input: HTMLInputElement) { requestAnimationFrame(() => { const end = input.value.length; input.setSelectionRange(end, end); }); }

export function MoneyInput({ value, onChange, disabled, required }: { value: number; onChange: (value: number) => void; disabled?: boolean; required?: boolean }) {
  const text = value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return <div className="money-input"><span>R$</span><input inputMode="numeric" value={text} disabled={disabled} required={required} onFocus={(e) => caretToEnd(e.currentTarget)} onClick={(e) => caretToEnd(e.currentTarget)} onKeyUp={(e) => caretToEnd(e.currentTarget)} onChange={(e) => { onChange(Number(e.target.value.replace(/\D/g, "").slice(-12) || 0) / 100); caretToEnd(e.target); }} /></div>;
}

export function ErrorBanner({ message }: { message: string }) {
  return <div className="error-banner" role="alert">{message}</div>;
}

// `search` define o texto usado no filtro; quando ausente, busca pelo próprio label.
export type SearchOption = { value: string; label: string; search?: string };

const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Select com busca: digita para filtrar, setas/Enter para escolher. A lista é posicionada como fixed para não ser cortada pelo modal.
export function SearchSelect({ value, options, onChange, placeholder = "Buscar...", required }: { value: string; options: SearchOption[]; onChange: (value: string) => void; placeholder?: string; required?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState<CSSProperties>({});
  const selected = options.find((option) => option.value === value);
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const filtered = terms.length ? options.filter((option) => { const text = normalize(option.search ?? option.label); return terms.every((term) => text.includes(term)); }) : options;

  useEffect(() => { inputRef.current?.setCustomValidity(required && !value ? "Selecione uma opção da lista." : ""); }, [required, value]);
  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const rect = inputRef.current?.getBoundingClientRect(); if (!rect) return;
      const below = window.innerHeight - rect.bottom; const maxHeight = 260;
      const up = below < Math.min(maxHeight, 160) && rect.top > below;
      setPosition({ left: rect.left, width: rect.width, maxHeight: Math.min(maxHeight, (up ? rect.top : below) - 12), ...(up ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }) });
    }
    place();
    window.addEventListener("resize", place); window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open]);
  useEffect(() => { listRef.current?.children[active]?.scrollIntoView({ block: "nearest" }); }, [active]);

  function openList() { setOpen(true); setQuery(""); setActive(Math.max(0, options.findIndex((option) => option.value === value))); }
  function choose(option: SearchOption) { onChange(option.value); setOpen(false); setQuery(""); }
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) return openList();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((index) => Math.min(Math.max(index + step, 0), filtered.length - 1));
    } else if (event.key === "Enter" && open) {
      event.preventDefault();
      if (filtered[active]) choose(filtered[active]);
    } else if (event.key === "Escape" && open) {
      event.preventDefault(); event.stopPropagation(); setOpen(false);
    }
  }

  return <div className={`search-select ${open ? "open" : ""}`}>
    <input ref={inputRef} value={open ? query : selected?.label ?? ""} placeholder={open && selected ? selected.label : placeholder} role="combobox" aria-expanded={open} aria-autocomplete="list" autoComplete="off"
      onFocus={openList} onClick={() => !open && openList()} onBlur={() => setOpen(false)} onKeyDown={onKeyDown}
      onChange={(event) => { setQuery(event.target.value); setActive(0); if (!open) setOpen(true); }} />
    <ChevronDown size={16} className="search-select-icon" />
    {open && <ul ref={listRef} className="search-select-list" role="listbox" style={position} onMouseDown={(event) => event.preventDefault()}>
      {filtered.length ? filtered.map((option, index) => <li key={option.value} role="option" aria-selected={option.value === value} className={`${index === active ? "active" : ""} ${option.value === value ? "selected" : ""}`} onMouseEnter={() => setActive(index)} onClick={(event) => { event.preventDefault(); choose(option); }}>
        {option.label}</li>) : <li className="search-select-empty">Nenhum resultado</li>}
    </ul>}
  </div>;
}
