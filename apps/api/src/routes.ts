import { Elysia } from "elysia";
import { and, asc, desc, eq, ilike, inArray, lte, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import {
  categories,
  collectionContacts,
  customers,
  occurrences,
  orderHistory,
  orderItems,
  orders,
  payments,
  productionJobs,
  products,
  shipments,
  users,
  type OrderStatus,
  type UserRole,
} from "./db/schema";
import { can, createSession, deleteSession } from "./lib/auth";
import { apiError, forbidden, isForeignKeyViolation, parseBody, requireUser } from "./lib/http";
import { config } from "./config";

const id = z.string().uuid();
const optionalText = z.string().trim().optional().nullable();
const addressSchema = z.object({
  street: z.string().trim().optional(),
  number: z.string().trim().optional(),
  complement: z.string().trim().optional(),
  district: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  zipCode: z.string().trim().optional(),
}).optional().default({});

const customerSchema = z.object({
  name: z.string().trim().min(2),
  document: optionalText,
  phone: optionalText,
  email: z.string().email().optional().nullable().or(z.literal("")),
  address: addressSchema,
  notes: optionalText,
  active: z.boolean().optional(),
});

const productSchema = z.object({
  name: z.string().trim().min(2),
  sku: z.string().trim().min(1),
  categoryId: z.string().uuid().optional().nullable(),
  description: optionalText,
  price: z.coerce.number().nonnegative(),
  productionMinutes: z.coerce.number().int().nonnegative().default(0),
  active: z.boolean().optional(),
});

const categorySchema = z.object({
  name: z.string().trim().min(2),
  active: z.boolean().optional(),
});

const roleSchema = z.enum(["atendimento", "producao", "expedicao", "financeiro", "gestor", "administrador"]);
const userSelection = { id: users.id, name: users.name, email: users.email, role: users.role, department: users.department, active: users.active };

const orderSchema = z.object({
  customerId: id,
  promisedDate: z.string().optional().nullable(),
  priority: z.enum(["baixa", "normal", "alta", "urgente"]).default("normal"),
  deliveryType: z.enum(["entrega", "retirada", "transportadora"]).default("retirada"),
  discount: z.coerce.number().nonnegative().default(0),
  notes: optionalText,
  items: z.array(z.object({
    productId: id,
    quantity: z.coerce.number().positive(),
    unitPrice: z.coerce.number().nonnegative(),
    notes: optionalText,
  })).min(1),
  payment: z.object({
    method: z.string().trim().min(1),
    dueDate: z.string().optional().nullable(),
    status: z.enum(["pendente", "parcial", "pago"]).default("pendente"),
    receivedAmount: z.coerce.number().nonnegative().optional(),
    proofReference: optionalText,
    notes: optionalText,
  }).optional(),
  shippingAddress: addressSchema,
  deliveryWindow: optionalText,
  carrier: optionalText,
  driver: optionalText,
  trackingCode: optionalText,
});

const orderUpdateSchema = orderSchema.omit({ payment: true, items: true }).extend({
  items: z.array(z.object({
    id: id.optional(),
    productId: id,
    quantity: z.coerce.number().positive(),
    unitPrice: z.coerce.number().nonnegative(),
    notes: optionalText,
  })).min(1),
});

// O pedido pode ser alterado em qualquer etapa, inclusive na expedição.
const orderEditRoles: UserRole[] = ["atendimento", "gestor"];

const flow: Record<OrderStatus, OrderStatus[]> = {
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

const orderStatusLabels: Record<OrderStatus, string> = {
  recebido: "Recebido",
  pagamento_pendente: "Pagamento pendente",
  pagamento_confirmado: "Pagamento confirmado",
  em_producao: "Em produção",
  preparacao: "Preparação",
  pronto: "Pronto",
  expedicao: "Expedição",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

function invalidTransitionMessage(current: OrderStatus, target: OrderStatus) {
  const nextSteps = flow[current].filter((status) => status !== "cancelado");
  const nextStepMessage = nextSteps.length === 1
    ? ` A próxima etapa disponível é ${orderStatusLabels[nextSteps[0]!]}.`
    : "";
  return `O pedido está em ${orderStatusLabels[current]} e não pode ir diretamente para ${orderStatusLabels[target]}.${nextStepMessage}`;
}

const transitionRoles: Record<OrderStatus, UserRole[]> = {
  recebido: [],
  pagamento_pendente: ["atendimento", "financeiro", "gestor"],
  pagamento_confirmado: ["atendimento", "financeiro", "gestor"],
  em_producao: ["producao", "gestor"],
  preparacao: ["producao", "gestor"],
  pronto: ["producao", "expedicao", "gestor"],
  expedicao: ["expedicao", "gestor"],
  entregue: ["expedicao", "gestor"],
  cancelado: ["atendimento", "gestor"],
};

function allowedTransitionsFor(user: Awaited<ReturnType<typeof requireUser>>, status: OrderStatus) {
  if (!user) return [];
  return flow[status].filter((target) => can(user, transitionRoles[target]));
}

const orderListSelection = {
  id: orders.id,
  number: orders.number,
  status: orders.status,
  priority: orders.priority,
  deliveryType: orders.deliveryType,
  orderDate: orders.orderDate,
  promisedDate: orders.promisedDate,
  total: orders.total,
  notes: orders.notes,
  updatedAt: orders.updatedAt,
  customerId: customers.id,
  customerName: customers.name,
  customerPhone: customers.phone,
};

const shipmentSelection = {
  id: shipments.id,
  type: shipments.type,
  address: shipments.address,
  deliveryWindow: shipments.deliveryWindow,
  carrier: shipments.carrier,
  driver: shipments.driver,
  trackingCode: shipments.trackingCode,
  departedAt: shipments.departedAt,
  deliveredAt: shipments.deliveredAt,
  failedReason: shipments.failedReason,
  orderId: orders.id,
  orderNumber: orders.number,
  orderStatus: orders.status,
  promisedDate: orders.promisedDate,
  customerName: customers.name,
  customerPhone: customers.phone,
};

const deliveredSortColumns = {
  deliveredAt: shipments.deliveredAt,
  promisedDate: orders.promisedDate,
  orderNumber: orders.number,
  customerName: customers.name,
};

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const deliveredQuerySchema = z.object({
  search: z.string().trim().optional(),
  type: z.enum(["entrega", "retirada", "transportadora"]).optional().or(z.literal("").transform(() => undefined)),
  from: isoDate.optional().or(z.literal("").transform(() => undefined)),
  to: isoDate.optional().or(z.literal("").transform(() => undefined)),
  sort: z.enum(["deliveredAt", "promisedDate", "orderNumber", "customerName"]).default("deliveredAt"),
  dir: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const apiRoutes = new Elysia({ prefix: "/api" })
  .get("/health", () => ({ status: "ok", service: "emporio-api", timestamp: new Date().toISOString() }))
  .post("/auth/login", async ({ body, set }) => {
    try {
      const input = parseBody(z.object({ email: z.string().email(), password: z.string().min(6) }), body);
      const [user] = await db.select().from(users).where(and(eq(users.email, input.email.toLowerCase()), eq(users.active, true))).limit(1);
      if (!user || !(await Bun.password.verify(input.password, user.passwordHash))) {
        set.status = 401;
        return { message: "E-mail ou senha inválidos." };
      }
      const token = await createSession(user.id, config.sessionDays);
      return { token, user: { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department } };
    } catch (error) { return apiError(error, set); }
  })
  .get("/auth/me", async ({ headers, set }) => {
    const user = await requireUser(headers.authorization, set);
    return user ?? { message: "Sessão inválida ou expirada." };
  })
  .post("/auth/logout", async ({ headers }) => {
    await deleteSession(headers.authorization);
    return { success: true };
  })
  .get("/dashboard", async ({ headers, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) return forbidden(set);
    const today = new Date().toISOString().slice(0, 10);
    const [byStatus, overduePayments, dueOrders, openIssues, recentOrders] = await Promise.all([
      db.select({ status: orders.status, count: sql<number>`count(*)::int`, total: sql<string>`coalesce(sum(${orders.total}), 0)` }).from(orders).where(and(ne(orders.status, "cancelado"), ne(orders.status, "entregue"))).groupBy(orders.status),
      db.select({ count: sql<number>`count(*)::int`, amount: sql<string>`coalesce(sum(greatest(${payments.amount} - ${payments.receivedAmount}, 0)), 0)` }).from(payments).where(and(inArray(payments.status, ["pendente", "parcial", "vencido"]), lte(payments.dueDate, today))),
      db.select({ count: sql<number>`count(*)::int` }).from(orders).where(and(lte(orders.promisedDate, today), ne(orders.status, "entregue"), ne(orders.status, "cancelado"))),
      db.select({ count: sql<number>`count(*)::int` }).from(occurrences).where(eq(occurrences.status, "aberta")),
      db.select(orderListSelection).from(orders).innerJoin(customers, eq(orders.customerId, customers.id)).orderBy(desc(orders.createdAt)).limit(6),
    ]);
    return {
      byStatus,
      overduePayments: overduePayments[0] ?? { count: 0, amount: "0" },
      dueOrders: dueOrders[0]?.count ?? 0,
      openIssues: openIssues[0]?.count ?? 0,
      recentOrders,
    };
  })
  .get("/customers", async ({ headers, query, set }) => {
    if (!await requireUser(headers.authorization, set)) return forbidden(set);
    const search = query.search?.trim();
    return db.select().from(customers)
      .where(search ? or(ilike(customers.name, `%${search}%`), ilike(customers.document, `%${search}%`), ilike(customers.phone, `%${search}%`)) : undefined)
      .orderBy(asc(customers.name));
  })
  .post("/customers", async ({ headers, body, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user || !can(user, ["atendimento", "gestor"])) return forbidden(set, user);
    try {
      const input = parseBody(customerSchema, body);
      const [created] = await db.insert(customers).values({ ...input, email: input.email || null }).returning();
      set.status = 201;
      return created;
    } catch (error) { return apiError(error, set); }
  })
  .put("/customers/:id", async ({ headers, params, body, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user || !can(user, ["atendimento", "gestor"])) return forbidden(set, user);
    try {
      const input = parseBody(customerSchema, body);
      const [updated] = await db.update(customers).set({ ...input, email: input.email || null, updatedAt: new Date() }).where(eq(customers.id, params.id)).returning();
      if (!updated) { set.status = 404; return { message: "Cliente não encontrado." }; }
      return updated;
    } catch (error) { return apiError(error, set); }
  })
  .delete("/customers/:id", async ({ headers, params, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user || !can(user, ["atendimento", "gestor"])) return forbidden(set, user);
    try {
      const [deleted] = await db.delete(customers).where(eq(customers.id, params.id)).returning({ id: customers.id });
      if (!deleted) { set.status = 404; return { message: "Cliente não encontrado." }; }
      return { success: true };
    } catch (error) {
      if (isForeignKeyViolation(error)) { set.status = 409; return { message: "Este cliente possui pedidos e não pode ser excluído. Edite o cadastro e marque-o como inativo." }; }
      return apiError(error, set);
    }
  })
  .get("/categories", async ({ headers, set }) => {
    if (!await requireUser(headers.authorization, set)) return forbidden(set);
    return db.select().from(categories).orderBy(asc(categories.name));
  })
  .post("/categories", async ({ headers, body, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user || !can(user, ["gestor"])) return forbidden(set, user);
    try {
      const input = parseBody(categorySchema, body);
      const [created] = await db.insert(categories).values(input).returning();
      set.status = 201;
      return created;
    } catch (error) { return apiError(error, set); }
  })
  .put("/categories/:id", async ({ headers, params, body, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user || !can(user, ["gestor"])) return forbidden(set, user);
    try {
      const input = parseBody(categorySchema, body);
      const [updated] = await db.update(categories).set({ ...input, updatedAt: new Date() }).where(eq(categories.id, params.id)).returning();
      if (!updated) { set.status = 404; return { message: "Categoria não encontrada." }; }
      return updated;
    } catch (error) { return apiError(error, set); }
  })
  .delete("/categories/:id", async ({ headers, params, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user || !can(user, ["gestor"])) return forbidden(set, user);
    try {
      // Produtos da categoria ficam "Sem categoria" (on delete set null).
      const [deleted] = await db.delete(categories).where(eq(categories.id, params.id)).returning({ id: categories.id });
      if (!deleted) { set.status = 404; return { message: "Categoria não encontrada." }; }
      return { success: true };
    } catch (error) { return apiError(error, set); }
  })
  .get("/products", async ({ headers, query, set }) => {
    if (!await requireUser(headers.authorization, set)) return forbidden(set);
    const search = query.search?.trim();
    return db.select({
      id: products.id, sku: products.sku, name: products.name, description: products.description,
      price: products.price, productionMinutes: products.productionMinutes, active: products.active,
      categoryId: products.categoryId, categoryName: categories.name,
    }).from(products).leftJoin(categories, eq(products.categoryId, categories.id))
      .where(search ? or(ilike(products.name, `%${search}%`), ilike(products.sku, `%${search}%`)) : undefined)
      .orderBy(asc(products.name));
  })
  .post("/products", async ({ headers, body, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user || !can(user, ["atendimento", "gestor"])) return forbidden(set, user);
    try {
      const input = parseBody(productSchema, body);
      const [created] = await db.insert(products).values({ ...input, price: input.price.toFixed(2) }).returning();
      set.status = 201;
      return created;
    } catch (error) { return apiError(error, set); }
  })
  .put("/products/:id", async ({ headers, params, body, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user || !can(user, ["atendimento", "gestor"])) return forbidden(set, user);
    try {
      const input = parseBody(productSchema, body);
      const [updated] = await db.update(products).set({ ...input, price: input.price.toFixed(2), updatedAt: new Date() }).where(eq(products.id, params.id)).returning();
      if (!updated) { set.status = 404; return { message: "Produto não encontrado." }; }
      return updated;
    } catch (error) { return apiError(error, set); }
  })
  .delete("/products/:id", async ({ headers, params, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user || !can(user, ["atendimento", "gestor"])) return forbidden(set, user);
    try {
      const [deleted] = await db.delete(products).where(eq(products.id, params.id)).returning({ id: products.id });
      if (!deleted) { set.status = 404; return { message: "Produto não encontrado." }; }
      return { success: true };
    } catch (error) {
      if (isForeignKeyViolation(error)) { set.status = 409; return { message: "Este produto já foi usado em pedidos e não pode ser excluído. Edite o cadastro e marque-o como inativo." }; }
      return apiError(error, set);
    }
  })
  .get("/orders", async ({ headers, query, set }) => {
    if (!await requireUser(headers.authorization, set)) return forbidden(set);
    const filters = [];
    if (query.status) filters.push(eq(orders.status, query.status as OrderStatus));
    if (query.search) filters.push(or(ilike(orders.number, `%${query.search}%`), ilike(customers.name, `%${query.search}%`))!);
    return db.select(orderListSelection).from(orders).innerJoin(customers, eq(orders.customerId, customers.id))
      .where(filters.length ? and(...filters) : undefined).orderBy(asc(orders.promisedDate), desc(orders.createdAt));
  })
  .post("/orders", async ({ headers, body, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user || !can(user, ["atendimento", "gestor"])) return forbidden(set, user);
    try {
      const input = parseBody(orderSchema, body);
      const subtotal = input.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      const total = Math.max(0, subtotal - input.discount);
      const receivedAmount = input.payment?.status === "pago" ? total : input.payment?.status === "parcial" ? (input.payment.receivedAmount ?? 0) : 0;
      if (input.payment?.status === "parcial" && (receivedAmount <= 0 || receivedAmount >= total)) {
        set.status = 422;
        return { message: "Em um pagamento parcial, o valor recebido deve ser maior que zero e menor que o total do pedido." };
      }
      const number = `PED-${new Date().toISOString().slice(2, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 5).toUpperCase()}`;
      const status: OrderStatus = input.payment?.status === "pago" ? "pagamento_confirmado" : input.payment ? "pagamento_pendente" : "recebido";
      const result = await db.transaction(async (tx) => {
        const [order] = await tx.insert(orders).values({
          number, customerId: input.customerId, promisedDate: input.promisedDate || null,
          priority: input.priority, deliveryType: input.deliveryType, discount: input.discount.toFixed(2),
          subtotal: subtotal.toFixed(2), total: total.toFixed(2), notes: input.notes, createdBy: user.id, status,
        }).returning();
        if (!order) throw new Error("Falha ao criar pedido");
        await tx.insert(orderItems).values(input.items.map((item) => ({
          orderId: order.id, productId: item.productId, quantity: item.quantity.toFixed(3),
          unitPrice: item.unitPrice.toFixed(2), total: (item.quantity * item.unitPrice).toFixed(2), notes: item.notes,
        })));
        await tx.insert(productionJobs).values({ orderId: order.id });
        await tx.insert(shipments).values({
          orderId: order.id,
          type: input.deliveryType,
          address: input.shippingAddress,
          deliveryWindow: input.deliveryWindow,
          carrier: input.carrier,
          driver: input.driver,
          trackingCode: input.trackingCode,
        });
        await tx.insert(orderHistory).values({ orderId: order.id, toStatus: status, changedBy: user.id, notes: "Pedido criado" });
        if (input.payment) await tx.insert(payments).values({
          orderId: order.id, amount: total.toFixed(2), method: input.payment.method,
          status: input.payment.status, dueDate: input.payment.dueDate || null,
          paidAt: input.payment.status === "pago" ? new Date() : null,
          receivedAmount: receivedAmount.toFixed(2), proofReference: input.payment.proofReference,
          notes: input.payment.notes,
        });
        return order;
      });
      set.status = 201;
      return result;
    } catch (error) { return apiError(error, set); }
  })
  .get("/orders/:id", async ({ headers, params, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) return forbidden(set);
    const [order] = await db.select({ ...orderListSelection, discount: orders.discount, subtotal: orders.subtotal, createdAt: orders.createdAt, customerEmail: customers.email, customerAddress: customers.address })
      .from(orders).innerJoin(customers, eq(orders.customerId, customers.id)).where(eq(orders.id, params.id)).limit(1);
    if (!order) { set.status = 404; return { message: "Pedido não encontrado." }; }
    const [items, paymentRows, production, shipping, issueRows, history] = await Promise.all([
      db.select({ id: orderItems.id, quantity: orderItems.quantity, unitPrice: orderItems.unitPrice, total: orderItems.total, notes: orderItems.notes, checkStatus: orderItems.checkStatus, productId: products.id, productName: products.name, sku: products.sku })
        .from(orderItems).innerJoin(products, eq(orderItems.productId, products.id)).where(eq(orderItems.orderId, params.id)),
      db.select().from(payments).where(eq(payments.orderId, params.id)).orderBy(desc(payments.createdAt)),
      db.select({ id: productionJobs.id, status: productionJobs.status, startedAt: productionJobs.startedAt, completedAt: productionJobs.completedAt, notes: productionJobs.notes, assigneeId: productionJobs.assigneeId, assigneeName: users.name }).from(productionJobs).leftJoin(users, eq(productionJobs.assigneeId, users.id)).where(eq(productionJobs.orderId, params.id)).limit(1),
      db.select().from(shipments).where(eq(shipments.orderId, params.id)).limit(1),
      db.select({ id: occurrences.id, type: occurrences.type, description: occurrences.description, status: occurrences.status, solution: occurrences.solution, createdAt: occurrences.createdAt, resolvedAt: occurrences.resolvedAt, createdByName: users.name }).from(occurrences).innerJoin(users, eq(occurrences.createdBy, users.id)).where(eq(occurrences.orderId, params.id)).orderBy(desc(occurrences.createdAt)),
      db.select({ id: orderHistory.id, fromStatus: orderHistory.fromStatus, toStatus: orderHistory.toStatus, notes: orderHistory.notes, createdAt: orderHistory.createdAt, userName: users.name }).from(orderHistory).innerJoin(users, eq(orderHistory.changedBy, users.id)).where(eq(orderHistory.orderId, params.id)).orderBy(desc(orderHistory.createdAt)),
    ]);
    return {
      ...order, items, payments: paymentRows, production: production[0] ?? null, shipping: shipping[0] ?? null, occurrences: issueRows, history,
      allowedTransitions: allowedTransitionsFor(user, order.status),
      canEdit: can(user, orderEditRoles),
    };
  })
  .put("/orders/:id", async ({ headers, params, body, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user || !can(user, orderEditRoles)) return forbidden(set, user);
    try {
      const input = parseBody(orderUpdateSchema, body);
      const [current] = await db.select().from(orders).where(eq(orders.id, params.id)).limit(1);
      if (!current) { set.status = 404; return { message: "Pedido não encontrado." }; }
      const subtotal = input.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      const total = Math.max(0, subtotal - input.discount);
      const result = await db.transaction(async (tx) => {
        const [order] = await tx.update(orders).set({
          customerId: input.customerId, promisedDate: input.promisedDate || null, priority: input.priority,
          deliveryType: input.deliveryType, discount: input.discount.toFixed(2), subtotal: subtotal.toFixed(2),
          total: total.toFixed(2), notes: input.notes, updatedAt: new Date(),
        }).where(eq(orders.id, params.id)).returning();

        // Itens mantidos preservam a conferência, a menos que produto ou quantidade tenham mudado.
        const existing = await tx.select().from(orderItems).where(eq(orderItems.orderId, params.id));
        const keptIds = new Set(input.items.flatMap((item) => item.id ? [item.id] : []));
        const removedIds = existing.filter((item) => !keptIds.has(item.id)).map((item) => item.id);
        if (removedIds.length) await tx.delete(orderItems).where(inArray(orderItems.id, removedIds));
        for (const item of input.items) {
          const values = {
            productId: item.productId, quantity: item.quantity.toFixed(3), unitPrice: item.unitPrice.toFixed(2),
            total: (item.quantity * item.unitPrice).toFixed(2), notes: item.notes,
          };
          const previous = item.id ? existing.find((row) => row.id === item.id) : undefined;
          if (!previous) { await tx.insert(orderItems).values({ orderId: params.id, ...values }); continue; }
          const changed = previous.productId !== values.productId || Number(previous.quantity) !== item.quantity;
          await tx.update(orderItems).set({ ...values, ...(changed ? { checkStatus: "pendente" as const, checkedBy: null, checkedAt: null } : {}) }).where(eq(orderItems.id, previous.id));
        }

        await tx.update(shipments).set({
          type: input.deliveryType, address: input.deliveryType === "retirada" ? {} : input.shippingAddress,
          deliveryWindow: input.deliveryWindow, carrier: input.carrier, driver: input.driver,
          trackingCode: input.trackingCode, updatedAt: new Date(),
        }).where(eq(shipments.orderId, params.id));

        // Mantém a cobrança em aberto alinhada ao novo total do pedido.
        const [payment] = await tx.select().from(payments)
          .where(and(eq(payments.orderId, params.id), inArray(payments.status, ["pendente", "parcial", "pago", "vencido"])))
          .orderBy(desc(payments.createdAt)).limit(1);
        if (payment && Number(payment.amount) !== total) {
          const received = Number(payment.receivedAmount);
          const status = received <= 0 ? payment.status : received >= total ? "pago" : "parcial";
          await tx.update(payments).set({
            amount: total.toFixed(2), status,
            paidAt: status === "pago" ? payment.paidAt ?? new Date() : null, updatedAt: new Date(),
          }).where(eq(payments.id, payment.id));
        }

        const totalNote = Number(current.total) !== total ? ` (total ${Number(current.total).toFixed(2)} → ${total.toFixed(2)})` : "";
        await tx.insert(orderHistory).values({ orderId: params.id, fromStatus: current.status, toStatus: current.status, notes: `Pedido alterado${totalNote}`, changedBy: user.id });
        return order;
      });
      return result;
    } catch (error) { return apiError(error, set); }
  })
  .post("/orders/:id/transition", async ({ headers, params, body, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) return forbidden(set);
    try {
      const input = parseBody(z.object({ status: z.enum(["recebido", "pagamento_pendente", "pagamento_confirmado", "em_producao", "preparacao", "pronto", "expedicao", "entregue", "cancelado"]), notes: optionalText }), body);
      const [current] = await db.select().from(orders).where(eq(orders.id, params.id)).limit(1);
      if (!current) { set.status = 404; return { message: "Pedido não encontrado." }; }
      if (!flow[current.status].includes(input.status)) { set.status = 409; return { message: invalidTransitionMessage(current.status, input.status) }; }
      if (!can(user, transitionRoles[input.status])) return forbidden(set, user);
      await db.transaction(async (tx) => {
        await tx.update(orders).set({ status: input.status, updatedAt: new Date() }).where(eq(orders.id, params.id));
        await tx.insert(orderHistory).values({ orderId: params.id, fromStatus: current.status, toStatus: input.status, notes: input.notes, changedBy: user.id });
        if (input.status === "em_producao") await tx.update(productionJobs).set({ status: "em_andamento", startedAt: new Date(), assigneeId: user.id, updatedAt: new Date() }).where(eq(productionJobs.orderId, params.id));
        if (input.status === "preparacao") await tx.update(productionJobs).set({ status: "concluido", completedAt: new Date(), updatedAt: new Date() }).where(eq(productionJobs.orderId, params.id));
        if (input.status === "expedicao") await tx.update(shipments).set({ departedAt: new Date(), updatedAt: new Date() }).where(eq(shipments.orderId, params.id));
        if (input.status === "entregue") await tx.update(shipments).set({ deliveredAt: new Date(), updatedAt: new Date() }).where(eq(shipments.orderId, params.id));
      });
      return { success: true, status: input.status };
    } catch (error) { return apiError(error, set); }
  })
  .patch("/order-items/:id/check", async ({ headers, params, body, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user || !can(user, ["producao", "expedicao", "gestor"])) return forbidden(set, user);
    try {
      const input = parseBody(z.object({ status: z.enum(["pendente", "separado", "conferido", "faltante", "substituido", "avariado"]) }), body);
      const [updated] = await db.update(orderItems).set({ checkStatus: input.status, checkedBy: user.id, checkedAt: new Date() }).where(eq(orderItems.id, params.id)).returning();
      return updated;
    } catch (error) { return apiError(error, set); }
  })
  .get("/payments", async ({ headers, query, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user || !can(user, ["financeiro", "gestor"])) return forbidden(set, user);
    const filters = query.status ? [eq(payments.status, query.status as typeof payments.status.enumValues[number])] : [];
    return db.select({ id: payments.id, amount: payments.amount, receivedAmount: payments.receivedAmount, method: payments.method, status: payments.status, dueDate: payments.dueDate, paidAt: payments.paidAt, proofReference: payments.proofReference, notes: payments.notes, orderId: orders.id, orderNumber: orders.number, orderTotal: orders.total, customerName: customers.name })
      .from(payments).innerJoin(orders, eq(payments.orderId, orders.id)).innerJoin(customers, eq(orders.customerId, customers.id))
      .where(filters.length ? and(...filters) : undefined).orderBy(asc(payments.dueDate));
  })
  .patch("/payments/:id", async ({ headers, params, body, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user || !can(user, ["financeiro", "gestor"])) return forbidden(set, user);
    try {
      const input = parseBody(z.object({
        status: z.enum(["pendente", "parcial", "pago", "vencido", "cancelado", "estornado"]),
        receivedAmount: z.coerce.number().nonnegative().optional(), method: z.string().trim().min(1).optional(),
        dueDate: z.string().optional().nullable(), proofReference: optionalText, notes: optionalText,
      }), body);
      const [current] = await db.select({ payment: payments, orderTotal: orders.total }).from(payments).innerJoin(orders, eq(payments.orderId, orders.id)).where(eq(payments.id, params.id)).limit(1);
      if (!current) { set.status = 404; return { message: "Pagamento não encontrado." }; }
      const total = Number(current.orderTotal);
      const receivedAmount = input.status === "pago" ? total : input.status === "parcial" ? (input.receivedAmount ?? Number(current.payment.receivedAmount)) : 0;
      if (input.status === "parcial" && (receivedAmount <= 0 || receivedAmount >= total)) {
        set.status = 422;
        return { message: "Em um pagamento parcial, o valor recebido deve ser maior que zero e menor que o total do pedido." };
      }
      const [updated] = await db.update(payments).set({
        ...input, receivedAmount: receivedAmount.toFixed(2),
        paidAt: input.status === "pago" ? new Date() : null, updatedAt: new Date(),
      }).where(eq(payments.id, params.id)).returning();
      if (!updated) { set.status = 404; return { message: "Pagamento não encontrado." }; }
      if (input.status === "pago") {
        const [order] = await db.select().from(orders).where(eq(orders.id, updated.orderId)).limit(1);
        if (order?.status === "pagamento_pendente") await db.transaction(async (tx) => {
          await tx.update(orders).set({ status: "pagamento_confirmado", updatedAt: new Date() }).where(eq(orders.id, order.id));
          await tx.insert(orderHistory).values({ orderId: order.id, fromStatus: order.status, toStatus: "pagamento_confirmado", notes: "Pagamento confirmado", changedBy: user.id });
        });
      }
      return updated;
    } catch (error) { return apiError(error, set); }
  })
  .post("/payments/:id/contacts", async ({ headers, params, body, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user || !can(user, ["financeiro", "gestor"])) return forbidden(set, user);
    try {
      const input = parseBody(z.object({ channel: z.string().min(2), notes: z.string().min(2) }), body);
      const [created] = await db.insert(collectionContacts).values({ paymentId: params.id, ...input, createdBy: user.id }).returning();
      set.status = 201;
      return created;
    } catch (error) { return apiError(error, set); }
  })
  .get("/production", async ({ headers, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user || !can(user, ["producao", "gestor"])) return forbidden(set, user);
    return db.select({ id: productionJobs.id, status: productionJobs.status, startedAt: productionJobs.startedAt, completedAt: productionJobs.completedAt, notes: productionJobs.notes, assigneeId: productionJobs.assigneeId, assigneeName: users.name, orderId: orders.id, orderNumber: orders.number, orderStatus: orders.status, priority: orders.priority, promisedDate: orders.promisedDate, customerName: customers.name })
      .from(productionJobs).innerJoin(orders, eq(productionJobs.orderId, orders.id)).innerJoin(customers, eq(orders.customerId, customers.id)).leftJoin(users, eq(productionJobs.assigneeId, users.id))
      .where(inArray(orders.status, ["pagamento_confirmado", "em_producao", "preparacao", "pronto"])).orderBy(asc(orders.promisedDate));
  })
  .patch("/production/:id", async ({ headers, params, body, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user || !can(user, ["producao", "gestor"])) return forbidden(set, user);
    try {
      const input = parseBody(z.object({ status: z.enum(["aguardando", "em_andamento", "pausado", "concluido"]), assigneeId: z.string().uuid().optional().nullable(), notes: optionalText }), body);
      const [updated] = await db.update(productionJobs).set({ ...input, assigneeId: input.assigneeId ?? user.id, startedAt: input.status === "em_andamento" ? new Date() : undefined, completedAt: input.status === "concluido" ? new Date() : null, updatedAt: new Date() }).where(eq(productionJobs.id, params.id)).returning();
      return updated;
    } catch (error) { return apiError(error, set); }
  })
  .get("/shipping", async ({ headers, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user || !can(user, ["expedicao", "gestor"])) return forbidden(set, user);
    return db.select(shipmentSelection)
      .from(shipments).innerJoin(orders, eq(shipments.orderId, orders.id)).innerJoin(customers, eq(orders.customerId, customers.id))
      .where(inArray(orders.status, ["pronto", "expedicao"])).orderBy(asc(orders.promisedDate));
  })
  .get("/shipping/delivered", async ({ headers, query, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user || !can(user, ["expedicao", "gestor"])) return forbidden(set, user);
    try {
      const input = parseBody(deliveredQuerySchema, query);
      const filters = [eq(orders.status, "entregue" as OrderStatus)];
      if (input.search) filters.push(or(ilike(orders.number, `%${input.search}%`), ilike(customers.name, `%${input.search}%`))!);
      if (input.type) filters.push(eq(shipments.type, input.type));
      // Datas do filtro são dias no fuso da operação, não em UTC.
      if (input.from) filters.push(sql`(${shipments.deliveredAt} at time zone ${config.timeZone})::date >= ${input.from}::date`);
      if (input.to) filters.push(sql`(${shipments.deliveredAt} at time zone ${config.timeZone})::date <= ${input.to}::date`);
      const where = and(...filters);
      const direction = input.dir === "asc" ? asc : desc;
      const sortColumn = deliveredSortColumns[input.sort];
      const [rows, [count]] = await Promise.all([
        db.select(shipmentSelection)
          .from(shipments).innerJoin(orders, eq(shipments.orderId, orders.id)).innerJoin(customers, eq(orders.customerId, customers.id))
          .where(where)
          .orderBy(input.dir === "asc" ? sql`${sortColumn} asc nulls first` : sql`${sortColumn} desc nulls last`, direction(orders.number))
          .limit(input.pageSize).offset((input.page - 1) * input.pageSize),
        db.select({ total: sql<number>`count(*)::int` })
          .from(shipments).innerJoin(orders, eq(shipments.orderId, orders.id)).innerJoin(customers, eq(orders.customerId, customers.id))
          .where(where),
      ]);
      return { rows, total: count?.total ?? 0, page: input.page, pageSize: input.pageSize };
    } catch (error) { return apiError(error, set); }
  })
  .patch("/shipping/:id", async ({ headers, params, body, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user || !can(user, ["expedicao", "gestor"])) return forbidden(set, user);
    try {
      const input = parseBody(z.object({
        address: z.object({ street: z.string().optional(), number: z.string().optional(), complement: z.string().optional(), district: z.string().optional(), city: z.string().optional(), state: z.string().optional(), zipCode: z.string().optional() }).optional(),
        carrier: optionalText, driver: optionalText, trackingCode: optionalText, deliveryWindow: optionalText, failedReason: optionalText, notes: optionalText,
      }), body);
      const [updated] = await db.update(shipments).set({ ...input, updatedAt: new Date() }).where(eq(shipments.id, params.id)).returning();
      return updated;
    } catch (error) { return apiError(error, set); }
  })
  .post("/orders/:id/occurrences", async ({ headers, params, body, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) return forbidden(set);
    try {
      const input = parseBody(z.object({ type: z.string().min(2), description: z.string().min(3) }), body);
      const [created] = await db.insert(occurrences).values({ orderId: params.id, ...input, createdBy: user.id }).returning();
      set.status = 201;
      return created;
    } catch (error) { return apiError(error, set); }
  })
  .patch("/occurrences/:id/resolve", async ({ headers, params, body, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) return forbidden(set);
    try {
      const input = parseBody(z.object({ solution: z.string().min(3) }), body);
      const [updated] = await db.update(occurrences).set({ status: "resolvida", solution: input.solution, resolvedAt: new Date(), resolvedBy: user.id, updatedAt: new Date() }).where(eq(occurrences.id, params.id)).returning();
      return updated;
    } catch (error) { return apiError(error, set); }
  })
  .get("/users", async ({ headers, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user || !can(user, ["gestor"])) return forbidden(set, user);
    return db.select(userSelection).from(users).orderBy(asc(users.name));
  })
  .post("/users", async ({ headers, body, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user || !can(user, ["gestor"])) return forbidden(set, user);
    try {
      const input = parseBody(z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(8), role: roleSchema, department: optionalText }), body);
      const [created] = await db.insert(users).values({ ...input, email: input.email.toLowerCase(), passwordHash: await Bun.password.hash(input.password) }).returning({ id: users.id, name: users.name, email: users.email, role: users.role });
      set.status = 201;
      return created;
    } catch (error) { return apiError(error, set); }
  })
  .put("/users/:id", async ({ headers, params, body, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user || !can(user, ["gestor"])) return forbidden(set, user);
    try {
      const input = parseBody(z.object({
        name: z.string().min(2),
        email: z.string().email(),
        password: z.string().min(8).optional().or(z.literal("")),
        role: roleSchema,
        department: optionalText,
        active: z.boolean().optional(),
      }), body);
      if (params.id === user.id && (input.active === false || input.role !== user.role)) {
        set.status = 422;
        return { message: "Você não pode inativar nem alterar o perfil do seu próprio usuário." };
      }
      const { password, ...fields } = input;
      const [updated] = await db.update(users).set({
        ...fields,
        email: input.email.toLowerCase(),
        ...(password ? { passwordHash: await Bun.password.hash(password) } : {}),
        updatedAt: new Date(),
      }).where(eq(users.id, params.id)).returning(userSelection);
      if (!updated) { set.status = 404; return { message: "Usuário não encontrado." }; }
      return updated;
    } catch (error) { return apiError(error, set); }
  })
  .delete("/users/:id", async ({ headers, params, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user || !can(user, ["gestor"])) return forbidden(set, user);
    if (params.id === user.id) { set.status = 422; return { message: "Você não pode excluir o seu próprio usuário." }; }
    try {
      const [deleted] = await db.delete(users).where(eq(users.id, params.id)).returning({ id: users.id });
      if (!deleted) { set.status = 404; return { message: "Usuário não encontrado." }; }
      return { success: true };
    } catch (error) {
      if (isForeignKeyViolation(error)) { set.status = 409; return { message: "Este usuário possui histórico de operações e não pode ser excluído. Edite o cadastro e marque-o como inativo." }; }
      return apiError(error, set);
    }
  });
