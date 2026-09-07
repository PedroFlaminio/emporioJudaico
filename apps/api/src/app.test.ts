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
  });
});

afterAll(async () => {
  if (orderId) await db.delete(orders).where(eq(orders.id, orderId));
  if (customerId) await db.delete(customers).where(eq(customers.id, customerId));
  for (const sessionToken of sessionTokens) await callAs(sessionToken, "/api/auth/logout", { method: "POST" });
  await client.end();
});
