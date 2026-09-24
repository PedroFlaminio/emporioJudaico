import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { app } from "./app";
import { db, client } from "./db";
import { customers, orders } from "./db/schema";

let token = "";
let customerId = "";
let orderId = "";
let paymentId = "";
let shippingId = "";
const sessionTokens: string[] = [];

async function call(path: string, init: RequestInit = {}) {
  return app.handle(new Request(`http://localhost${path}`, {
    ...init,
    headers: { ...(init.body ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), ...init.headers },
  }));
}

async function login(email: string) {
  const response = await call("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password: "admin123" }), headers: { authorization: "" } });
  expect(response.status).toBe(200);
  const userToken = ((await response.json()) as { token: string }).token;
  sessionTokens.push(userToken);
  return userToken;
}

function callAs(userToken: string, path: string, init: RequestInit = {}) {
  return call(path, { ...init, headers: { ...init.headers, authorization: `Bearer ${userToken}` } });
}

describe("fluxo operacional da API", () => {
  beforeAll(async () => {
    const response = await call("/api/auth/login", { method: "POST", body: JSON.stringify({ email: "admin@emporio.local", password: "admin123" }) });
    const body = await response.json() as { token: string };
    token = body.token;
    sessionTokens.push(token);
  });

  it("responde ao health check", async () => {
    const response = await call("/api/health");
    expect(response.status).toBe(200);
    expect((await response.json() as { status: string }).status).toBe("ok");
  });

  it("autentica e entrega o painel", async () => {
    const response = await call("/api/dashboard");
    expect(response.status).toBe(200);
    const body = await response.json() as { byStatus: unknown[]; recentOrders: unknown[] };
    expect(body.byStatus.length).toBeGreaterThan(0);
    expect(body.recentOrders.length).toBeGreaterThan(0);
  });

  it("cria cliente, pedido e registra a transição", async () => {
    const customerResponse = await call("/api/customers", { method: "POST", body: JSON.stringify({ name: "Cliente do teste automatizado", phone: "(11) 90000-0000" }) });
    expect(customerResponse.status).toBe(201);
    customerId = ((await customerResponse.json()) as { id: string }).id;

    const productsResponse = await call("/api/products");
    const product = ((await productsResponse.json()) as Array<{ id: string; price: string }>)[0]!;
    const orderResponse = await call("/api/orders", { method: "POST", body: JSON.stringify({
      customerId, promisedDate: new Date().toISOString().slice(0, 10), priority: "normal", deliveryType: "retirada",
      items: [{ productId: product.id, quantity: 1, unitPrice: Number(product.price) }],
      payment: { method: "pix", status: "parcial", receivedAmount: 10, proofReference: "PIX-TESTE" },
      shippingAddress: { street: "Rua de Teste", number: "123", city: "Jacareí", state: "SP", zipCode: "12345-000" },
      deliveryWindow: "14h às 18h", driver: "Entregador inicial",
    }) });
    expect(orderResponse.status).toBe(201);
    orderId = ((await orderResponse.json()) as { id: string }).id;

    const paymentTransition = await call(`/api/orders/${orderId}/transition`, { method: "POST", body: JSON.stringify({ status: "pagamento_confirmado", notes: "Liberação administrativa para teste" }) });
    expect(paymentTransition.status).toBe(200);
    const transitionResponse = await call(`/api/orders/${orderId}/transition`, { method: "POST", body: JSON.stringify({ status: "em_producao", notes: "Teste automatizado" }) });
    expect(transitionResponse.status).toBe(200);
    const detailResponse = await call(`/api/orders/${orderId}`);
    const detail = await detailResponse.json() as { status: string; history: unknown[]; payments: Array<{ id: string; receivedAmount: string; proofReference: string }>; shipping: { id: string; address: { city: string }; deliveryWindow: string } };
    expect(detail.status).toBe("em_producao");
    expect(detail.history.length).toBe(3);
    expect(Number(detail.payments[0]!.receivedAmount)).toBe(10);
    expect(detail.payments[0]!.proofReference).toBe("PIX-TESTE");
    expect(detail.shipping.address.city).toBe("Jacareí");
    expect(detail.shipping.deliveryWindow).toBe("14h às 18h");
    const invalidTransition = await call(`/api/orders/${orderId}/transition`, { method: "POST", body: JSON.stringify({ status: "pagamento_confirmado" }) });
    expect(invalidTransition.status).toBe(409);
    expect((await invalidTransition.json() as { message: string }).message).toBe("O pedido está em Em produção e não pode ir diretamente para Pagamento confirmado. A próxima etapa disponível é Preparação.");
    paymentId = detail.payments[0]!.id;
    shippingId = detail.shipping.id;
  });

  it("restringe transições conforme o perfil responsável", async () => {
    const atendimentoToken = await login("atendimento@emporio.local");
    const denied = await callAs(atendimentoToken, `/api/orders/${orderId}/transition`, { method: "POST", body: JSON.stringify({ status: "preparacao" }) });
    expect(denied.status).toBe(403);

    const producaoToken = await login("producao@emporio.local");
    const allowed = await callAs(producaoToken, `/api/orders/${orderId}/transition`, { method: "POST", body: JSON.stringify({ status: "preparacao" }) });
    expect(allowed.status).toBe(200);
  });

  it("permite alterar o pedido em qualquer etapa", async () => {
    const detail = await (await call(`/api/orders/${orderId}`)).json() as { status: string; canEdit: boolean; items: Array<{ id: string; productId: string; unitPrice: string; checkStatus: string }> };
    expect(detail.status).toBe("preparacao");
    expect(detail.canEdit).toBe(true);
    const item = detail.items[0]!;
    expect((await call(`/api/order-items/${item.id}/check`, { method: "PATCH", body: JSON.stringify({ status: "conferido" }) })).status).toBe(200);

    const producaoToken = await login("producao@emporio.local");
    const denied = await callAs(producaoToken, `/api/orders/${orderId}`, { method: "PUT", body: JSON.stringify({ customerId, deliveryType: "retirada", items: [{ id: item.id, productId: item.productId, quantity: 1, unitPrice: 1 }] }) });
    expect(denied.status).toBe(403);

    const unitPrice = Number(item.unitPrice) + 50;
    const response = await call(`/api/orders/${orderId}`, { method: "PUT", body: JSON.stringify({
      customerId, priority: "urgente", deliveryType: "entrega", discount: 5, notes: "Cliente pediu mais uma unidade",
      items: [{ id: item.id, productId: item.productId, quantity: 2, unitPrice }],
      shippingAddress: { street: "Rua de Teste", number: "123", city: "Jacareí", state: "SP" }, deliveryWindow: "8h às 12h",
    }) });
    expect(response.status).toBe(200);
    const updated = await (await call(`/api/orders/${orderId}`)).json() as { priority: string; total: string; items: Array<{ checkStatus: string }>; payments: Array<{ amount: string; status: string }>; shipping: { type: string; deliveryWindow: string }; history: Array<{ notes: string }> };
    const expectedTotal = 2 * unitPrice - 5;
    expect(updated.priority).toBe("urgente");
    expect(Number(updated.total)).toBeCloseTo(expectedTotal, 2);
    expect(updated.items[0]!.checkStatus).toBe("pendente");
    expect(Number(updated.payments[0]!.amount)).toBeCloseTo(expectedTotal, 2);
    expect(updated.payments[0]!.status).toBe("parcial");
    expect(updated.shipping).toMatchObject({ type: "entrega", deliveryWindow: "8h às 12h" });
    expect(updated.history[0]!.notes).toStartWith("Pedido alterado");
  });

  it("atualiza pagamento parcial e dados de expedição", async () => {
    const financeiroToken = await login("financeiro@emporio.local");
    const paymentResponse = await callAs(financeiroToken, `/api/payments/${paymentId}`, { method: "PATCH", body: JSON.stringify({ status: "parcial", receivedAmount: 20, proofReference: "PIX-ATUALIZADO", notes: "Segunda parcela recebida" }) });
    expect(paymentResponse.status).toBe(200);
    const payment = await paymentResponse.json() as { receivedAmount: string; proofReference: string };
    expect(Number(payment.receivedAmount)).toBe(20);
    expect(payment.proofReference).toBe("PIX-ATUALIZADO");

    const producaoToken = await login("producao@emporio.local");
    expect((await callAs(producaoToken, `/api/orders/${orderId}/transition`, { method: "POST", body: JSON.stringify({ status: "pronto" }) })).status).toBe(200);
    const expedicaoToken = await login("expedicao@emporio.local");
    const shippingResponse = await callAs(expedicaoToken, `/api/shipping/${shippingId}`, { method: "PATCH", body: JSON.stringify({ driver: "Novo entregador", trackingCode: "RASTREIO-123", failedReason: "Destinatário ausente", address: { street: "Rua Atualizada", number: "456", city: "Jacareí", state: "SP" } }) });
    expect(shippingResponse.status).toBe(200);
    expect((await callAs(expedicaoToken, `/api/orders/${orderId}/transition`, { method: "POST", body: JSON.stringify({ status: "expedicao" }) })).status).toBe(200);

    const detail = await (await call(`/api/orders/${orderId}`)).json() as { status: string; canEdit: boolean; items: Array<{ id: string; productId: string }>; shipping: { address: Record<string, string> } };
    expect(detail.canEdit).toBe(true);
    const editedInShipping = await call(`/api/orders/${orderId}`, { method: "PUT", body: JSON.stringify({ customerId, deliveryType: "entrega", shippingAddress: detail.shipping.address, items: [{ id: detail.items[0]!.id, productId: detail.items[0]!.productId, quantity: 1, unitPrice: 1 }] }) });
    expect(editedInShipping.status).toBe(200);
    expect((await (await call(`/api/orders/${orderId}`)).json() as { status: string }).status).toBe("expedicao");

    const beforeDelivery = Date.now();
    expect((await callAs(expedicaoToken, `/api/orders/${orderId}/transition`, { method: "POST", body: JSON.stringify({ status: "entregue" }) })).status).toBe(200);
    const board = await (await callAs(expedicaoToken, "/api/shipping")).json() as Array<{ orderId: string }>;
    expect(board.some((row) => row.orderId === orderId)).toBe(false);
    const delivered = await (await callAs(expedicaoToken, "/api/shipping/delivered?pageSize=5")).json() as { total: number; rows: Array<{ orderId: string; orderNumber: string; deliveredAt: string }> };
    expect(delivered.rows.length).toBeLessThanOrEqual(5);
    expect(delivered.rows[0]).toMatchObject({ orderId });
    expect(new Date(delivered.rows[0]!.deliveredAt).getTime()).toBeGreaterThanOrEqual(beforeDelivery - 1000);
    const sorted = delivered.rows.map((row) => new Date(row.deliveredAt).getTime());
    expect(sorted).toEqual([...sorted].sort((a, b) => b - a));
    const byNumber = (type: string) => `/api/shipping/delivered?search=${delivered.rows[0]!.orderNumber}&type=${type}`;
    expect((await (await callAs(expedicaoToken, byNumber("entrega"))).json() as { total: number }).total).toBe(1);
    expect((await (await callAs(expedicaoToken, byNumber("retirada"))).json() as { total: number }).total).toBe(0);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    expect((await (await callAs(expedicaoToken, `${byNumber("entrega")}&from=${today}&to=${today}&sort=customerName&dir=asc`)).json() as { total: number }).total).toBe(1);
    expect((await (await callAs(expedicaoToken, `${byNumber("entrega")}&to=2000-01-01`)).json() as { total: number }).total).toBe(0);
    expect((await callAs(expedicaoToken, "/api/shipping/delivered?sort=invalido")).status).toBe(422);
  });

  it("edita e exclui cadastros, bloqueando exclusão de registros vinculados", async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const json = async <T>(response: Response) => await response.json() as T;

    const category = await json<{ id: string }>(await call("/api/categories", { method: "POST", body: JSON.stringify({ name: `Categoria ${suffix}` }) }));
    const renamed = await call(`/api/categories/${category.id}`, { method: "PUT", body: JSON.stringify({ name: `Renomeada ${suffix}` }) });
    expect(renamed.status).toBe(200);
    expect((await json<{ name: string }>(renamed)).name).toBe(`Renomeada ${suffix}`);

    const product = await json<{ id: string }>(await call("/api/products", { method: "POST", body: JSON.stringify({ name: "Produto temporário", sku: `TMP-${suffix}`, price: 10, categoryId: category.id }) }));
    const productUpdate = await call(`/api/products/${product.id}`, { method: "PUT", body: JSON.stringify({ name: "Produto editado", sku: `TMP-${suffix}`, price: 12.5, categoryId: category.id, active: false }) });
    expect(productUpdate.status).toBe(200);
    expect((await call(`/api/categories/${category.id}`, { method: "DELETE" })).status).toBe(200);
    expect((await call(`/api/products/${product.id}`, { method: "DELETE" })).status).toBe(200);
    expect((await call(`/api/products/${product.id}`, { method: "DELETE" })).status).toBe(404);

    const linkedCustomer = await call(`/api/customers/${customerId}`, { method: "DELETE" });
    expect(linkedCustomer.status).toBe(409);

    const created = await json<{ id: string }>(await call("/api/users", { method: "POST", body: JSON.stringify({ name: "Usuário temporário", email: `tmp-${suffix}@emporio.local`, password: "senha-temporaria", role: "atendimento" }) }));
    const userUpdate = await call(`/api/users/${created.id}`, { method: "PUT", body: JSON.stringify({ name: "Usuário editado", email: `tmp-${suffix}@emporio.local`, password: "", role: "producao", active: false }) });
    expect(userUpdate.status).toBe(200);
    expect(await json<{ role: string; active: boolean }>(userUpdate)).toMatchObject({ role: "producao", active: false });
    expect((await call(`/api/users/${created.id}`, { method: "DELETE" })).status).toBe(200);

    const me = await json<{ id: string }>(await call("/api/auth/me"));
    expect((await call(`/api/users/${me.id}`, { method: "DELETE" })).status).toBe(422);
  });
});

afterAll(async () => {
  if (orderId) await db.delete(orders).where(eq(orders.id, orderId));
  if (customerId) await db.delete(customers).where(eq(customers.id, customerId));
  for (const sessionToken of sessionTokens) await callAs(sessionToken, "/api/auth/logout", { method: "POST" });
  await client.end();
});
