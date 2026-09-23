import { useEffect, useState, type FormEvent } from "react";
import { Boxes, Pencil, Plus, Search, Tags, Trash2, UserCog, UsersRound } from "lucide-react";
import { EmptyState, ErrorBanner, Field, Loading, Modal, PageHeader } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { api, money } from "../lib/api";
import { roleLabel, type Category, type Customer, type Product, type User } from "../types";

type Tab = "clientes" | "produtos" | "categorias" | "usuarios";
type RegistrationRecord = Customer | Product | Category | User;
const paths: Record<Tab, string> = { clientes: "/customers", produtos: "/products", categorias: "/categories", usuarios: "/users" };
const singular: Record<Tab, string> = { clientes: "cliente", produtos: "produto", categorias: "categoria", usuarios: "usuário" };

export function RegistrationsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("clientes"); const [customers, setCustomers] = useState<Customer[]>([]); const [products, setProducts] = useState<Product[]>([]); const [categories, setCategories] = useState<Category[]>([]); const [users, setUsers] = useState<User[]>([]); const [loading, setLoading] = useState(true); const [open, setOpen] = useState(false); const [editing, setEditing] = useState<RegistrationRecord | null>(null); const [removing, setRemoving] = useState<RegistrationRecord | null>(null); const [search, setSearch] = useState(""); const [error, setError] = useState("");
  const managesUsers = user?.role === "gestor" || user?.role === "administrador";
  const canManage = tab === "categorias" || tab === "usuarios" ? managesUsers : user?.role === "atendimento" || managesUsers;
  const availableTabs: Tab[] = managesUsers ? ["clientes", "produtos", "categorias", "usuarios"] : ["clientes", "produtos", "categorias"];
  async function load() { setLoading(true); try { const [c, p, cat, u] = await Promise.all([api<Customer[]>("/customers"), api<Product[]>("/products"), api<Category[]>("/categories"), managesUsers ? api<User[]>("/users") : Promise.resolve([])]); setCustomers(c); setProducts(p); setCategories(cat); setUsers(u); } catch (e) { setError(e instanceof Error ? e.message : "Falha ao carregar cadastros."); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, []);
  const counts = { clientes: customers.length, produtos: products.length, categorias: categories.length, usuarios: users.length };
  const actions = canManage ? { onEdit: (record: RegistrationRecord) => { setEditing(record); setOpen(true); }, onRemove: setRemoving, currentUserId: user?.id } : undefined;
  return <><PageHeader eyebrow="Base operacional" title="Cadastros" description="Mantenha clientes, catálogo e equipe sempre atualizados." actions={canManage && <button className="button primary" onClick={() => { setEditing(null); setOpen(true); }}><Plus size={18} /> Adicionar</button>} />{error && <ErrorBanner message={error} />}
    <div className="registration-tabs">{availableTabs.map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => { setTab(item); setSearch(""); }}><span>{item === "clientes" ? <UsersRound /> : item === "produtos" ? <Boxes /> : item === "categorias" ? <Tags /> : <UserCog />}{item}</span><strong>{counts[item]}</strong></button>)}</div>
    <div className="toolbar"><div className="search-box"><Search size={17} /><input placeholder={`Buscar ${tab}...`} value={search} onChange={(e) => setSearch(e.target.value)} /></div></div>
    {loading ? <Loading /> : <RegistrationContent tab={tab} search={search} customers={customers} products={products} categories={categories} users={users} actions={actions} />}
    <RegistrationModal open={open} tab={tab} record={editing} categories={categories} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); setEditing(null); void load(); }} />
    <DeleteModal tab={tab} record={removing} onClose={() => setRemoving(null)} onDeleted={() => { setRemoving(null); void load(); }} />
  </>;
}

type RowActions = { onEdit: (record: RegistrationRecord) => void; onRemove: (record: RegistrationRecord) => void; currentUserId?: string };

function RowButtons({ record, actions, canRemove = true }: { record: RegistrationRecord; actions?: RowActions; canRemove?: boolean }) {
  if (!actions) return null;
  return <div className="row-actions"><button className="icon-button" onClick={() => actions.onEdit(record)} aria-label={`Editar ${record.name}`} title="Editar"><Pencil size={15} /></button>{canRemove && <button className="icon-button danger" onClick={() => actions.onRemove(record)} aria-label={`Excluir ${record.name}`} title="Excluir"><Trash2 size={15} /></button>}</div>;
}

