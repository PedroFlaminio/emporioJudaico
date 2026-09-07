import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { Loading } from "./components/ui";
import { useAuth } from "./contexts/AuthContext";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { OrdersPage } from "./pages/OrdersPage";
import { OrderDetailPage } from "./pages/OrderDetailPage";
import { ProductionPage } from "./pages/ProductionPage";
import { PreparationPage } from "./pages/PreparationPage";
import { FinancePage } from "./pages/FinancePage";
import { ShippingPage } from "./pages/ShippingPage";
import { RegistrationsPage } from "./pages/RegistrationsPage";

function ProtectedRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <div className="full-loading"><Loading /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <AppShell />;
}

export function App() {
  const { user } = useAuth();
  return <Routes>
    <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
    <Route element={<ProtectedRoutes />}>
      <Route index element={<DashboardPage />} />
      <Route path="pedidos" element={<OrdersPage />} />
      <Route path="pedidos/:id" element={<OrderDetailPage />} />
      <Route path="producao" element={<ProductionPage />} />
      <Route path="preparacao" element={<PreparationPage />} />
      <Route path="financeiro" element={<FinancePage />} />
      <Route path="expedicao" element={<ShippingPage />} />
      <Route path="cadastros" element={<RegistrationsPage />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}
