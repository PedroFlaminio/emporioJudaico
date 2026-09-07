import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Ban, CalendarDays, CheckCircle2, ClipboardList, GripVertical, Plus, Search, ShoppingBasket, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState, ErrorBanner, Field, Loading, Modal, PageHeader, PriorityBadge, StatusBadge } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { api, money, shortDate } from "../lib/api";
import { statusLabel, type Address, type Customer, type Order, type OrderStatus, type Product, type Role } from "../types";

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

type DraftItem = { productId: string; quantity: number; unitPrice: number };

export function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
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
          <div className="order-card-top"><span>{order.number}</span><GripVertical size={16} /></div><Link to={`/pedidos/${order.id}`}><h3>{order.customerName}</h3></Link><StatusBadge status={order.status} />
          <div className="order-meta"><span><CalendarDays size={15} />{shortDate(order.promisedDate)}</span><strong>{money(order.total)}</strong></div><div className="order-card-footer"><PriorityBadge priority={order.priority} /><span>{order.deliveryType}</span></div>
        </article>)}{!columnOrders.length && <div className="kanban-empty">Solte um pedido aqui</div>}</div>
      </section>;
    })}</div>}
    <NewOrderModal open={createOpen} customers={customers} products={products} onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); void load(); }} />
  </>;
}

