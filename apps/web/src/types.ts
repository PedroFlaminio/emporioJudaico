export type Role = "atendimento" | "producao" | "expedicao" | "financeiro" | "gestor" | "administrador";
export type OrderStatus = "recebido" | "pagamento_pendente" | "pagamento_confirmado" | "em_producao" | "preparacao" | "pronto" | "expedicao" | "entregue" | "cancelado";
export type Priority = "baixa" | "normal" | "alta" | "urgente";

export type User = { id: string; name: string; email: string; role: Role; department: string | null };
export type Customer = { id: string; name: string; document: string | null; phone: string | null; email: string | null; address: Address; notes?: string | null; active: boolean };
export type Address = { street?: string; number?: string; complement?: string; district?: string; city?: string; state?: string; zipCode?: string };
export type Product = { id: string; sku: string; name: string; description: string | null; price: string; productionMinutes: number; active: boolean; categoryId: string | null; categoryName: string | null };
export type Category = { id: string; name: string; active: boolean };
export type Order = { id: string; number: string; status: OrderStatus; priority: Priority; deliveryType: "entrega" | "retirada" | "transportadora"; orderDate: string; promisedDate: string | null; total: string; notes: string | null; updatedAt: string; customerId: string; customerName: string; customerPhone: string | null };
export type Payment = { id: string; amount: string; receivedAmount: string; method: string; status: "pendente" | "parcial" | "pago" | "vencido" | "cancelado" | "estornado"; dueDate: string | null; paidAt: string | null; proofReference: string | null; notes: string | null; orderId: string; orderNumber: string; orderTotal: string; customerName: string };
export type ProductionJob = { id: string; status: "aguardando" | "em_andamento" | "pausado" | "concluido"; startedAt: string | null; completedAt: string | null; notes: string | null; assigneeId: string | null; assigneeName: string | null; orderId: string; orderNumber: string; orderStatus: OrderStatus; priority: Priority; promisedDate: string | null; customerName: string };
export type Shipment = { id: string; type: string; address: Address; deliveryWindow: string | null; carrier: string | null; driver: string | null; trackingCode: string | null; departedAt: string | null; deliveredAt: string | null; failedReason: string | null; orderId: string; orderNumber: string; orderStatus: OrderStatus; promisedDate: string | null; customerName: string; customerPhone: string | null };

export const statusLabel: Record<OrderStatus, string> = {
  recebido: "Recebido", pagamento_pendente: "Pagamento pendente", pagamento_confirmado: "Pagamento confirmado",
  em_producao: "Em produção", preparacao: "Preparação", pronto: "Pronto", expedicao: "Expedição",
  entregue: "Entregue", cancelado: "Cancelado",
};
export const priorityLabel: Record<Priority, string> = { baixa: "Baixa", normal: "Normal", alta: "Alta", urgente: "Urgente" };
export const roleLabel: Record<Role, string> = { atendimento: "Atendimento", producao: "Produção", expedicao: "Expedição", financeiro: "Financeiro", gestor: "Gestor", administrador: "Administrador" };
