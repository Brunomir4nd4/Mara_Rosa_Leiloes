"use client";

import { useState } from "react";
import { maskCpf, isValidCpf } from "../lib/cpf";

export default function LoginPage() {
  const [cpf, setCpf] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  function handleChange(e) {
    setCpf(maskCpf(e.target.value));
    setError("");
    setDone(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isValidCpf(cpf)) {
      setError("CPF inválido. Confira os 11 números e tente de novo.");
      return;
    }
    setLoading(true);
    try {
      // TODO: ligar à sua API de login (enviar apenas os números do CPF)
      // await fetch("/api/login", { method: "POST", body: JSON.stringify({ cpf: cpf.replace(/\D/g, "") }) });
      setDone(true);
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="logo"
            src="/logo.jpg"
            alt="Mara Rosa Leilões – A vitrine do boi"
            width={886}
            height={861}
            fetchPriority="high"
          />
        </section>
      </div>
      <section className="right">
        <form onSubmit={handleSubmit} noValidate>
          <h1>Acesse seu cadastro</h1>
          <p className="sub">Digite seu CPF para entrar no leilão.</p>
          <label htmlFor="cpf">CPF</label>
          <div className="field">
            <input
              id="cpf"
              name="cpf"
              inputMode="numeric"
              autoComplete="off"
              placeholder="000.000.000-00"
              maxLength={14}
              value={cpf}
              onChange={handleChange}
              aria-describedby="err"
            />
          </div>
          <div className="err" id="err" role="alert">{error}</div>
          <button type="submit" disabled={loading}>{loading ? "Entrando…" : "Entrar"}</button>
          {done && <div className="ok">CPF validado. Conectando ao seu cadastro…</div>}
        </form>
      </section>
    </main>
  );
}
