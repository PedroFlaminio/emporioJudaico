import {
  boolean,
  date,
  decimal,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", [
  "atendimento",
  "producao",
  "expedicao",
  "financeiro",
  "gestor",
  "administrador",
]);
export const orderStatus = pgEnum("order_status", [
  "recebido",
  "pagamento_pendente",
  "pagamento_confirmado",
  "em_producao",
  "preparacao",
  "pronto",
  "expedicao",
  "entregue",
  "cancelado",
]);
export const orderPriority = pgEnum("order_priority", ["baixa", "normal", "alta", "urgente"]);
export const deliveryType = pgEnum("delivery_type", ["entrega", "retirada", "transportadora"]);
export const paymentStatus = pgEnum("payment_status", ["pendente", "parcial", "pago", "vencido", "cancelado", "estornado"]);
export const productionStatus = pgEnum("production_status", ["aguardando", "em_andamento", "pausado", "concluido"]);
export const occurrenceStatus = pgEnum("occurrence_status", ["aberta", "resolvida"]);
export const itemCheckStatus = pgEnum("item_check_status", ["pendente", "separado", "conferido", "faltante", "substituido", "avariado"]);

const auditColumns = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  role: userRole("role").notNull().default("atendimento"),
  department: varchar("department", { length: 100 }),
  active: boolean("active").default(true).notNull(),
  ...auditColumns,
}, (table) => [uniqueIndex("users_email_idx").on(table.email)]);

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 64 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("sessions_token_idx").on(table.tokenHash), index("sessions_user_idx").on(table.userId)]);

export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  document: varchar("document", { length: 30 }),
  phone: varchar("phone", { length: 30 }),
  email: varchar("email", { length: 255 }),
  address: jsonb("address").$type<{ street?: string; number?: string; complement?: string; district?: string; city?: string; state?: string; zipCode?: string }>().default({}),
  notes: text("notes"),
  active: boolean("active").default(true).notNull(),
  ...auditColumns,
}, (table) => [index("customers_name_idx").on(table.name)]);

export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  active: boolean("active").default(true).notNull(),
  ...auditColumns,
}, (table) => [uniqueIndex("categories_name_idx").on(table.name)]);

export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
  sku: varchar("sku", { length: 60 }).notNull(),
  name: varchar("name", { length: 180 }).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 12, scale: 2 }).notNull(),
  productionMinutes: integer("production_minutes").default(0).notNull(),
  active: boolean("active").default(true).notNull(),
  ...auditColumns,
}, (table) => [uniqueIndex("products_sku_idx").on(table.sku), index("products_name_idx").on(table.name)]);

export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  number: varchar("number", { length: 30 }).notNull(),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  status: orderStatus("status").default("recebido").notNull(),
  priority: orderPriority("priority").default("normal").notNull(),
  deliveryType: deliveryType("delivery_type").default("retirada").notNull(),
  orderDate: date("order_date").defaultNow().notNull(),
  promisedDate: date("promised_date"),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 12, scale: 2 }).default("0").notNull(),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  notes: text("notes"),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  ...auditColumns,
}, (table) => [uniqueIndex("orders_number_idx").on(table.number), index("orders_status_idx").on(table.status), index("orders_promised_idx").on(table.promisedDate)]);

export const orderItems = pgTable("order_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => products.id),
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull(),
  unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  notes: text("notes"),
  checkStatus: itemCheckStatus("check_status").default("pendente").notNull(),
  checkedBy: uuid("checked_by").references(() => users.id),
  checkedAt: timestamp("checked_at", { withTimezone: true }),
}, (table) => [index("order_items_order_idx").on(table.orderId)]);

export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  receivedAmount: decimal("received_amount", { precision: 12, scale: 2 }).default("0").notNull(),
  method: varchar("method", { length: 60 }).notNull(),
  status: paymentStatus("status").default("pendente").notNull(),
  dueDate: date("due_date"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  proofReference: text("proof_reference"),
  notes: text("notes"),
  ...auditColumns,
}, (table) => [index("payments_order_idx").on(table.orderId), index("payments_status_idx").on(table.status)]);

export const collectionContacts = pgTable("collection_contacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  paymentId: uuid("payment_id").notNull().references(() => payments.id, { onDelete: "cascade" }),
  channel: varchar("channel", { length: 40 }).notNull(),
  notes: text("notes").notNull(),
  contactedAt: timestamp("contacted_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by").notNull().references(() => users.id),
});

export const productionJobs = pgTable("production_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  assigneeId: uuid("assignee_id").references(() => users.id),
  status: productionStatus("status").default("aguardando").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  notes: text("notes"),
  ...auditColumns,
}, (table) => [uniqueIndex("production_order_idx").on(table.orderId)]);

export const shipments = pgTable("shipments", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  type: deliveryType("type").notNull(),
  address: jsonb("address").$type<Record<string, string>>().default({}),
  deliveryWindow: varchar("delivery_window", { length: 100 }),
  carrier: varchar("carrier", { length: 160 }),
  driver: varchar("driver", { length: 160 }),
  trackingCode: varchar("tracking_code", { length: 120 }),
  departedAt: timestamp("departed_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  failedReason: text("failed_reason"),
  notes: text("notes"),
  ...auditColumns,
}, (table) => [uniqueIndex("shipments_order_idx").on(table.orderId)]);

export const occurrences = pgTable("occurrences", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 80 }).notNull(),
  description: text("description").notNull(),
  status: occurrenceStatus("status").default("aberta").notNull(),
  solution: text("solution"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  resolvedBy: uuid("resolved_by").references(() => users.id),
  ...auditColumns,
}, (table) => [index("occurrences_order_idx").on(table.orderId), index("occurrences_status_idx").on(table.status)]);

export const orderHistory = pgTable("order_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  fromStatus: orderStatus("from_status"),
  toStatus: orderStatus("to_status").notNull(),
  notes: text("notes"),
  changedBy: uuid("changed_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("order_history_order_idx").on(table.orderId), index("order_history_created_idx").on(table.createdAt)]);

export type UserRole = (typeof userRole.enumValues)[number];
export type OrderStatus = (typeof orderStatus.enumValues)[number];
