"use client";

import { useState } from "react";

const SEX_TYPES = ["MACHO", "FEMEA / SOLTEIRA", "FEMEA / PARIDA"];
const BREEDS = ["NELORE", "NELORADA", "CRUZADO"];
const EMPTY = { farm: "", quantity: "", sexType: "", ageMonths: "", breed: "" };

export default function CattleForm({ records, farms = [], onAdd }) {
  const [form, setForm] = useState(EMPTY);
  const [ageError, setAgeError] = useState("");

  // Número do lote é gerado automaticamente: sempre o maior já usado + 1 (sem repetição, não editável)
  // TODO: quando houver API, gerar a sequência no servidor/MongoDB para evitar duplicidade entre usuários
  const nextLot = records.reduce((max, r) => Math.max(max, Number(r.lot)), 0) + 1;

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (form.ageMonths === "" || Number(form.ageMonths) <= 0) {
      setAgeError("Informe a idade. Ela deve ser maior que zero.");
      document.getElementById("cat-age").focus();
      return;
    }
    // TODO: enviar para a API (POST /api/lots) e gravar no MongoDB
    onAdd({ id: Date.now(), lot: nextLot, ...form });
    setForm(EMPTY);
  }

  const sorted = [...records].sort((a, b) => Number(a.lot) - Number(b.lot));
  const farmNames = [...new Set(farms.map((f) => f.farmName).filter(Boolean))];
  const totalCattle = sorted.reduce((s, r) => s + Number(r.quantity), 0);
  const totalFemales = sorted.filter((r) => r.sexType.startsWith("FEMEA")).reduce((s, r) => s + Number(r.quantity), 0);
  const totalMales = sorted.filter((r) => r.sexType.startsWith("MACHO")).reduce((s, r) => s + Number(r.quantity), 0);

  return (
    <>
      <form onSubmit={handleSubmit}>
        <div className="grid">
          <div className="fld">
            <label htmlFor="cat-lot">Lote</label>
            <input id="cat-lot" readOnly tabIndex={-1} aria-readonly="true" value={nextLot} />
          </div>
          <div className="fld">
            <label htmlFor="cat-farm">Fazenda</label>
            <select id="cat-farm" required value={form.farm} onChange={(e) => set("farm", e.target.value)}
              aria-describedby="cat-farm-hint">
              <option value="">Selecione…</option>
              {farmNames.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            {farmNames.length === 0 && (
              <p className="empty" id="cat-farm-hint">Nenhuma fazenda registrada. Cadastre uma fazenda primeiro.</p>
            )}
          </div>
          <div className="fld">
            <label htmlFor="cat-qty">Qtd.</label>
            <input id="cat-qty" type="number" min="1" step="1" inputMode="numeric" required
              value={form.quantity} onChange={(e) => set("quantity", e.target.value)} />
          </div>
          <div className="fld">
            <label htmlFor="cat-sex">Sexo / Tipo</label>
            <select id="cat-sex" required value={form.sexType} onChange={(e) => set("sexType", e.target.value)}>
              <option value="">Selecione…</option>
              {SEX_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="fld">
            <label htmlFor="cat-age">Idade (meses)</label>
            <input id="cat-age" type="number" min="1" step="1" inputMode="numeric" required
              aria-invalid={ageError ? "true" : "false"} aria-describedby="cat-age-err"
              onKeyDown={(e) => { if (e.key === "-") e.preventDefault(); }}
              value={form.ageMonths} onChange={(e) => { set("ageMonths", e.target.value); setAgeError(""); }} />
            <div className="err" id="cat-age-err" role="alert">{ageError}</div>
          </div>
          <div className="fld">
            <label htmlFor="cat-breed">Raça</label>
            <select id="cat-breed" required value={form.breed} onChange={(e) => set("breed", e.target.value)}>
              <option value="">Selecione…</option>
              {BREEDS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        </div>
        <button type="submit">Salvar lote</button>
      </form>

      <h2>Lotes registrados</h2>
      {sorted.length === 0 ? (
        <p className="empty">Nenhum lote registrado nesta sessão.</p>
      ) : (
        <>
          <div className="tbl tbl-lots">
            <table>
              <thead>
                <tr>
                  <th>Lote</th><th>Fazenda</th><th>Qtd.</th><th>Sexo / Tipo</th><th>Idade</th>
                  <th>Raça</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.id}>
                    <td>{r.lot}</td>
                    <td>{r.farm}</td>
                    <td>{r.quantity}</td>
                    <td>{r.sexType}</td>
                    <td>{r.ageMonths}</td>
                    <td>{r.breed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="totals">
            <div><dt>Quant. de lotes</dt><dd>{sorted.length}</dd></div>
            <div><dt>Quant. de gado</dt><dd>{totalCattle}</dd></div>
            <div><dt>Quant. de fêmeas</dt><dd>{totalFemales}</dd></div>
            <div><dt>Quant. de machos</dt><dd>{totalMales}</dd></div>
          </dl>
        </>
      )}
    </>
  );
}
