import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, ArrowLeft, CalendarDays, Check, CheckCircle2, CircleDollarSign, ClipboardCheck, Clock3, Factory, MapPin, MessageSquareWarning, PackageCheck, Phone, Truck, UserRound } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { EmptyState, ErrorBanner, Field, Loading, Modal, PageHeader, PriorityBadge, StatusBadge } from "../components/ui";
import { api, dateTime, money, shortDate } from "../lib/api";
import { statusLabel, type Address, type Order, type OrderStatus } from "../types";

type Detail = Order & {
  subtotal: string; discount: string; createdAt: string; customerEmail: string | null; customerAddress: Address;
  items: Array<{ id: string; quantity: string; unitPrice: string; total: string; notes: string | null; checkStatus: string; productName: string; sku: string }>;
  payments: Array<{ id: string; amount: string; receivedAmount: string; method: string; status: string; dueDate: string | null; paidAt: string | null; proofReference: string | null; notes: string | null }>;
  production: { id: string; status: string; startedAt: string | null; completedAt: string | null; assigneeName: string | null; notes: string | null } | null;
  shipping: { type: string; address: Address; deliveryWindow: string | null; carrier: string | null; driver: string | null; trackingCode: string | null; departedAt: string | null; deliveredAt: string | null; failedReason: string | null } | null;
  occurrences: Array<{ id: string; type: string; description: string; status: string; solution: string | null; createdAt: string; resolvedAt: string | null; createdByName: string }>;
  history: Array<{ id: string; fromStatus: OrderStatus | null; toStatus: OrderStatus; notes: string | null; createdAt: string; userName: string }>;
  allowedTransitions: OrderStatus[];
};

const checkLabels: Record<string, string> = { pendente: "Pendente", separado: "Separado", conferido: "Conferido", faltante: "Faltante", substituido: "Substituído", avariado: "Avariado" };

