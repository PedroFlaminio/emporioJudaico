import { useEffect, useState } from "react";
import { ArrowDownWideNarrow, ArrowLeft, ArrowUpNarrowWide, CheckCircle2, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { EmptyState, ErrorBanner, Loading, PageHeader } from "../components/ui";
import { api, dateTime, shortDate } from "../lib/api";
import { deliveryTypeLabel, type Paginated, type Shipment } from "../types";

const pageSize = 20;
const sortOptions = { deliveredAt: "Data de conclusão", promisedDate: "Prazo", orderNumber: "Número do pedido", customerName: "Cliente" };
const defaults: Record<string, string> = { sort: "deliveredAt", dir: "desc", page: "1" };

export function DeliveredShipmentsPage() {
  const [params, setParams] = useSearchParams();
  const get = (key: string) => params.get(key) ?? defaults[key] ?? "";
  const [search, setSearch] = useState(get("search"));
  const [data, setData] = useState<Paginated<Shipment> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function update(changes: Record<string, string>) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      // Qualquer mudança de filtro volta para a primeira página.
      if (!("page" in changes)) next.delete("page");
      for (const [key, value] of Object.entries(changes)) {
        if (!value || value === defaults[key]) next.delete(key); else next.set(key, value);
      }
      return next;
    }, { replace: true });
  }

  useEffect(() => {
    const timer = setTimeout(() => { if (search !== get("search")) update({ search }); }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const query = new URLSearchParams(params);
    query.set("pageSize", String(pageSize));
    api<Paginated<Shipment>>(`/shipping/delivered?${query}`)
      .then((result) => { if (active) { setData(result); setError(""); } })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : "Falha ao carregar entregas concluídas."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [params]);

  const page = Number(get("page"));
  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;
  const hasFilters = ["search", "type", "from", "to"].some((key) => params.has(key));

  return <>
    <Link className="back-link" to="/expedicao"><ArrowLeft size={14} /> Voltar para expedição</Link>
    <PageHeader eyebrow="Saídas e entregas" title="Entregas concluídas" description="Histórico completo de pedidos entregues ou retirados." />
    {error && <ErrorBanner message={error} />}
    <div className="toolbar delivered-filters">
      <div className="search-box"><Search size={17} /><input placeholder="Buscar pedido ou cliente..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <label className="filter-field"><span>Tipo</span><select value={get("type")} onChange={(e) => update({ type: e.target.value })}><option value="">Todos</option>{Object.entries(deliveryTypeLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="filter-field"><span>Concluído de</span><input type="date" value={get("from")} max={get("to") || undefined} onChange={(e) => update({ from: e.target.value })} /></label>
      <label className="filter-field"><span>até</span><input type="date" value={get("to")} min={get("from") || undefined} onChange={(e) => update({ to: e.target.value })} /></label>
      <label className="filter-field"><span>Ordenar por</span><select value={get("sort")} onChange={(e) => update({ sort: e.target.value })}>{Object.entries(sortOptions).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <button type="button" className="button secondary small" title="Inverter ordem" onClick={() => update({ dir: get("dir") === "desc" ? "asc" : "desc" })}>
        {get("dir") === "desc" ? <><ArrowDownWideNarrow size={15} /> Decrescente</> : <><ArrowUpNarrowWide size={15} /> Crescente</>}
      </button>
      {hasFilters && <button type="button" className="text-link" onClick={() => { setSearch(""); update({ search: "", type: "", from: "", to: "" }); }}>Limpar filtros</button>}
    </div>
    {loading && !data ? <Loading /> : data?.rows.length ? <>
      <div className="data-table delivered-table">
        <div className="data-head"><span>Pedido / cliente</span><span>Concluído em</span><span>Prazo</span><span>Tipo</span><span>Responsável</span><span>Saída</span></div>
        {data.rows.map((row) => <div className="data-row" key={row.id}>
          <div><Link to={`/pedidos/${row.orderId}`}><strong>{row.orderNumber}</strong></Link><small>{row.customerName}</small></div>
          <strong>{dateTime(row.deliveredAt)}</strong>
          <span>{shortDate(row.promisedDate)}</span>
          <span>{deliveryTypeLabel[row.type as keyof typeof deliveryTypeLabel] ?? row.type}</span>
          <span>{row.driver ?? row.carrier ?? "—"}</span>
          <span>{dateTime(row.departedAt)}</span>
        </div>)}
      </div>
      <div className="pagination">
        <span className="result-count">{data.total} {data.total === 1 ? "entrega" : "entregas"} · página {page} de {totalPages}</span>
        <div>
          <button type="button" className="button secondary small" disabled={page <= 1 || loading} onClick={() => update({ page: String(page - 1) })}><ChevronLeft size={15} /> Anterior</button>
          <button type="button" className="button secondary small" disabled={page >= totalPages || loading} onClick={() => update({ page: String(page + 1) })}>Próxima <ChevronRight size={15} /></button>
        </div>
      </div>
    </> : <EmptyState icon={<CheckCircle2 />} title="Nenhuma entrega encontrada" description={hasFilters ? "Ajuste os filtros para ver outros resultados." : "Pedidos concluídos aparecerão aqui."} />}
  </>;
}
