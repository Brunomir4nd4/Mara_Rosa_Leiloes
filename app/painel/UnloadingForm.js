"use client";

import { useState } from "react";
import { maskCpf, isValidCpf } from "../../lib/cpf";

const EMPTY = { lotId: "", value: "", term: "", buyerName: "", buyerNickname: "", buyerCpf: "" };

// Data e horário locais do momento do registro (YYYY-MM-DD e HH:MM)
function nowLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

function formatBRL(value) {
  if (value === "" || value == null) return "—";
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default function UnloadingForm({ records, lots = [], onAdd, onUpdate }) {
  const [form, setForm] = useState(EMPTY);
  const [cpfError, setCpfError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ date: "", time: "" });

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    // CPF é opcional, mas se preenchido precisa ser válido
    if (form.buyerCpf && !isValidCpf(form.buyerCpf)) {
      setCpfError("CPF inválido. Confira os 11 números e tente de novo.");
      document.getElementById("unl-buyer-cpf").focus();
      return;
    }
    const lot = lots.find((l) => String(l.id) === form.lotId);
    // TODO: enviar para a API (POST /api/unloadings) e gravar no MongoDB
    // Data e horário são registrados automaticamente; podem ser alterados depois pelo botão Editar
    onAdd({
      id: Date.now(),
      ...form,
      farmName: lot ? lot.farm : "", // fazenda vem do lote escolhido
      lot: lot ? lot.lot : "",
      ...nowLocal(),
    });
    setForm(EMPTY);
  }

  function startEdit(r) {
    setEditingId(r.id);
    setDraft({ date: r.date, time: r.time });
  }

  function saveEdit(e) {
    e.preventDefault();
    // TODO: enviar para a API (PATCH /api/unloadings/:id) e atualizar no MongoDB
    onUpdate(editingId, draft);
    setEditingId(null);
  }

  return (
    <>
      <form onSubmit={handleSubmit}>
        <div className="grid">
          <div className="fld">
            <label htmlFor="unl-lot">Lote</label>
            <select id="unl-lot" required value={form.lotId} onChange={(e) => set("lotId", e.target.value)}
              aria-describedby="unl-lot-hint">
              <option value="">Selecione…</option>
              {[...lots].sort((a, b) => Number(a.lot) - Number(b.lot)).map((l) => (
                <option key={l.id} value={String(l.id)}>Lote {l.lot} — {l.farm} ({l.quantity} cab.)</option>
              ))}
            </select>
            {lots.length === 0 && (
              <p className="empty" id="unl-lot-hint">Nenhum lote registrado. Cadastre um lote primeiro.</p>
            )}
          </div>
          <div className="fld">
            <label htmlFor="unl-value">Valor (R$)</label>
            <input id="unl-value" type="number" min="0.01" step="0.01" inputMode="decimal" required
              value={form.value} onChange={(e) => set("value", e.target.value)} />
          </div>
          <div className="fld">
            <label htmlFor="unl-term">Prazo</label>
            <input id="unl-term" required placeholder="Ex.: 30/60/90 ou 24x"
              value={form.term} onChange={(e) => set("term", e.target.value)} />
          </div>
          <div className="fld">
            <label htmlFor="unl-buyer-name">Comprador</label>
            <input id="unl-buyer-name" required value={form.buyerName} onChange={(e) => set("buyerName", e.target.value)} />
          </div>
          <div className="fld">
            <label htmlFor="unl-buyer-nick">Apelido (opcional)</label>
            <input id="unl-buyer-nick" value={form.buyerNickname} onChange={(e) => set("buyerNickname", e.target.value)} />
          </div>
          <div className="fld">
            <label htmlFor="unl-buyer-cpf">CPF do comprador (opcional)</label>
            <input id="unl-buyer-cpf" inputMode="numeric" placeholder="000.000.000-00" maxLength={14}
              aria-invalid={cpfError ? "true" : "false"} aria-describedby="unl-buyer-cpf-err"
              value={form.buyerCpf} onChange={(e) => { set("buyerCpf", maskCpf(e.target.value)); setCpfError(""); }} />
            <div className="err" id="unl-buyer-cpf-err" role="alert">{cpfError}</div>
          </div>
        </div>
        <button type="submit">Registrar desembarque</button>
      </form>

      <h2>Desembarques registrados</h2>
      {records.length === 0 ? (
        <p className="empty">Nenhum desembarque registrado nesta sessão.</p>
      ) : (
        <div className="tbl tbl-unl">
          <table>
            <thead>
              <tr>
                <th>Fazenda</th><th>Lote</th><th>Valor</th><th>Prazo</th><th>Comprador</th><th>Apelido</th><th>CPF do comprador</th>
                <th>Data</th><th>Horário</th><th><span className="sr">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) =>
                editingId === r.id ? (
                  <tr key={r.id}>
                    <td>{r.farmName}</td>
                    <td>{r.lot}</td>
                    <td>{formatBRL(r.value)}</td>
                    <td>{r.term}</td>
                    <td>{r.buyerName}</td>
                    <td>{r.buyerNickname || "—"}</td>
                    <td>{r.buyerCpf || "—"}</td>
                    <td>
                      <input type="date" aria-label="Data do desembarque" required form={`edit-${r.id}`}
                        value={draft.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} />
                    </td>
                    <td>
                      <input type="time" aria-label="Horário do desembarque" required form={`edit-${r.id}`}
                        value={draft.time} onChange={(e) => setDraft((d) => ({ ...d, time: e.target.value }))} />
                    </td>
                    <td className="act">
                      <form id={`edit-${r.id}`} className="edit-form" onSubmit={saveEdit} />
                      <button type="submit" form={`edit-${r.id}`}>Salvar</button>
                      <button type="button" className="ghost" onClick={() => setEditingId(null)}>Cancelar</button>
                    </td>
                  </tr>
                ) : (
                  <tr key={r.id}>
                    <td>{r.farmName}</td>
                    <td>{r.lot}</td>
                    <td>{formatBRL(r.value)}</td>
                    <td>{r.term}</td>
                    <td>{r.buyerName}</td>
                    <td>{r.buyerNickname || "—"}</td>
                    <td>{r.buyerCpf || "—"}</td>
                    <td>{formatDate(r.date)}</td>
                    <td>{r.time}</td>
                    <td className="act">
                      <button type="button" className="ghost" onClick={() => startEdit(r)}>Editar</button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
