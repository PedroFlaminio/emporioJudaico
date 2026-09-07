import { useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { ApiError } from "../lib/api";
import { ErrorBanner, Field } from "../components/ui";
import logoUrl from "../../assets/logo.png";

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("admin@emporio.local");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setLoading(true);
    try { await login(email, password); }
    catch (error) { setError(error instanceof ApiError ? error.message : "Não foi possível entrar."); }
    finally { setLoading(false); }
  }

  return <div className="login-page">
    <section className="login-story">
      <div className="login-brand"><div className="brand-mark light brand-logo"><img src={logoUrl} alt="Emporium Brasil Israel" /></div><div><strong>Emporium Brasil Israel</strong><span>Delícias judaicas do Bom Retiro</span></div></div>
      <div className="story-content"><span className="eyebrow light-text">Operação em um só lugar</span><h1>Do pedido recebido à entrega confirmada.</h1><p>Acompanhe cada etapa, organize a equipe e cuide de cada detalhe com clareza.</p>
        <div className="story-points"><span><CheckCircle2 /> Pedidos e prazos visíveis</span><span><CheckCircle2 /> Histórico completo de mudanças</span><span><CheckCircle2 /> Financeiro e produção conectados</span></div>
      </div>
      <span className="hebrew-detail">שבת שלום</span>
    </section>
    <section className="login-panel"><form onSubmit={submit}>
      <img className="login-form-logo" src={logoUrl} alt="Emporium Brasil Israel — Delícias Judaicas do Bom Retiro" /><span className="eyebrow">Acesso seguro</span><h2>Bem-vindo de volta</h2><p>Entre com seus dados para acessar a operação.</p>
      {error && <ErrorBanner message={error} />}
      <Field label="E-mail"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></Field>
      <Field label="Senha"><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></Field>
      <button className="button primary login-submit" disabled={loading}>{loading ? "Entrando..." : <>Entrar <ArrowRight size={18} /></>}</button>
      <div className="demo-access"><strong>Acesso de demonstração</strong><span>admin@emporio.local · admin123</span></div>
    </form></section>
  </div>;
}
