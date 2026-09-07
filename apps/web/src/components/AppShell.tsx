import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { ChevronLeft, ClipboardList, Factory, LayoutDashboard, LogOut, Menu, PackageCheck, ReceiptText, Settings2, Truck, UserRound } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { roleLabel, type Role } from "../types";
import logoUrl from "../../assets/logo.png";

const nav: Array<{ to: string; label: string; icon: typeof LayoutDashboard; end?: boolean; roles?: Role[] }> = [
  { to: "/", label: "Painel", icon: LayoutDashboard, end: true },
  { to: "/pedidos", label: "Pedidos", icon: ClipboardList },
  { to: "/producao", label: "Produção", icon: Factory, roles: ["producao", "gestor", "administrador"] },
  { to: "/preparacao", label: "Preparação", icon: PackageCheck, roles: ["producao", "expedicao", "gestor", "administrador"] },
  { to: "/financeiro", label: "Financeiro", icon: ReceiptText, roles: ["financeiro", "gestor", "administrador"] },
  { to: "/expedicao", label: "Expedição", icon: Truck, roles: ["expedicao", "gestor", "administrador"] },
  { to: "/cadastros", label: "Cadastros", icon: Settings2, roles: ["atendimento", "gestor", "administrador"] },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  return <div className={`app-shell ${collapsed ? "nav-collapsed" : ""}`}>
    <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
      <div className="brand"><div className="brand-mark brand-logo"><img src={logoUrl} alt="Emporium Brasil Israel" /></div><div><strong>Emporium</strong><span>Brasil Israel · operação</span></div></div>
      <nav>
        <span className="nav-section">Operação</span>
        {nav.filter((item) => !item.roles || (user && item.roles.includes(user.role))).map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={() => setMobileOpen(false)} title={label}>
          <Icon size={19} /><span>{label}</span>
        </NavLink>)}
      </nav>
      <div className="sidebar-footer">
        <div className="user-card"><div className="avatar">{user?.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div><div><strong>{user?.name}</strong><span>{user ? roleLabel[user.role] : ""}</span></div></div>
        <button className="logout-button" onClick={logout} title="Sair"><LogOut size={18} /><span>Sair</span></button>
      </div>
      <button className="collapse-button" onClick={() => setCollapsed((value) => !value)} title="Recolher menu"><ChevronLeft size={16} /></button>
    </aside>
    {mobileOpen && <button className="sidebar-overlay" onClick={() => setMobileOpen(false)} aria-label="Fechar menu" />}
    <div className="main-area">
      <div className="mobile-header"><button className="icon-button" onClick={() => setMobileOpen(true)}><Menu size={22} /></button><div className="mini-brand"><img src={logoUrl} alt="" /> Emporium</div><UserRound size={20} /></div>
      <main><Outlet /></main>
      <footer className="app-footer">Emporium Brasil Israel · Operação integrada</footer>
    </div>
  </div>;
}
