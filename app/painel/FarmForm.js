"use client";

import { useState } from "react";
import { maskCpf, isValidCpf } from "../../lib/cpf";
import { maskCnpj, isValidCnpj } from "../../lib/cnpj";
import { postJson } from "../../lib/http";

const EMPTY = { cpf: "", farmName: "", tradeName: "", ownerName: "", cnpj: "" };

export default function FarmForm({ records, onAdd }) {
  const [form, setForm] = useState(EMPTY);
  const [cpfError, setCpfError] = useState("");
  const [cnpjError, setCnpjError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isValidCpf(form.cpf)) {
      setCpfError("CPF inválido. Confira os 11 números e tente de novo.");
      document.getElementById("farm-cpf").focus();
      return;
    }
    // CNPJ é opcional, mas se preenchido precisa ser válido
    if (form.cnpj && !isValidCnpj(form.cnpj)) {
      setCnpjError("CNPJ inválido. Confira os 14 caracteres e tente de novo.");
      document.getElementById("farm-cnpj").focus();
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      onAdd(await postJson("/api/farms", form));
      setForm(EMPTY);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit}>
        <div className="grid">
          <div className="fld">
            <label htmlFor="farm-cpf">CPF do titular</label>
            <input id="farm-cpf" inputMode="numeric" placeholder="000.000.000-00" maxLength={14} required
              aria-invalid={cpfError ? "true" : "false"} aria-describedby="farm-cpf-err"
              value={form.cpf} onChange={(e) => { set("cpf", maskCpf(e.target.value)); setCpfError(""); }} />
            <div className="err" id="farm-cpf-err" role="alert">{cpfError}</div>
          </div>
          <div className="fld">
            <label htmlFor="farm-owner">Nome do titular</label>
            <input id="farm-owner" required value={form.ownerName} onChange={(e) => set("ownerName", e.target.value)} />
          </div>
          <div className="fld">
            <label htmlFor="farm-name">Nome da fazenda</label>
            <input id="farm-name" required value={form.farmName} onChange={(e) => set("farmName", e.target.value)} />
          </div>
          <div className="fld">
            <label htmlFor="farm-trade">Nome fantasia (opcional)</label>
            <input id="farm-trade" value={form.tradeName} onChange={(e) => set("tradeName", e.target.value)} />
          </div>
          <div className="fld">
            <label htmlFor="farm-cnpj">CNPJ (opcional)</label>
            <input id="farm-cnpj" autoCapitalize="characters" placeholder="00.000.000/0000-00" maxLength={18}
              aria-invalid={cnpjError ? "true" : "false"} aria-describedby="farm-cnpj-err"
              value={form.cnpj} onChange={(e) => { set("cnpj", maskCnpj(e.target.value)); setCnpjError(""); }} />
            <div className="err" id="farm-cnpj-err" role="alert">{cnpjError}</div>
          </div>
        </div>
        <div className="err" role="alert">{saveError}</div>
        <button type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar fazenda"}</button>
      </form>

      <h2>Fazendas registradas</h2>
      {records.length === 0 ? (
        <p className="empty">Nenhuma fazenda registrada.</p>
      ) : (
        <div className="tbl">
          <table>
            <thead>
              <tr><th>Fazenda</th><th>Nome fantasia</th><th>Titular</th><th>CPF</th><th>CNPJ</th></tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>{r.farmName}</td>
                  <td>{r.tradeName || "—"}</td>
                  <td>{r.ownerName}</td>
                  <td>{r.cpf}</td>
                  <td>{r.cnpj || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
