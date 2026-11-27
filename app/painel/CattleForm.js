"use client";

import { useState } from "react";
import { BREEDS, LIMITS, QUALITIES, SEX_TYPES, categoryOf, isFemale, label } from "../../lib/catalog";
import Select from "../_ui/Select";

const EMPTY = { farm: "", quantity: "", sexType: "", ageMonths: "", breed: "", quality: "" };

const FIELDS = [
  { key: "farm", id: "des-farm", label: "Fazenda" },
  { key: "quantity", id: "des-qty", label: "Quantidade" },
  { key: "sexType", id: "des-sex", label: "Sexo / Tipo" },
  { key: "ageMonths", id: "des-age", label: "Idade" },
  { key: "breed", id: "des-breed", label: "Raça" },
  { key: "quality", id: "des-quality", label: "Qualidade" },
];

function intError(value, max, what) {
  if (value === "") return `Informe ${what}.`;
  const n = Number(value);
  if (!Number.isInteger(n)) return "Use apenas números inteiros.";
  if (n < 1) return "Deve ser maior que zero.";
  if (n > max) return `Máximo de ${max.toLocaleString("pt-BR")}.`;
  return "";
}

function validate(form) {
  const errors = {
    farm: form.farm ? "" : "Escolha a fazenda de origem do gado.",
    quantity: intError(form.quantity, LIMITS.quantity, "a quantidade de cabeças"),
    sexType: form.sexType ? "" : "Escolha o sexo / tipo.",
    ageMonths: intError(form.ageMonths, LIMITS.ageMonths, "a idade em meses"),
    breed: form.breed ? "" : "Escolha a raça.",
    quality: form.quality ? "" : "Escolha a qualidade.",
  };
  return Object.fromEntries(Object.entries(errors).filter(([, v]) => v));
}

function FieldError({ id, message }) {
  return message ? <p className="ferr" id={id} role="alert">{message}</p> : null;
}