export function OrderDetailPage() {
  const { id } = useParams(); const [order, setOrder] = useState<Detail | null>(null); const [error, setError] = useState(""); const [issueOpen, setIssueOpen] = useState(false);
  async function load() { if (!id) return; try { setOrder(await api<Detail>(`/orders/${id}`)); } catch (e) { setError(e instanceof Error ? e.message : "Falha ao carregar pedido."); } }
  useEffect(() => { void load(); }, [id]);
  async function transition(status: OrderStatus) { if (!id) return; setError(""); try { await api(`/orders/${id}/transition`, { method: "POST", body: JSON.stringify({ status }) }); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível avançar."); } }
  async function checkItem(itemId: string, status: string) { try { await api(`/order-items/${itemId}/check`, { method: "PATCH", body: JSON.stringify({ status }) }); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Falha na conferência."); } }
  if (error && !order) return <ErrorBanner message={error} />;
  if (!order) return <Loading />;
  const address = order.shipping?.address ?? order.customerAddress;
  return <>
    <Link to="/pedidos" className="back-link"><ArrowLeft size={16} /> Voltar ao quadro</Link>
    <PageHeader eyebrow={order.number} title={order.customerName} description={`Pedido criado em ${shortDate(order.orderDate)}`} actions={<div className="detail-head-actions"><PriorityBadge priority={order.priority} /><StatusBadge status={order.status} /></div>} />
    {error && <ErrorBanner message={error} />}
    {order.allowedTransitions.length > 0 && <section className="next-actions"><div><span className="eyebrow">Próxima etapa</span><strong>Atualize o andamento do pedido</strong></div><div>{order.allowedTransitions.map((status) => <button key={status} className={`button ${status === "cancelado" ? "danger-outline" : "primary"}`} onClick={() => void transition(status)}>{status !== "cancelado" && <Check size={17} />}{statusLabel[status]}</button>)}</div></section>}
    <div className="detail-layout"><div className="detail-main">
      <section className="panel"><div className="panel-header"><div><span className="eyebrow">Composição</span><h2>Itens do pedido</h2></div><span>{order.items.length} {order.items.length === 1 ? "item" : "itens"}</span></div>
        <div className="items-table"><div className="table-head"><span>Produto</span><span>Qtd.</span><span>Unitário</span><span>Total</span><span>Conferência</span></div>{order.items.map((item) => <div className="table-row" key={item.id}><div><strong>{item.productName}</strong><small>{item.sku}</small></div><span>{Number(item.quantity)}</span><span>{money(item.unitPrice)}</span><strong>{money(item.total)}</strong><select className={`check-select check-${item.checkStatus}`} value={item.checkStatus} onChange={(e) => void checkItem(item.id, e.target.value)}>{Object.entries(checkLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>)}</div>
        <div className="totals"><div><span>Subtotal</span><strong>{money(order.subtotal)}</strong></div><div><span>Desconto</span><strong>- {money(order.discount)}</strong></div><div><span>Total</span><strong>{money(order.total)}</strong></div></div>
      </section>
      <section className="panel"><div className="panel-header"><div><span className="eyebrow">Rastreabilidade</span><h2>Histórico</h2></div></div><div className="timeline">{order.history.map((event, index) => <div className="timeline-event" key={event.id}><div className={`timeline-dot ${index === 0 ? "active" : ""}`}><Check size={12} /></div><div><div><strong>{statusLabel[event.toStatus]}</strong><time>{dateTime(event.createdAt)}</time></div><p>{event.fromStatus ? `${statusLabel[event.fromStatus]} → ` : ""}{statusLabel[event.toStatus]}</p><small>{event.userName}{event.notes ? ` · ${event.notes}` : ""}</small></div></div>)}</div></section>
      <section className="panel"><div className="panel-header"><div><span className="eyebrow">Pendências</span><h2>Ocorrências</h2></div><button className="button secondary small" onClick={() => setIssueOpen(true)}><AlertCircle size={16} /> Registrar</button></div>{order.occurrences.length ? <div className="issue-list">{order.occurrences.map((issue) => <article className={issue.status === "aberta" ? "open" : "resolved"} key={issue.id}><span className="issue-symbol">{issue.status === "aberta" ? <MessageSquareWarning /> : <CheckCircle2 />}</span><div><div><strong>{issue.type.replaceAll("_", " ")}</strong><span>{issue.status}</span></div><p>{issue.description}</p><small>{issue.createdByName} · {dateTime(issue.createdAt)}</small>{issue.solution && <p className="solution"><strong>Solução:</strong> {issue.solution}</p>}</div>{issue.status === "aberta" && <button className="text-link" onClick={async () => { const solution = prompt("Como a ocorrência foi solucionada?"); if (solution) { await api(`/occurrences/${issue.id}/resolve`, { method: "PATCH", body: JSON.stringify({ solution }) }); await load(); } }}>Resolver</button>}</article>)}</div> : <EmptyState icon={<ClipboardCheck />} title="Nenhuma ocorrência" description="Tudo certo com este pedido até aqui." />}</section>
    </div><aside className="detail-aside">
      <section className="info-card"><div className="info-card-title"><UserRound /><strong>Cliente</strong></div><h3>{order.customerName}</h3>{order.customerPhone && <span><Phone />{order.customerPhone}</span>}<span><MapPin />{formatAddress(order.customerAddress)}</span></section>
      <section className="info-card"><div className="info-card-title"><CalendarDays /><strong>Prazo e entrega</strong></div><div className="info-pair"><span>Data prometida</span><strong className={isLate(order.promisedDate, order.status) ? "danger-text" : ""}>{shortDate(order.promisedDate)}</strong></div><div className="info-pair"><span>Modalidade</span><strong>{order.deliveryType}</strong></div><span><MapPin />{formatAddress(address)}</span></section>
      <section className="info-card"><div className="info-card-title"><CircleDollarSign /><strong>Pagamento</strong></div>{order.payments.map((payment) => <div key={payment.id} className="side-payment"><div><strong>{money(payment.amount)}</strong><span className={`payment-status payment-${payment.status}`}>{payment.status}</span></div><small>Recebido: {money(payment.receivedAmount)} · saldo: {money(Math.max(0, Number(payment.amount) - Number(payment.receivedAmount)))}</small><small>{payment.method} · venc. {shortDate(payment.dueDate)}</small>{payment.proofReference && <small>Comprovante: {payment.proofReference}</small>}{payment.notes && <small>{payment.notes}</small>}</div>)}</section>
      <section className="info-card"><div className="info-card-title"><Factory /><strong>Produção</strong></div><div className="info-pair"><span>Situação</span><strong>{order.production?.status.replaceAll("_", " ") ?? "—"}</strong></div><span><Clock3 />Início: {dateTime(order.production?.startedAt)}</span><span><PackageCheck />Conclusão: {dateTime(order.production?.completedAt)}</span></section>
      {order.shipping && <section className="info-card"><div className="info-card-title"><Truck /><strong>Expedição</strong></div><div className="info-pair"><span>Responsável</span><strong>{order.shipping.driver ?? order.shipping.carrier ?? "A definir"}</strong></div><span>Janela: {order.shipping.deliveryWindow ?? "—"}</span><span>Código: {order.shipping.trackingCode ?? "—"}</span><span>Saída: {dateTime(order.shipping.departedAt)}</span><span>Entrega: {dateTime(order.shipping.deliveredAt)}</span>{order.shipping.failedReason && <span className="danger-text">Tentativa frustrada: {order.shipping.failedReason}</span>}</section>}
    </aside></div>
    <OccurrenceModal open={issueOpen} orderId={order.id} onClose={() => setIssueOpen(false)} onCreated={() => { setIssueOpen(false); void load(); }} />
  </>;
}

function formatAddress(address?: Address | null) { if (!address) return "Endereço não informado"; return [address.street, address.number, address.district, address.city, address.state].filter(Boolean).join(", ") || "Endereço não informado"; }
function isLate(date: string | null, status: OrderStatus) { return !!date && date < new Date().toISOString().slice(0, 10) && !["entregue", "cancelado"].includes(status); }

function OccurrenceModal({ open, orderId, onClose, onCreated }: { open: boolean; orderId: string; onClose: () => void; onCreated: () => void }) {
  const [type, setType] = useState("falta_insumo"); const [description, setDescription] = useState(""); const [error, setError] = useState("");
  async function submit(e: FormEvent) { e.preventDefault(); try { await api(`/orders/${orderId}/occurrences`, { method: "POST", body: JSON.stringify({ type, description }) }); onCreated(); } catch (err) { setError(err instanceof Error ? err.message : "Falha ao registrar."); } }
  return <Modal open={open} title="Registrar ocorrência" onClose={onClose}><form className="modal-body" onSubmit={submit}>{error && <ErrorBanner message={error} />}<Field label="Tipo"><select value={type} onChange={(e) => setType(e.target.value)}><option value="falta_insumo">Falta de insumo</option><option value="item_faltante">Item faltante</option><option value="avaria">Avaria</option><option value="atraso">Atraso</option><option value="entrega_frustrada">Entrega frustrada</option><option value="outro">Outro</option></select></Field><Field label="Descrição"><textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} required /></Field><div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancelar</button><button className="button primary">Registrar</button></div></form></Modal>;
}
