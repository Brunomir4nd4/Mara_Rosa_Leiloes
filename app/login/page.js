"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { maskCpf, isValidCpf } from "../../lib/cpf";
import PageTheme from "../_ui/PageTheme";
import LoginLogo from "./LoginLogo";

// Só aceita redirecionar para dentro do painel (evita open redirect via ?next=)
function nextPath() {
  const next = new URLSearchParams(window.location.search).get("next") || "";
  return next.startsWith("/painel") ? next : "/painel";
}

const IconGrid = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" /></svg>
);
const IconLock = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z" /></svg>
);
const IconUser = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm0 2c-4.4 0-8 2.2-8 5v2h16v-2c0-2.8-3.6-5-8-5z" /></svg>
);

export default function LoginPage() {
  const router = useRouter();
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isValidCpf(cpf)) {
      setError("CPF inválido. Confira os 11 números e tente de novo.");
      document.getElementById("cpf").focus();
      return;
    }
    if (!password) {
      setError("Digite sua senha.");
      document.getElementById("password").focus();
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf: cpf.replace(/\D/g, ""), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Não foi possível entrar. Tente de novo.");
        setPassword("");
        return;
      }
      setDone(true);
      router.replace(nextPath());
      router.refresh();
    } catch {
      setError("Sem conexão com o servidor. Verifique a internet e tente de novo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <div className="hero">
        <div className="stripe" aria-hidden="true" />
        <div className="gap" aria-hidden="true" />
        <section className="left">
          <LoginLogo />
        </section>
      </div>
      <section className="right">
        <div className="login-box">
          <div className="lbox-top"><PageTheme placement="inline" /></div>
          <nav className="ltabs" aria-label="Escolha a área">
            <a href="/catalogo" className="ltab"><IconGrid /><span>Catálogo<span className="long"> de lotes</span></span></a>
            <span className="ltab on" aria-current="page"><IconLock /> Painel</span>
          </nav>

          <form onSubmit={handleSubmit} noValidate className="login-form">
            <h1>Acesse o painel</h1>
            <p className="sub">Entre com seu CPF e senha para gerenciar fazendas e lotes.</p>

            <div className="lfld">
              <label htmlFor="cpf">CPF</label>
              <div className="field">
                <span className="ico"><IconUser /></span>
                <input
                  id="cpf"
                  name="cpf"
                  inputMode="numeric"
                  autoComplete="username"
                  placeholder="000.000.000-00"
                  maxLength={14}
                  value={cpf}
                  onChange={(e) => { setCpf(maskCpf(e.target.value)); setError(""); setDone(false); }}
                  aria-describedby="err"
                  aria-invalid={error ? "true" : "false"}
                />
              </div>
            </div>

            <div className="lfld">
              <label htmlFor="password">Senha</label>
              <div className="field">
                <span className="ico"><IconLock /></span>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Sua senha"
                  maxLength={200}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  aria-describedby="err"
                  aria-invalid={error ? "true" : "false"}
                />
                <button type="button" className="reveal" onClick={() => setShowPassword((v) => !v)}
                  aria-pressed={showPassword} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>
                  {showPassword ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </div>

            <div className="err" id="err" role="alert">{error}</div>
            <button type="submit" className="submit" disabled={loading}>
              <span>{loading ? "Entrando…" : "Entrar"}</span>
            </button>
            {done && <div className="ok">Acesso liberado. Abrindo o painel…</div>}
          </form>
        </div>
      </section>
    </main>
  );
}