export default function CattleForm({ records, farms = [], lots = [], onAdd }) {
  const [form, setForm] = useState(EMPTY);
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);

  const errors = validate(form);
  const show = (key) => (submitted || touched[key]) && errors[key];
  const touch = (key) => setTouched((t) => ({ ...t, [key]: true }));
  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSubmitError("");
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitted(true);
    const first = FIELDS.find((f) => errors[f.key]);
    if (first) {
      document.getElementById(first.id)?.focus();
      return;
    }
    setSaving(true);
    try {
      await onAdd(form);
      setForm(EMPTY);
      setTouched({});
      setSubmitted(false);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const farmNames = [...new Set(farms.map((f) => f.farmName).filter(Boolean))];
  const lotByEntry = new Map(lots.flatMap((l) => l.entryIds.map((id) => [id, l.lot])));
  const errorCount = Object.keys(errors).length;
  const preview = form.sexType && !errors.ageMonths ? categoryOf(form.sexType, form.ageMonths) : null;

  const heads = records.reduce((s, r) => s + Number(r.quantity), 0);
  const females = records.filter((r) => isFemale(r.sexType)).reduce((s, r) => s + Number(r.quantity), 0);
  const waiting = records.filter((r) => !lotByEntry.has(r.id)).reduce((s, r) => s + Number(r.quantity), 0);

  const fieldClass = (key) => `fld${show(key) ? " has-err" : ""}`;

  return (
    <>
      <form onSubmit={handleSubmit} noValidate>
        {submitted && errorCount > 0 && (
          <div className="vbox" role="alert">
            <span className="vbox-ico" aria-hidden="true">!</span>
            <div>
              <strong>Revise {errorCount === 1 ? "1 campo" : `${errorCount} campos`} antes de salvar</strong>
              <ul>
                {FIELDS.filter((f) => errors[f.key]).map((f) => (
                  <li key={f.key}>
                    <a href={`#${f.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(f.id)?.focus(); }}>
                      {f.label}
                    </a>: {errors[f.key]}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="grid">
          <div className={`${fieldClass("farm")} wide`}>
            <label htmlFor="des-farm">Fazenda</label>
            <Select id="des-farm" value={form.farm} onChange={(v) => set("farm", v)} onBlur={() => touch("farm")}
              invalid={Boolean(show("farm"))} describedBy={show("farm") ? "des-farm-err" : "des-farm-hint"}
              placeholder={farmNames.length ? "Selecione a fazenda…" : "Nenhuma fazenda cadastrada"}
              options={farmNames.map((n) => ({ value: n, label: n }))} />
            <FieldError id="des-farm-err" message={show("farm")} />
            {farmNames.length === 0 && (
              <p className="hint" id="des-farm-hint">Cadastre uma fazenda na aba Fazenda para registrar o desembarque.</p>
            )}
          </div>
          <div className={fieldClass("quantity")}>
            <label htmlFor="des-qty">Quantidade (cabeças)</label>
            <input id="des-qty" type="number" min="1" max={LIMITS.quantity} step="1" inputMode="numeric" placeholder="Ex.: 12"
              aria-invalid={show("quantity") ? "true" : "false"} aria-describedby="des-qty-err"
              onKeyDown={(e) => { if (["-", "+", "e", ",", "."].includes(e.key)) e.preventDefault(); }}
              value={form.quantity} onChange={(e) => set("quantity", e.target.value)} onBlur={() => touch("quantity")} />
            <FieldError id="des-qty-err" message={show("quantity")} />
          </div>
          <div className={fieldClass("sexType")}>
            <label htmlFor="des-sex">Sexo / Tipo</label>
            <Select id="des-sex" value={form.sexType} onChange={(v) => set("sexType", v)} onBlur={() => touch("sexType")}
              invalid={Boolean(show("sexType"))} describedBy="des-sex-err"
              options={SEX_TYPES.map((s) => ({ value: s, label: label(s) }))} />
            <FieldError id="des-sex-err" message={show("sexType")} />
          </div>
          <div className={fieldClass("ageMonths")}>
            <label htmlFor="des-age">Idade (meses)</label>
            <input id="des-age" type="number" min="1" max={LIMITS.ageMonths} step="1" inputMode="numeric" placeholder="Ex.: 18"
              aria-invalid={show("ageMonths") ? "true" : "false"} aria-describedby="des-age-err"
              onKeyDown={(e) => { if (["-", "+", "e", ",", "."].includes(e.key)) e.preventDefault(); }}
              value={form.ageMonths} onChange={(e) => set("ageMonths", e.target.value)} onBlur={() => touch("ageMonths")} />
            <FieldError id="des-age-err" message={show("ageMonths")} />
          </div>
          <div className={fieldClass("breed")}>
            <label htmlFor="des-breed">Raça</label>
            <Select id="des-breed" value={form.breed} onChange={(v) => set("breed", v)} onBlur={() => touch("breed")}
              invalid={Boolean(show("breed"))} describedBy="des-breed-err"
              options={BREEDS.map((b) => ({ value: b, label: label(b) }))} />
            <FieldError id="des-breed-err" message={show("breed")} />
          </div>
          <div className={fieldClass("quality")}>
            <label htmlFor="des-quality">Qualidade</label>
            <Select id="des-quality" value={form.quality} onChange={(v) => set("quality", v)} onBlur={() => touch("quality")}
              invalid={Boolean(show("quality"))} describedBy="des-quality-err"
              options={QUALITIES.map((q) => ({ value: q, label: label(q) }))} />
            <FieldError id="des-quality-err" message={show("quality")} />
          </div>
          <div className="fld cat-preview" aria-live="polite">
            <span className="cp-label">Categoria</span>
            {preview ? (
              <span className="cp-val">{label(preview)}</span>
            ) : (
              <span className="cp-empty">Escolha o sexo e a idade</span>
            )}
            <span className="cp-hint">Calculada automaticamente</span>
          </div>
        </div>

        {submitError && (
          <div className="vbox" role="alert">
            <span className="vbox-ico" aria-hidden="true">!</span>
            <div><strong>Não foi possível salvar</strong><p>{submitError}</p></div>
          </div>
        )}
        <button type="submit" disabled={saving}>{saving ? "Salvando…" : "Registrar desembarque"}</button>
      </form>

      <h2>Desembarques registrados</h2>
      {records.length === 0 ? (
        <div className="empty-card">
          <strong>Nenhum desembarque registrado ainda</strong>
          <p>Os registros aparecem aqui e ficam disponíveis para vincular na aba Lotes.</p>
        </div>
      ) : (
        <>
          <div className="tbl tbl-lots">
            <table>
              <thead>
                <tr>
                  <th>Fazenda</th><th>Qtd.</th><th>Sexo / Tipo</th><th>Idade</th>
                  <th>Raça</th><th>Categoria</th><th>Qualidade</th><th>Lote</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => {
                  const lot = lotByEntry.get(r.id);
                  return (
                    <tr key={r.id}>
                      <td>{r.farm}</td>
                      <td>{r.quantity}</td>
                      <td>{label(r.sexType)}</td>
                      <td>{r.ageMonths} m</td>
                      <td>{label(r.breed)}</td>
                      <td>{label(categoryOf(r.sexType, r.ageMonths))}</td>
                      <td>{r.quality ? label(r.quality) : "—"}</td>
                      <td>
                        {lot ? <span className="lot-pill">Lote {String(lot).padStart(2, "0")}</span>
                          : <span className="lot-pill wait">Sem lote</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <dl className="totals">
            <div><dt>Registros</dt><dd>{records.length}</dd></div>
            <div><dt>Cabeças</dt><dd>{heads}</dd></div>
            <div><dt>Fêmeas</dt><dd>{females}</dd></div>
            <div><dt>Machos</dt><dd>{heads - females}</dd></div>
            <div><dt>Cabeças sem lote</dt><dd>{waiting}</dd></div>
          </dl>
        </>
      )}
    </>
  );
}