function NewOrderModal({ open, customers, products, onClose, onCreated }: { open: boolean; customers: Customer[]; products: Product[]; onClose: () => void; onCreated: () => void }) {
  const [customerId, setCustomerId] = useState("");
  const [promisedDate, setPromisedDate] = useState("");
  const [priority, setPriority] = useState("normal");
  const [deliveryType, setDeliveryType] = useState("retirada");
  const [discount, setDiscount] = useState(0);
  const [method, setMethod] = useState("pix");
  const [paymentStatus, setPaymentStatus] = useState("pendente");
  const [receivedAmount, setReceivedAmount] = useState(0);
  const [proofReference, setProofReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [shippingAddress, setShippingAddress] = useState<Address>({});
  const [deliveryWindow, setDeliveryWindow] = useState("");
  const [carrier, setCarrier] = useState("");
  const [driver, setDriver] = useState("");
  const [trackingCode, setTrackingCode] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DraftItem[]>([{ productId: "", quantity: 1, unitPrice: 0 }]);
  const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const total = Math.max(0, subtotal - discount);
  function updateItem(index: number, values: Partial<DraftItem>) { setItems((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...values } : row)); }
  function selectProduct(index: number, productId: string) { const product = products.find((row) => row.id === productId); updateItem(index, { productId, unitPrice: Number(product?.price ?? 0) }); }
  function selectCustomer(value: string) { const customer = customers.find((row) => row.id === value); setCustomerId(value); setShippingAddress(customer?.address ?? {}); }
  function setAddress(key: keyof Address, value: string) { setShippingAddress((current) => ({ ...current, [key]: value })); }
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setSaving(true);
    try {
      await api("/orders", { method: "POST", body: JSON.stringify({
        customerId, promisedDate: promisedDate || null, priority, deliveryType, discount, notes, items,
        payment: { method, status: paymentStatus, dueDate: promisedDate || null, receivedAmount: paymentStatus === "parcial" ? receivedAmount : undefined, proofReference: proofReference || null, notes: paymentNotes || null },
        shippingAddress: deliveryType === "retirada" ? {} : shippingAddress,
        deliveryWindow: deliveryWindow || null, carrier: carrier || null, driver: driver || null, trackingCode: trackingCode || null,
      }) });
      onCreated();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível criar o pedido."); }
    finally { setSaving(false); }
  }
  return <Modal open={open} title="Novo pedido" onClose={onClose} wide><form onSubmit={submit} className="modal-body order-form">
    {error && <ErrorBanner message={error} />}
    <div className="form-section"><div className="form-section-title"><span>1</span><div><strong>Dados do pedido</strong><small>Cliente, prazo e modalidade</small></div></div><div className="form-grid three">
      <Field label="Cliente"><select value={customerId} onChange={(e) => selectCustomer(e.target.value)} required><option value="">Selecione...</option>{customers.filter((c) => c.active).map((c) => <option value={c.id} key={c.id}>{c.name}</option>)}</select></Field>
      <Field label="Data prometida"><input type="date" value={promisedDate} onChange={(e) => setPromisedDate(e.target.value)} /></Field>
      <Field label="Prioridade"><select value={priority} onChange={(e) => setPriority(e.target.value)}><option value="baixa">Baixa</option><option value="normal">Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select></Field>
      <Field label="Modalidade"><select value={deliveryType} onChange={(e) => setDeliveryType(e.target.value)}><option value="retirada">Retirada</option><option value="entrega">Entrega</option><option value="transportadora">Transportadora</option></select></Field>
      <Field label="Observações"><input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Cuidados ou detalhes especiais" /></Field>
    </div>{deliveryType !== "retirada" && <div className="shipping-form"><div className="form-grid three">
      <Field label="Rua"><input value={shippingAddress.street ?? ""} onChange={(e) => setAddress("street", e.target.value)} required /></Field>
      <Field label="Número"><input value={shippingAddress.number ?? ""} onChange={(e) => setAddress("number", e.target.value)} required /></Field>
      <Field label="Complemento"><input value={shippingAddress.complement ?? ""} onChange={(e) => setAddress("complement", e.target.value)} /></Field>
      <Field label="Bairro"><input value={shippingAddress.district ?? ""} onChange={(e) => setAddress("district", e.target.value)} /></Field>
      <Field label="Cidade"><input value={shippingAddress.city ?? ""} onChange={(e) => setAddress("city", e.target.value)} required /></Field>
      <Field label="Estado"><input maxLength={2} value={shippingAddress.state ?? ""} onChange={(e) => setAddress("state", e.target.value.toUpperCase())} /></Field>
      <Field label="CEP"><input value={shippingAddress.zipCode ?? ""} onChange={(e) => setAddress("zipCode", e.target.value)} /></Field>
      <Field label="Janela de entrega"><input value={deliveryWindow} onChange={(e) => setDeliveryWindow(e.target.value)} placeholder="Ex.: 14h às 18h" /></Field>
      <Field label="Transportadora"><input value={carrier} onChange={(e) => setCarrier(e.target.value)} /></Field>
      <Field label="Entregador"><input value={driver} onChange={(e) => setDriver(e.target.value)} /></Field>
      <Field label="Rastreio"><input value={trackingCode} onChange={(e) => setTrackingCode(e.target.value)} /></Field>
    </div></div>}</div>
    <div className="form-section"><div className="form-section-title"><span>2</span><div><strong>Itens</strong><small>Produtos e quantidades</small></div></div>
      <div className="items-editor">{items.map((item, index) => <div className="item-row" key={index}><Field label={index === 0 ? "Produto" : ""}><select value={item.productId} onChange={(e) => selectProduct(index, e.target.value)} required><option value="">Selecione...</option>{products.filter((p) => p.active).map((p) => <option value={p.id} key={p.id}>{p.sku} · {p.name}</option>)}</select></Field><Field label={index === 0 ? "Qtd." : ""}><input type="number" min="0.001" step="0.001" value={item.quantity} onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })} /></Field><Field label={index === 0 ? "Valor unitário" : ""}><input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(e) => updateItem(index, { unitPrice: Number(e.target.value) })} /></Field><strong className="item-total">{money(item.quantity * item.unitPrice)}</strong><button type="button" className="icon-button danger" disabled={items.length === 1} onClick={() => setItems((rows) => rows.filter((_, i) => i !== index))}><Trash2 size={17} /></button></div>)}</div>
      <button type="button" className="button secondary small" onClick={() => setItems((rows) => [...rows, { productId: "", quantity: 1, unitPrice: 0 }])}><Plus size={16} /> Adicionar item</button>
    </div>
    <div className="form-section"><div className="form-section-title"><span>3</span><div><strong>Pagamento</strong><small>Condição inicial da cobrança</small></div></div><div className="form-grid three"><Field label="Forma"><select value={method} onChange={(e) => setMethod(e.target.value)}><option value="pix">Pix</option><option value="cartao">Cartão</option><option value="boleto">Boleto</option><option value="dinheiro">Dinheiro</option></select></Field><Field label="Situação"><select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}><option value="pendente">Pendente</option><option value="parcial">Parcial</option><option value="pago">Pago</option></select></Field><Field label="Desconto"><input type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} /></Field>{paymentStatus === "parcial" && <Field label="Valor recebido"><input type="number" min="0.01" max={Math.max(total - 0.01, 0.01)} step="0.01" value={receivedAmount} onChange={(e) => setReceivedAmount(Number(e.target.value))} required /></Field>}<Field label="Comprovante / referência"><input value={proofReference} onChange={(e) => setProofReference(e.target.value)} /></Field><Field label="Observações do pagamento"><input value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} /></Field></div></div>
    <div className="order-summary"><div><span>Subtotal</span><strong>{money(subtotal)}</strong></div><div><span>Desconto</span><strong>- {money(discount)}</strong></div><div className="summary-total"><span>Total</span><strong>{money(total)}</strong></div></div>
    <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancelar</button><button className="button primary" disabled={saving}><ShoppingBasket size={18} /> {saving ? "Salvando..." : "Criar pedido"}</button></div>
  </form></Modal>;
}
