import { useEffect, useState } from "react";
import { CheckCircle2, ChevronRight, PackageCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState, Loading, PageHeader, PriorityBadge } from "../components/ui";
import { api, shortDate } from "../lib/api";
import type { Order } from "../types";

export function PreparationPage() {
  const [orders, setOrders] = useState<Order[]>([]); const [loading, setLoading] = useState(true);
  useEffect(() => { api<Order[]>("/orders?status=preparacao").then(setOrders).finally(() => setLoading(false)); }, []);
  return <><PageHeader eyebrow="Separação e conferência" title="Preparação" description="Confira item a item antes de liberar o pedido para expedição." />{loading ? <Loading /> : orders.length ? <div className="prep-grid">{orders.map((order) => <Link to={`/pedidos/${order.id}`} className="prep-card" key={order.id}><div className="prep-icon"><PackageCheck /></div><div><span>{order.number}</span><h3>{order.customerName}</h3><div><PriorityBadge priority={order.priority} /><small>Prazo {shortDate(order.promisedDate)}</small></div></div><ChevronRight /></Link>)}</div> : <EmptyState icon={<CheckCircle2 />} title="Tudo conferido" description="Nenhum pedido aguarda preparação agora." />}</>;
}
