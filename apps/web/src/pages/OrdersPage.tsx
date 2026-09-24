import { useEffect, useMemo, useState } from "react";
import { Ban, CalendarDays, CheckCircle2, GripVertical, Pencil, Plus, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { OrderFormModal, type OrderFormInitial } from "../components/OrderFormModal";
import { ErrorBanner, Loading, PageHeader, PriorityBadge, StatusBadge } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { api, money, shortDate } from "../lib/api";
import { statusLabel, type Customer, type Order, type OrderStatus, type Product, type Role } from "../types";

// Mesma regra da API: alterações permitidas até a etapa Pronto.

const columns: Array<{ key: string; title: string; statuses: OrderStatus[]; dropStatus: OrderStatus }> = [
  { key: "entrada", title: "Entrada & pagamento", statuses: ["recebido", "pagamento_pendente", "pagamento_confirmado"], dropStatus: "pagamento_confirmado" },
  { key: "producao", title: "Em produção", statuses: ["em_producao"], dropStatus: "em_producao" },
  { key: "preparacao", title: "Preparação", statuses: ["preparacao"], dropStatus: "preparacao" },
  { key: "pronto", title: "Pronto", statuses: ["pronto"], dropStatus: "pronto" },
  { key: "expedicao", title: "Expedição", statuses: ["expedicao"], dropStatus: "expedicao" },
];

const orderFlow: Record<OrderStatus, OrderStatus[]> = {
  recebido: ["pagamento_pendente", "pagamento_confirmado", "em_producao", "cancelado"],
  pagamento_pendente: ["pagamento_confirmado", "cancelado"],
  pagamento_confirmado: ["em_producao", "cancelado"],
  em_producao: ["preparacao", "cancelado"],
  preparacao: ["pronto", "em_producao", "cancelado"],
  pronto: ["expedicao", "entregue", "cancelado"],
  expedicao: ["entregue", "pronto", "cancelado"],
  entregue: [],
  cancelado: [],
};

export function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<OrderFormInitial | null>(null);
  const [error, setError] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [activeDropStatus, setActiveDropStatus] = useState<OrderStatus | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [orderRows, customerRows, productRows] = await Promise.all([api<Order[]>("/orders"), api<Customer[]>("/customers"), api<Product[]>("/products")]);
      setOrders(orderRows); setCustomers(customerRows); setProducts(productRows);
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao carregar pedidos."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  const filtered = useMemo(() => orders.filter((order) => `${order.number} ${order.customerName}`.toLowerCase().includes(search.toLowerCase())), [orders, search]);
  const canCreate = !!user && ["atendimento", "gestor", "administrador"].includes(user.role);
  const transitionRoles: Partial<Record<OrderStatus, Role[]>> = {
    pagamento_confirmado: ["atendimento", "financeiro", "gestor", "administrador"],
    em_producao: ["producao", "gestor", "administrador"],
    preparacao: ["producao", "gestor", "administrador"],
    pronto: ["producao", "expedicao", "gestor", "administrador"],
    expedicao: ["expedicao", "gestor", "administrador"],
  };
  async function openEdit(orderId: string) {
    setError("");
    try { setEditing(await api<OrderFormInitial>(`/orders/${orderId}`)); }
    catch (e) { setError(e instanceof Error ? e.message : "Falha ao carregar o pedido."); }
  }
  const canMoveTo = (status: OrderStatus) => !!user && (transitionRoles[status]?.includes(user.role) ?? false);

  function moveFeedback(order: Order | undefined, status: OrderStatus) {
    if (!order) return { allowed: false, message: "Movimento não permitido" };
    if (order.status === status) return { allowed: false, message: `Este pedido já está em ${statusLabel[status]}.` };
    if (!orderFlow[order.status].includes(status)) {
      const nextSteps = orderFlow[order.status].filter((step) => step !== "cancelado");
      const nextStepMessage = nextSteps.length === 1
        ? ` A próxima etapa disponível é ${statusLabel[nextSteps[0]!]}.`
        : "";
      return {
        allowed: false,
        message: `O pedido está em ${statusLabel[order.status]} e não pode ir diretamente para ${statusLabel[status]}.${nextStepMessage}`,
      };
    }
    if (!canMoveTo(status)) return { allowed: false, message: `Seu perfil não permite mover pedidos para ${statusLabel[status]}.` };
    return { allowed: true, message: `Solte para mover para ${statusLabel[status]}` };
  }

  function endDrag() {
    setDragId(null);
    setActiveDropStatus(null);
  }

  async function drop(status: OrderStatus) {
    if (!dragId) return;
    const order = orders.find((item) => item.id === dragId);
    const feedback = moveFeedback(order, status);
    if (!feedback.allowed) { setError(feedback.message); endDrag(); return; }
    try {
      await api(`/orders/${dragId}/transition`, { method: "POST", body: JSON.stringify({ status, notes: "Movido pelo quadro" }) });
      setOrders((rows) => rows.map((item) => item.id === dragId ? { ...item, status } : item));
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível mover o pedido."); }
    endDrag();
  }

  return <>
    <PageHeader eyebrow="Fluxo operacional" title="Quadro de pedidos" description="Visualize prazos e mova cada pedido conforme o trabalho avança." actions={canCreate && <button className="button primary" onClick={() => setCreateOpen(true)}><Plus size={18} /> Novo pedido</button>} />
    {error && <ErrorBanner message={error} />}
    <div className="toolbar"><div className="search-box"><Search size={17} /><input placeholder="Buscar número ou cliente..." value={search} onChange={(e) => setSearch(e.target.value)} /></div><span className="result-count">{filtered.filter((o) => o.status !== "entregue" && o.status !== "cancelado").length} pedidos ativos</span></div>
    {loading ? <Loading /> : <div className="kanban">{columns.map((column) => {
      const columnOrders = filtered.filter((order) => column.statuses.includes(order.status));
      const feedback = moveFeedback(orders.find((order) => order.id === dragId), column.dropStatus);
      const isActiveDrop = activeDropStatus === column.dropStatus;
      const dropClass = isActiveDrop ? ` drag-over drag-over-${feedback.allowed ? "allowed" : "blocked"}` : "";
      return <section className={`kanban-column${dropClass}`} key={column.key}
        onDragEnter={() => dragId && setActiveDropStatus(column.dropStatus)}
        onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = feedback.allowed ? "move" : "none"; setActiveDropStatus(column.dropStatus); }}
        onDrop={(event) => { event.preventDefault(); void drop(column.dropStatus); }}>
        <header><div><i className={`column-dot status-${column.dropStatus}`} /><strong>{column.title}</strong></div><span>{columnOrders.length}</span></header>
        <div className="kanban-list">
          {isActiveDrop && <div className={`kanban-drop-feedback ${feedback.allowed ? "allowed" : "blocked"}`} role="status">
            {feedback.allowed ? <CheckCircle2 size={17} /> : <Ban size={17} />}<span>{feedback.message}</span>
          </div>}
          {columnOrders.map((order) => <article className={`order-card ${dragId === order.id ? "dragging" : ""}`} key={order.id} draggable={!!user} onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; setError(""); setDragId(order.id); }} onDragEnd={endDrag}>
          <div className="order-card-top"><span>{order.number}</span><span className="order-card-tools">{canCreate && <button type="button" className="icon-button order-card-edit" draggable={false} title="Alterar pedido" aria-label={`Alterar pedido ${order.number}`} onClick={() => void openEdit(order.id)}><Pencil size={13} /></button>}<GripVertical size={16} /></span></div><Link to={`/pedidos/${order.id}`}><h3>{order.customerName}</h3></Link><StatusBadge status={order.status} />
          <div className="order-meta"><span><CalendarDays size={15} />{shortDate(order.promisedDate)}</span><strong>{money(order.total)}</strong></div><div className="order-card-footer"><PriorityBadge priority={order.priority} /><span>{order.deliveryType}</span></div>
        </article>)}{!columnOrders.length && <div className="kanban-empty">Solte um pedido aqui</div>}</div>
      </section>;
    })}</div>}
    <OrderFormModal open={createOpen} customers={customers} products={products} onClose={() => setCreateOpen(false)} onSaved={() => { setCreateOpen(false); void load(); }} />
    {editing && <OrderFormModal open customers={customers} products={products} initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load(); }} />}
  </>;
}
