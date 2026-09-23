import { useState, type FormEvent } from "react";
import { Plus, Save, ShoppingBasket, Trash2 } from "lucide-react";
import { ErrorBanner, Field, Modal, MoneyInput } from "./ui";
import { api, money } from "../lib/api";
import type { Address, Customer, Order, Product } from "../types";

type DraftItem = { id?: string; productId: string; quantity: number; unitPrice: number; notes?: string | null };

export type OrderFormInitial = {
  id: string;
  customerId: string;
  promisedDate: string | null;
  priority: Order["priority"];
  deliveryType: Order["deliveryType"];
  discount: string;
  notes: string | null;
  items: Array<{ id: string; productId: string; quantity: string; unitPrice: string; notes: string | null }>;
  shipping: { address: Address; deliveryWindow: string | null; carrier: string | null; driver: string | null; trackingCode: string | null } | null;
};

export function OrderFormModal({ open, customers, products, initial, onClose, onSaved }: { open: boolean; customers: Customer[]; products: Product[]; initial?: OrderFormInitial; onClose: () => void; onSaved: () => void }) {
  const editing = !!initial;
  const [customerId, setCustomerId] = useState(initial?.customerId ?? "");
  const [promisedDate, setPromisedDate] = useState(initial?.promisedDate?.slice(0, 10) ?? "");
  const [priority, setPriority] = useState<string>(initial?.priority ?? "normal");
  const [deliveryType, setDeliveryType] = useState<string>(initial?.deliveryType ?? "retirada");
  const [discount, setDiscount] = useState(Number(initial?.discount ?? 0));
  // Texto do percentual enquanto o usuário digita; fora disso o percentual é derivado do desconto.
  const [discountPercentInput, setDiscountPercentInput] = useState<string | null>(null);
  const [method, setMethod] = useState("pix");
  const [paymentStatus, setPaymentStatus] = useState("pendente");
  const [receivedAmount, setReceivedAmount] = useState(0);
  const [proofReference, setProofReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [shippingAddress, setShippingAddress] = useState<Address>(initial?.shipping?.address ?? {});
  const [deliveryWindow, setDeliveryWindow] = useState(initial?.shipping?.deliveryWindow ?? "");
  const [carrier, setCarrier] = useState(initial?.shipping?.carrier ?? "");
  const [driver, setDriver] = useState(initial?.shipping?.driver ?? "");
  const [trackingCode, setTrackingCode] = useState(initial?.shipping?.trackingCode ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [items, setItems] = useState<DraftItem[]>(initial?.items.map((item) => ({ id: item.id, productId: item.productId, quantity: Number(item.quantity), unitPrice: Number(item.unitPrice), notes: item.notes })) ?? [{ productId: "", quantity: 1, unitPrice: 0 }]);
  const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const total = Math.max(0, subtotal - discount);
  const discountPercent = subtotal > 0 ? Math.round((discount / subtotal) * 10000) / 100 : 0;
  function changeDiscountPercent(value: string) { setDiscountPercentInput(value); setDiscount(Math.round(subtotal * Number(value)) / 100); }
  // Na edição, produtos e clientes já vinculados continuam selecionáveis mesmo se inativos.
  const selectableProducts = products.filter((p) => p.active || items.some((item) => item.productId === p.id));
  const selectableCustomers = customers.filter((c) => c.active || c.id === initial?.customerId);
  function updateItem(index: number, values: Partial<DraftItem>) { setItems((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...values } : row)); }
  function selectProduct(index: number, productId: string) { const product = products.find((row) => row.id === productId); updateItem(index, { productId, unitPrice: Number(product?.price ?? 0) }); }
  function selectCustomer(value: string) { const customer = customers.find((row) => row.id === value); setCustomerId(value); setShippingAddress(customer?.address ?? {}); }
  function setAddress(key: keyof Address, value: string) { setShippingAddress((current) => ({ ...current, [key]: value })); }
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setSaving(true);
    const common = {
      customerId, promisedDate: promisedDate || null, priority, deliveryType, discount, notes, items,
      shippingAddress: deliveryType === "retirada" ? {} : shippingAddress,
      deliveryWindow: deliveryWindow || null, carrier: carrier || null, driver: driver || null, trackingCode: trackingCode || null,
    };
    try {
      if (initial) await api(`/orders/${initial.id}`, { method: "PUT", body: JSON.stringify(common) });
      else await api("/orders", { method: "POST", body: JSON.stringify({
        ...common,
        payment: { method, status: paymentStatus, dueDate: promisedDate || null, receivedAmount: paymentStatus === "parcial" ? receivedAmount : undefined, proofReference: proofReference || null, notes: paymentNotes || null },
      }) });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : editing ? "Não foi possível salvar o pedido." : "Não foi possível criar o pedido."); }
    finally { setSaving(false); }
  }
  const discountField = <div className="discount-fields">
    <Field label="Desconto (%)"><input type="number" min="0" max="100" step="0.01" value={discountPercentInput ?? discountPercent} onChange={(e) => changeDiscountPercent(e.target.value)} onBlur={() => setDiscountPercentInput(null)} disabled={subtotal <= 0} /></Field>
    <Field label="Desconto"><MoneyInput value={discount} onChange={setDiscount} /></Field>
  </div>;
  return <Modal open={open} title={editing ? "Alterar pedido" : "Novo pedido"} onClose={onClose} wide><form onSubmit={submit} className="modal-body order-form">
    {error && <ErrorBanner message={error} />}
    <div className="form-section"><div className="form-section-title"><span>1</span><div><strong>Dados do pedido</strong><small>Cliente, prazo e modalidade</small></div></div><div className="form-grid three">
      <Field label="Cliente"><select value={customerId} onChange={(e) => selectCustomer(e.target.value)} required><option value="">Selecione...</option>{selectableCustomers.map((c) => <option value={c.id} key={c.id}>{c.name}</option>)}</select></Field>
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
      <div className="items-editor">{items.map((item, index) => <div className="item-row" key={item.id ?? `new-${index}`}><Field label={index === 0 ? "Produto" : ""}><select value={item.productId} onChange={(e) => selectProduct(index, e.target.value)} required><option value="">Selecione...</option>{selectableProducts.map((p) => <option value={p.id} key={p.id}>{p.sku} · {p.name}</option>)}</select></Field><Field label={index === 0 ? "Qtd." : ""}><input type="number" min="0.001" step="0.001" value={item.quantity} onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })} /></Field><Field label={index === 0 ? "Valor unitário" : ""}><MoneyInput value={item.unitPrice} onChange={(unitPrice) => updateItem(index, { unitPrice })} /></Field><strong className="item-total">{money(item.quantity * item.unitPrice)}</strong><button type="button" className="icon-button danger" disabled={items.length === 1} onClick={() => setItems((rows) => rows.filter((_, i) => i !== index))}><Trash2 size={17} /></button></div>)}</div>
      <button type="button" className="button secondary small" onClick={() => setItems((rows) => [...rows, { productId: "", quantity: 1, unitPrice: 0 }])}><Plus size={16} /> Adicionar item</button>
    </div>
    {editing
      ? <div className="form-section"><div className="form-section-title"><span>3</span><div><strong>Valores</strong><small>A cobrança em aberto é ajustada ao novo total</small></div></div><div className="form-grid three">{discountField}</div></div>
      : <div className="form-section"><div className="form-section-title"><span>3</span><div><strong>Pagamento</strong><small>Condição inicial da cobrança</small></div></div><div className="form-grid three"><Field label="Forma"><select value={method} onChange={(e) => setMethod(e.target.value)}><option value="pix">Pix</option><option value="cartao">Cartão</option><option value="boleto">Boleto</option><option value="dinheiro">Dinheiro</option></select></Field><Field label="Situação"><select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}><option value="pendente">Pendente</option><option value="parcial">Parcial</option><option value="pago">Pago</option></select></Field>{discountField}{paymentStatus === "parcial" && <Field label="Valor recebido"><input type="number" min="0.01" max={Math.max(total - 0.01, 0.01)} step="0.01" value={receivedAmount} onChange={(e) => setReceivedAmount(Number(e.target.value))} required /></Field>}<Field label="Comprovante / referência"><input value={proofReference} onChange={(e) => setProofReference(e.target.value)} /></Field><Field label="Observações do pagamento"><input value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} /></Field></div></div>}
    <div className="order-summary"><div><span>Subtotal</span><strong>{money(subtotal)}</strong></div><div><span>Desconto</span><strong>- {money(discount)}</strong></div><div className="summary-total"><span>Total</span><strong>{money(total)}</strong></div></div>
    <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancelar</button><button className="button primary" disabled={saving}>{editing ? <Save size={18} /> : <ShoppingBasket size={18} />} {saving ? "Salvando..." : editing ? "Salvar alterações" : "Criar pedido"}</button></div>
  </form></Modal>;
}
