import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, Banknote, Boxes, CalendarClock, CircleAlert, ClipboardList, Plus, ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState, Loading, PageHeader, PriorityBadge, StatusBadge } from "../components/ui";
import { api, money, shortDate } from "../lib/api";
import { statusLabel, type Order, type OrderStatus } from "../types";

type Dashboard = {
  byStatus: Array<{ status: OrderStatus; count: number; total: string }>;
  overduePayments: { count: number; amount: string };
  dueOrders: number;
  openIssues: number;
  recentOrders: Order[];
};

export function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { api<Dashboard>("/dashboard").then(setData).catch((e) => setError(e.message)); }, []);
  if (!data && !error) return <Loading />;
  if (!data) return <div className="error-banner">{error}</div>;
  const active = data.byStatus.reduce((sum, item) => sum + Number(item.count), 0);
  const production = data.byStatus.find((item) => item.status === "em_producao")?.count ?? 0;
  const ready = data.byStatus.find((item) => item.status === "pronto")?.count ?? 0;
  const maxCount = Math.max(...data.byStatus.map((item) => item.count), 1);
  return <>
    <PageHeader eyebrow="Visão de hoje" title="Painel operacional" description="Acompanhe o que precisa da sua atenção agora." actions={<Link to="/pedidos" className="button primary"><Plus size={18} /> Novo pedido</Link>} />
    <section className="metrics-grid">
      <article className="metric-card featured"><div className="metric-icon"><ClipboardList /></div><div><span>Pedidos em andamento</span><strong>{active}</strong><small>em todas as etapas</small></div></article>
      <article className="metric-card"><div className="metric-icon amber"><Boxes /></div><div><span>Em produção</span><strong>{production}</strong><small>na fila de trabalho</small></div></article>
      <article className="metric-card"><div className="metric-icon blue"><ShoppingBag /></div><div><span>Prontos</span><strong>{ready}</strong><small>aguardando saída</small></div></article>
      <article className="metric-card"><div className="metric-icon red"><Banknote /></div><div><span>Valores vencidos</span><strong>{money(data.overduePayments.amount)}</strong><small>{data.overduePayments.count} pagamentos</small></div></article>
    </section>
    <section className="alerts-strip">
      <div><span className="alert-icon danger"><CalendarClock /></span><p><strong>{data.dueOrders} pedidos no limite</strong><small>Prometidos até hoje e ainda abertos</small></p><Link to="/pedidos">Ver pedidos <ArrowRight size={15} /></Link></div>
      <div><span className="alert-icon warning"><CircleAlert /></span><p><strong>{data.openIssues} ocorrências abertas</strong><small>Pendências que precisam de solução</small></p><Link to="/producao">Ver produção <ArrowRight size={15} /></Link></div>
    </section>
    <div className="dashboard-columns">
      <section className="panel"><div className="panel-header"><div><span className="eyebrow">Fluxo atual</span><h2>Pedidos por etapa</h2></div><Link to="/pedidos" className="text-link">Abrir quadro <ArrowRight size={15} /></Link></div>
        <div className="status-bars">{data.byStatus.filter((item) => !["entregue", "cancelado"].includes(item.status)).map((item) => <div key={item.status}><div><span>{statusLabel[item.status]}</span><strong>{item.count}</strong></div><span className={`bar status-${item.status}`}><i style={{ width: `${(item.count / maxCount) * 100}%` }} /></span></div>)}</div>
      </section>
      <section className="panel"><div className="panel-header"><div><span className="eyebrow">Últimas entradas</span><h2>Pedidos recentes</h2></div></div>
        <div className="compact-orders">{data.recentOrders.length ? data.recentOrders.map((order) => <Link to={`/pedidos/${order.id}`} key={order.id} className="compact-order"><div><strong>{order.number}</strong><span>{order.customerName}</span></div><div><PriorityBadge priority={order.priority} /><span className="compact-date">{shortDate(order.promisedDate)}</span></div></Link>) : <EmptyState icon={<ClipboardList />} title="Sem pedidos" description="Os novos pedidos aparecerão aqui." />}</div>
      </section>
    </div>
    {data.dueOrders > 0 && <div className="attention-note"><AlertTriangle size={18} /><span>Revise primeiro os pedidos com data prometida para hoje ou em atraso.</span></div>}
  </>;
}
