import { eq } from "drizzle-orm"
import { db, client } from "."
import {
  categories,
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
} from "./schema"

async function seed() {
  console.log("Inserindo dados iniciais...")
  const passwordHash = await Bun.password.hash("admin123")
  const team = [
    { name: "Administrador", email: "admin@emporio.local", role: "administrador" as const, department: "Gestão" },
    { name: "Sara Levy", email: "atendimento@emporio.local", role: "atendimento" as const, department: "Atendimento" },
    { name: "David Stein", email: "producao@emporio.local", role: "producao" as const, department: "Produção" },
    { name: "Rina Gold", email: "financeiro@emporio.local", role: "financeiro" as const, department: "Financeiro" },
    { name: "Moisés Klein", email: "expedicao@emporio.local", role: "expedicao" as const, department: "Expedição" },
  ]
  for (const member of team) {
    const insert = db
      .insert(users)
      .values({ ...member, passwordHash })
    if (process.env.RESET_DEMO_PASSWORDS === "true") {
      await insert.onConflictDoUpdate({ target: users.email, set: { passwordHash, active: true } })
    } else {
      await insert.onConflictDoNothing({ target: users.email })
    }
  }
  const [admin] = await db.select().from(users).where(eq(users.email, "admin@emporio.local")).limit(1)
  if (!admin) throw new Error("Usuário administrador não encontrado")

  const categoryNames = ["Panificação", "Doces", "Congelados", "Cestas"]
  for (const name of categoryNames)
    await db.insert(categories).values({ name }).onConflictDoNothing({ target: categories.name })
  const categoryRows = await db.select().from(categories)
  const categoryId = Object.fromEntries(categoryRows.map((category) => [category.name, category.id]))

  const catalog = [
    {
      sku: "CHA-001",
      name: "Chalá tradicional",
      categoryId: categoryId["Panificação"],
      price: "32.00",
      productionMinutes: 90,
    },
    {
      sku: "CHA-002",
      name: "Chalá integral",
      categoryId: categoryId["Panificação"],
      price: "36.00",
      productionMinutes: 95,
    },
    { sku: "BOLO-001", name: "Bolo de mel", categoryId: categoryId["Doces"], price: "58.00", productionMinutes: 75 },
    {
      sku: "RUG-001",
      name: "Rugelach de chocolate",
      categoryId: categoryId["Doces"],
      price: "42.00",
      productionMinutes: 60,
    },
    {
      sku: "KRE-001",
      name: "Kreplach congelado 500g",
      categoryId: categoryId["Congelados"],
      price: "49.90",
      productionMinutes: 45,
    },
    { sku: "CES-001", name: "Cesta Shabat", categoryId: categoryId["Cestas"], price: "189.00", productionMinutes: 30 },
  ]
  for (const product of catalog) await db.insert(products).values(product).onConflictDoNothing({ target: products.sku })

  const existingCustomers = await db.select().from(customers).limit(1)
  if (existingCustomers.length) {
    console.log("Dados operacionais já existem; mantendo registros atuais.")
    return
  }

  const customerRows = await db
    .insert(customers)
    .values([
      {
        name: "Família Abramovicz",
        phone: "(11) 98765-1001",
        email: "familia.abramovicz@example.com",
        document: "123.456.789-10",
        address: {
          street: "Rua Haddock Lobo",
          number: "820",
          district: "Cerqueira César",
          city: "São Paulo",
          state: "SP",
          zipCode: "01414-000",
        },
      },
      {
        name: "Beit Or Eventos",
        phone: "(11) 97654-2020",
        email: "eventos@beitor.example.com",
        document: "12.345.678/0001-90",
        address: {
          street: "Rua da Consolação",
          number: "2200",
          district: "Consolação",
          city: "São Paulo",
          state: "SP",
          zipCode: "01302-001",
        },
      },
      {
        name: "Rachel Mizrahi",
        phone: "(11) 96543-3030",
        email: "rachel.mizrahi@example.com",
        address: {
          street: "Alameda Lorena",
          number: "455",
          district: "Jardins",
          city: "São Paulo",
          state: "SP",
          zipCode: "01424-001",
        },
      },
      {
        name: "Sinagoga Ner Tamid",
        phone: "(11) 95432-4040",
        email: "secretaria@nertamid.example.com",
        document: "98.765.432/0001-10",
        address: {
          street: "Rua Piauí",
          number: "310",
          district: "Higienópolis",
          city: "São Paulo",
          state: "SP",
          zipCode: "01241-000",
        },
      },
    ])
    .returning()
  const productRows = await db.select().from(products)
  const productBySku = Object.fromEntries(productRows.map((product) => [product.sku, product]))
  const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10)
  const examples: Array<{
    customer: number
    status: OrderStatus
    priority: "normal" | "alta" | "urgente"
    promised: number
    delivery: "entrega" | "retirada" | "transportadora"
    sku: string
    quantity: number
    paid?: boolean
  }> = [
    {
      customer: 0,
      status: "pagamento_pendente",
      priority: "alta",
      promised: 1,
      delivery: "entrega",
      sku: "CES-001",
      quantity: 1,
    },
    {
      customer: 1,
      status: "em_producao",
      priority: "urgente",
      promised: 0,
      delivery: "transportadora",
      sku: "CHA-001",
      quantity: 20,
      paid: true,
    },
    {
      customer: 2,
      status: "preparacao",
      priority: "normal",
      promised: 2,
      delivery: "retirada",
      sku: "RUG-001",
      quantity: 3,
      paid: true,
    },
    {
      customer: 3,
      status: "pronto",
      priority: "alta",
      promised: 0,
      delivery: "entrega",
      sku: "BOLO-001",
      quantity: 8,
      paid: true,
    },
    {
      customer: 0,
      status: "expedicao",
      priority: "normal",
      promised: -1,
      delivery: "entrega",
      sku: "KRE-001",
      quantity: 4,
      paid: true,
    },
    {
      customer: 2,
      status: "entregue",
      priority: "normal",
      promised: -3,
      delivery: "retirada",
      sku: "CHA-002",
      quantity: 2,
      paid: true,
    },
  ]

  for (let index = 0; index < examples.length; index++) {
    const item = examples[index]!
    const product = productBySku[item.sku]!
    const total = Number(product.price) * item.quantity
    const [order] = await db
      .insert(orders)
      .values({
        number: `PED-2026-${String(index + 1).padStart(4, "0")}`,
        customerId: customerRows[item.customer]!.id,
        status: item.status,
        priority: item.priority,
        deliveryType: item.delivery,
        promisedDate: day(item.promised),
        subtotal: total.toFixed(2),
        discount: "0.00",
        total: total.toFixed(2),
        notes: index === 1 ? "Pedido para evento; manter embalagem identificada." : null,
        createdBy: admin.id,
      })
      .returning()
    if (!order) continue
    await db
      .insert(orderItems)
      .values({
        orderId: order.id,
        productId: product.id,
        quantity: item.quantity.toFixed(3),
        unitPrice: product.price,
        total: total.toFixed(2),
        checkStatus: ["preparacao", "pronto", "expedicao", "entregue"].includes(item.status) ? "separado" : "pendente",
      })
    await db
      .insert(payments)
      .values({
        orderId: order.id,
        amount: total.toFixed(2),
        receivedAmount: item.paid ? total.toFixed(2) : "0.00",
        method: index % 2 ? "pix" : "boleto",
        status: item.paid ? "pago" : "pendente",
        dueDate: day(item.paid ? -5 : -1),
        paidAt: item.paid ? new Date(Date.now() - 2 * 86_400_000) : null,
      })
    await db
      .insert(productionJobs)
      .values({
        orderId: order.id,
        status:
          item.status === "em_producao"
            ? "em_andamento"
            : ["preparacao", "pronto", "expedicao", "entregue"].includes(item.status)
              ? "concluido"
              : "aguardando",
        assigneeId:
          item.status === "em_producao"
            ? (await db.select().from(users).where(eq(users.email, "producao@emporio.local")))[0]?.id
            : null,
        startedAt: ["em_producao", "preparacao", "pronto", "expedicao", "entregue"].includes(item.status)
          ? new Date()
          : null,
        completedAt: ["preparacao", "pronto", "expedicao", "entregue"].includes(item.status) ? new Date() : null,
      })
    await db
      .insert(shipments)
      .values({
        orderId: order.id,
        type: item.delivery,
        address: customerRows[item.customer]!.address ?? {},
        departedAt: ["expedicao", "entregue"].includes(item.status) ? new Date() : null,
        deliveredAt: item.status === "entregue" ? new Date() : null,
        driver: item.delivery === "entrega" ? "Moisés Klein" : null,
      })
    await db
      .insert(orderHistory)
      .values({ orderId: order.id, toStatus: item.status, changedBy: admin.id, notes: "Carga inicial de demonstração" })
    if (index === 1)
      await db
        .insert(occurrences)
        .values({
          orderId: order.id,
          type: "falta_insumo",
          description: "Verificar reposição de farinha antes do segundo lote.",
          createdBy: admin.id,
        })
  }
  console.log("Dados iniciais inseridos. Acesso: admin@emporio.local / admin123")
}

try {
  await seed()
} finally {
  await client.end()
}
