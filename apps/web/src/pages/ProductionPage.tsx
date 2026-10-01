import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Factory, Filter, Package, Play, Search, Square, TimerReset } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState, ErrorBanner, Loading, PageHeader, PriorityBadge } from "../components/ui";
import { api, shortDate } from "../lib/api";
import type { ProductionItem, ProductionJob } from "../types";

type Tab = "itens" | "pedidos";
const periods = [{ days: 1, label: "Hoje" }, { days: 2, label: "2 dias" }, { days: 3, label: "3 dias" }, { days: 7, label: "1 semana" }];
const jobStatusLabel: Record<ProductionJob["status"], string> = { aguardando: "Aguardando", em_andamento: "Em andamento", pausado: "Pausado", concluido: "Concluído" };
const localDate = (offset = 0) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export function ProductionPage() {
  const [tab, setTab] = useState<Tab>("itens");
  return <><PageHeader eyebrow="Fila de trabalho" title="Produção" description="Priorize os pedidos, registre início e conclusão do trabalho." />
    <div className="tabs production-tabs"><button className={tab === "itens" ? "active" : ""} onClick={() => setTab("itens")}>Itens a produzir</button><button className={tab === "pedidos" ? "active" : ""} onClick={() => setTab("pedidos")}>Pedidos</button></div>
    {tab === "itens" ? <ProductionItems /> : <ProductionJobs />}
  </>;
}

function ProductionItems() {
  const [items, setItems] = useState<ProductionItem[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [search, setSearch] = useState(""); const [days, setDays] = useState(1);
  useEffect(() => { api<ProductionItem[]>("/production/items").then(setItems).catch((e) => setError(e instanceof Error ? e.message : "Falha ao carregar itens.")).finally(() => setLoading(false)); }, []);
  const today = localDate(); const limit = localDate(days - 1);
  const rows = useMemo(() => items.filter((item) => item.jobStatus !== "concluido" && (item.promisedDate ?? item.orderDate).slice(0, 10) <= limit && `${item.orderNumber} ${item.customerName} ${item.productName} ${item.sku}`.toLowerCase().includes(search.toLowerCase())), [items, limit, search]);
  const totals = useMemo(() => [...rows.reduce((map, item) => { const current = map.get(item.productId); map.set(item.productId, { name: item.productName, quantity: (current?.quantity ?? 0) + Number(item.quantity) }); return map; }, new Map<string, { name: string; quantity: number }>()).values()].sort((a, b) => b.quantity - a.quantity), [rows]);
  return <>{error && <ErrorBanner message={error} />}<div className="toolbar"><div className="search-box"><Search size={17} /><input placeholder="Buscar produto, pedido ou cliente..." value={search} onChange={(e) => setSearch(e.target.value)} /></div><div className="period-filter"><CalendarDays size={16} />{periods.map((period) => <button key={period.days} className={days === period.days ? "active" : ""} onClick={() => setDays(period.days)}>{period.label}</button>)}</div></div>
    {loading ? <Loading /> : rows.length ? <>
      <div className="production-totals">{totals.map((total) => <span key={total.name}><Package size={14} /><strong>{total.quantity.toLocaleString("pt-BR")}</strong>{total.name}</span>)}</div>
      <div className="data-table production-items-table"><div className="data-head"><span>Produto</span><span>Qtd.</span><span>Pedido / cliente</span><span>Data limite</span><span>Prioridade</span><span>Produção</span></div>{rows.map((item) => { const due = (item.promisedDate ?? item.orderDate).slice(0, 10); const late = due < today; return <div className="data-row" key={item.id}><div><strong>{item.productName}</strong><small>{item.sku}{item.notes ? ` · ${item.notes}` : ""}</small></div><strong className="item-qty">{Number(item.quantity).toLocaleString("pt-BR")}</strong><div><Link to={`/pedidos/${item.orderId}`}><strong>{item.orderNumber}</strong></Link><small>{item.customerName}</small></div><span className={late ? "danger-text" : ""}>{shortDate(due)}{late ? " · atrasado" : ""}</span><span><PriorityBadge priority={item.priority} /></span><span><i className={`payment-status status-work-${item.jobStatus}`}>{jobStatusLabel[item.jobStatus]}</i></span></div>; })}</div>
    </> : <EmptyState icon={<Package />} title="Nenhum item" description="Não há itens a produzir neste período." />}
  </>;
}

function ProductionJobs() {
  const [jobs, setJobs] = useState<ProductionJob[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [search, setSearch] = useState(""); const [filter, setFilter] = useState("todos");
  async function load() { try { setJobs(await api<ProductionJob[]>("/production")); } catch (e) { setError(e instanceof Error ? e.message : "Falha ao carregar produção."); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, []);
  const rows = useMemo(() => jobs.filter((job) => (filter === "todos" || job.status === filter) && `${job.orderNumber} ${job.customerName}`.toLowerCase().includes(search.toLowerCase())), [jobs, filter, search]);
  async function update(job: ProductionJob, status: string) { try { await api(`/production/${job.id}`, { method: "PATCH", body: JSON.stringify({ status }) }); if (status === "em_andamento" && job.orderStatus === "pagamento_confirmado") await api(`/orders/${job.orderId}/transition`, { method: "POST", body: JSON.stringify({ status: "em_producao" }) }); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Falha ao atualizar produção."); } }
  return <>{error && <ErrorBanner message={error} />}<div className="toolbar"><div className="search-box"><Search size={17} /><input placeholder="Buscar pedido ou cliente..." value={search} onChange={(e) => setSearch(e.target.value)} /></div><div className="filter-select"><Filter size={16} /><select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="todos">Todos</option><option value="aguardando">Aguardando</option><option value="em_andamento">Em andamento</option><option value="pausado">Pausado</option><option value="concluido">Concluído</option></select></div></div>
    {loading ? <Loading /> : rows.length ? <div className="work-list">{rows.map((job) => <article className="work-card" key={job.id}><div className={`work-status status-work-${job.status}`}><Factory /><span>{job.status.replaceAll("_", " ")}</span></div><div className="work-order"><Link to={`/pedidos/${job.orderId}`}><strong>{job.orderNumber}</strong></Link><h3>{job.customerName}</h3><PriorityBadge priority={job.priority} /></div><div className="work-date"><span>Data limite</span><strong>{shortDate(job.promisedDate)}</strong></div><div className="work-person"><span>Responsável</span><strong>{job.assigneeName ?? "Não atribuído"}</strong></div><div className="work-actions">{job.status !== "em_andamento" && job.status !== "concluido" && <button className="button primary small" onClick={() => void update(job, "em_andamento")}><Play size={15} /> Iniciar</button>}{job.status === "em_andamento" && <><button className="button secondary small" onClick={() => void update(job, "pausado")}><TimerReset size={15} /> Pausar</button><button className="button primary small" onClick={() => void update(job, "concluido")}><Square size={14} /> Concluir</button></>}</div></article>)}</div> : <EmptyState icon={<Factory />} title="Fila vazia" description="Não há pedidos com estes filtros." />}
  </>;
}