function RegistrationContent({ tab, search, customers, products, categories, users, actions }: { tab: Tab; search: string; customers: Customer[]; products: Product[]; categories: Category[]; users: User[]; actions?: RowActions }) {
  const matches = (value: string) => value.toLowerCase().includes(search.toLowerCase());
  const tableClass = `cards-table${actions ? " with-actions" : ""}`;
  if (tab === "clientes") { const rows = customers.filter((c) => matches(`${c.name} ${c.document ?? ""} ${c.phone ?? ""}`)); return rows.length ? <div className={tableClass}>{rows.map((c) => <article key={c.id}><div className="entity-avatar">{c.name.slice(0, 2).toUpperCase()}</div><div><strong>{c.name}</strong><span>{c.document ?? "Documento não informado"}</span></div><span>{c.phone ?? "—"}</span><span>{c.email ?? "—"}</span><i className={c.active ? "active" : "inactive"}>{c.active ? "Ativo" : "Inativo"}</i><RowButtons record={c} actions={actions} /></article>)}</div> : <EmptyState icon={<UsersRound />} title="Nenhum cliente" description="Adicione o primeiro cliente." />; }
  if (tab === "produtos") { const rows = products.filter((p) => matches(`${p.name} ${p.sku}`)); return rows.length ? <div className={tableClass}>{rows.map((p) => <article key={p.id}><div className="entity-avatar product"><Boxes /></div><div><strong>{p.name}</strong><span>{p.sku}</span></div><span>{p.categoryName ?? "Sem categoria"}</span><strong>{money(p.price)}</strong><i className={p.active ? "active" : "inactive"}>{p.active ? "Ativo" : "Inativo"}</i><RowButtons record={p} actions={actions} /></article>)}</div> : <EmptyState icon={<Boxes />} title="Nenhum produto" description="Cadastre o catálogo inicial." />; }
  if (tab === "categorias") { const rows = categories.filter((c) => matches(c.name)); return <div className="category-grid">{rows.map((c) => <article key={c.id}><div className="category-card-head"><Tags /><RowButtons record={c} actions={actions} /></div><strong>{c.name}</strong><span>{products.filter((p) => p.categoryId === c.id).length} produtos{c.active ? "" : " · Inativa"}</span></article>)}</div>; }
  const rows = users.filter((u) => matches(`${u.name} ${u.email}`)); return rows.length ? <div className={tableClass}>{rows.map((u) => <article key={u.id}><div className="entity-avatar user">{u.name.slice(0, 2).toUpperCase()}</div><div><strong>{u.name}</strong><span>{u.email}</span></div><span>{u.department ?? "—"}</span><span>{roleLabel[u.role]}</span><i className={u.active !== false ? "active" : "inactive"}>{u.active !== false ? "Ativo" : "Inativo"}</i><RowButtons record={u} actions={actions} canRemove={u.id !== actions?.currentUserId} /></article>)}</div> : <EmptyState icon={<UserCog />} title="Nenhum usuário" description="Cadastre a equipe." />;
}

function initialData(tab: Tab, record: RegistrationRecord | null): Record<string, string> {
  if (!record) return {};
  const text = (value: string | number | null | undefined) => value == null ? "" : String(value);
  if (tab === "clientes") { const c = record as Customer; return { name: c.name, document: text(c.document), phone: text(c.phone), email: text(c.email), notes: text(c.notes), ...c.address }; }
  if (tab === "produtos") { const p = record as Product; return { sku: p.sku, name: p.name, categoryId: text(p.categoryId), price: text(Number(p.price)), productionMinutes: text(p.productionMinutes) }; }
  if (tab === "categorias") return { name: record.name };
  const u = record as User; return { name: u.name, email: u.email, role: u.role, department: text(u.department) };
}

