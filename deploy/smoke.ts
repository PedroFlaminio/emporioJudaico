const base = "https://pedro.flaminio.com.br/emporioJudaico";
const credentials = { email: "admin@emporio.local", password: "admin123" };

async function check(path: string, expected: number, init?: RequestInit) {
  const response = await fetch(`${base}${path}`, init);
  if (response.status !== expected) throw new Error(`${path}: HTTP ${response.status}, expected ${expected}`);
  console.log(`OK ${response.status} ${path}`);
  return response;
}

const index = await (await check("/", 200)).text();
if (!index.includes('/emporioJudaico/assets/')) throw new Error("Incorrect asset base path");
for (const path of ["/login", "/pedidos", "/financeiro", "/cadastros"]) {
  const html = await (await check(path, 200)).text();
  if (html !== index) throw new Error(`SPA fallback failed: ${path}`);
}
for (const match of index.matchAll(/(?:src|href)="(\/emporioJudaico\/assets\/[^\"]+)"/g)) {
  const response = await fetch(`https://pedro.flaminio.com.br${match[1]}`);
  if (!response.ok || response.headers.get("content-type")?.includes("text/html")) throw new Error(`Asset failed: ${match[1]}`);
  console.log(`OK asset ${match[1]}`);
}
await check("/assets/missing.js", 404);
await check("/api/health", 200);
await check("/api/auth/me", 401);
const login = await check("/api/auth/login", 200, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(credentials),
});
const { token } = await login.json() as { token: string };
const headers = { Authorization: `Bearer ${token}` };
try {
  for (const path of ["auth/me", "dashboard", "customers", "categories", "products", "orders", "payments", "production", "shipping", "users"]) {
    await check(`/api/${path}`, 200, { headers });
  }
  await check("/api/auth/login", 401, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: credentials.email, password: "senha-incorreta" }),
  });
} finally {
  await check("/api/auth/logout", 200, { method: "POST", headers });
}
await check("/api/auth/me", 401, { headers });
console.log("Publicação validada por HTTPS, incluindo login, consultas e logout.");