function RegistrationModal({ open, tab, record, categories, onClose, onSaved }: { open: boolean; tab: Tab; record: RegistrationRecord | null; categories: Category[]; onClose: () => void; onSaved: () => void }) {
  const [data, setData] = useState<Record<string, string>>({}); const [active, setActive] = useState(true); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setData(initialData(tab, record)); setActive(record?.active !== false); setError(""); } }, [open, tab, record]);
  const set = (key: string) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setData((value) => ({ ...value, [key]: event.target.value }));
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setError(""); try { const status = record ? { active } : {}; const body = tab === "produtos" ? { sku: data.sku, name: data.name, price: Number(data.price), productionMinutes: Number(data.productionMinutes ?? 0), categoryId: data.categoryId || null, ...status } : tab === "clientes" ? { name: data.name, document: data.document, phone: data.phone, email: data.email, notes: data.notes, address: { street: data.street, number: data.number, complement: data.complement, district: data.district, city: data.city, state: data.state, zipCode: data.zipCode }, ...status } : tab === "usuarios" ? { name: data.name, email: data.email, role: data.role ?? "atendimento", department: data.department, password: data.password ?? "", ...status } : { name: data.name, ...status }; await api(record ? `${paths[tab]}/${record.id}` : paths[tab], { method: record ? "PUT" : "POST", body: JSON.stringify(body) }); onSaved(); } catch (e) { setError(e instanceof Error ? e.message : "Falha ao salvar cadastro."); } finally { setSaving(false); } }
  return <Modal open={open} title={`${record ? "Editar" : tab === "categorias" ? "Nova" : "Novo"} ${singular[tab]}`} onClose={onClose}><form className="modal-body" onSubmit={submit}>{error && <ErrorBanner message={error} />}
    {tab === "clientes" && <><Field label="Nome"><input value={data.name ?? ""} onChange={set("name")} required /></Field><div className="form-grid two"><Field label="Documento"><input value={data.document ?? ""} onChange={set("document")} /></Field><Field label="Telefone"><input value={data.phone ?? ""} onChange={set("phone")} /></Field></div><Field label="E-mail"><input type="email" value={data.email ?? ""} onChange={set("email")} /></Field><div className="form-grid two"><Field label="Rua"><input value={data.street ?? ""} onChange={set("street")} /></Field><Field label="Número"><input value={data.number ?? ""} onChange={set("number")} /></Field><Field label="Complemento"><input value={data.complement ?? ""} onChange={set("complement")} /></Field><Field label="Bairro"><input value={data.district ?? ""} onChange={set("district")} /></Field><Field label="Cidade"><input value={data.city ?? ""} onChange={set("city")} /></Field><Field label="Estado"><input maxLength={2} value={data.state ?? ""} onChange={set("state")} /></Field><Field label="CEP"><input value={data.zipCode ?? ""} onChange={set("zipCode")} /></Field></div><Field label="Observações"><input value={data.notes ?? ""} onChange={set("notes")} /></Field></>}
    {tab === "produtos" && <><div className="form-grid two"><Field label="SKU"><input value={data.sku ?? ""} onChange={set("sku")} required /></Field><Field label="Categoria"><select value={data.categoryId ?? ""} onChange={set("categoryId")}><option value="">Sem categoria</option>{categories.map((c) => <option value={c.id} key={c.id}>{c.name}</option>)}</select></Field></div><Field label="Nome"><input value={data.name ?? ""} onChange={set("name")} required /></Field><div className="form-grid two"><Field label="Preço"><input type="number" min="0" step="0.01" value={data.price ?? ""} onChange={set("price")} required /></Field><Field label="Tempo de produção (min.)"><input type="number" min="0" value={data.productionMinutes ?? "0"} onChange={set("productionMinutes")} /></Field></div></>}
    {tab === "categorias" && <Field label="Nome"><input value={data.name ?? ""} onChange={set("name")} required /></Field>}
    {tab === "usuarios" && <><Field label="Nome"><input value={data.name ?? ""} onChange={set("name")} required /></Field><Field label="E-mail"><input type="email" value={data.email ?? ""} onChange={set("email")} required /></Field><div className="form-grid two"><Field label="Perfil"><select value={data.role ?? "atendimento"} onChange={set("role")}>{Object.entries(roleLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></Field><Field label="Área"><input value={data.department ?? ""} onChange={set("department")} /></Field></div><Field label={record ? "Nova senha" : "Senha inicial"} hint={record ? "Deixe em branco para manter a senha atual." : undefined}><input type="password" minLength={8} value={data.password ?? ""} onChange={set("password")} required={!record} /></Field></>}
    {record && <label className="check-field"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Cadastro ativo</label>}
    <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancelar</button><button className="button primary" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</button></div>
  </form></Modal>;
}

function DeleteModal({ tab, record, onClose, onDeleted }: { tab: Tab; record: RegistrationRecord | null; onClose: () => void; onDeleted: () => void }) {
  const [error, setError] = useState(""); const [deleting, setDeleting] = useState(false);
  useEffect(() => { setError(""); }, [record]);
  async function confirm() { if (!record) return; setDeleting(true); setError(""); try { await api(`${paths[tab]}/${record.id}`, { method: "DELETE" }); onDeleted(); } catch (e) { setError(e instanceof Error ? e.message : "Falha ao excluir cadastro."); } finally { setDeleting(false); } }
  return <Modal open={!!record} title={`Excluir ${singular[tab]}`} onClose={onClose}><div className="modal-body">{error && <ErrorBanner message={error} />}
    <p className="confirm-text">Tem certeza que deseja excluir <strong>{record?.name}</strong>? Esta ação não pode ser desfeita.{tab === "categorias" && " Os produtos desta categoria ficarão sem categoria."}</p>
    <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancelar</button><button type="button" className="button danger-outline" onClick={confirm} disabled={deleting}>{deleting ? "Excluindo..." : "Excluir"}</button></div>
  </div></Modal>;
}
