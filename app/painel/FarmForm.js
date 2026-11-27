"use client";

import { useState } from "react";
import { maskCpf, isValidCpf } from "../../lib/cpf";
import { maskCnpj, isValidCnpj } from "../../lib/cnpj";
import { maskPhone, isValidPhone } from "../../lib/phone";

const EMPTY = { cpf: "", farmName: "", tradeName: "", ownerName: "", phone: "", cnpj: "" };

const FIELDS = [
  { key: "cpf", id: "farm-cpf", label: "CPF do titular" },
  { key: "ownerName", id: "farm-owner", label: "Nome do titular" },
  { key: "phone", id: "farm-phone", label: "Telefone" },
  { key: "farmName", id: "farm-name", label: "Nome da fazenda" },
  { key: "cnpj", id: "farm-cnpj", label: "CNPJ" },
];

function validate(form, existing) {
  const errors = {
    cpf: !form.cpf ? "Informe o CPF do titular." : !isValidCpf(form.cpf) ? "CPF inválido. Confira os 11 números." : "",
    ownerName: form.ownerName.trim().length >= 3 ? "" : "Informe o nome completo do titular.",
    phone: !form.phone ? "Informe o telefone de contato." : !isValidPhone(form.phone) ? "Telefone inválido. Use DDD + número, ex.: (62) 99999-9999." : "",
    farmName: !form.farmName.trim()
      ? "Informe o nome da fazenda."
      : existing.has(form.farmName.trim().toLowerCase()) ? "Já existe uma fazenda com esse nome." : "",
    cnpj: form.cnpj && !isValidCnpj(form.cnpj) ? "CNPJ inválido. Confira os 14 caracteres." : "",
  };
  return Object.fromEntries(Object.entries(errors).filter(([, v]) => v));
}

function FieldError({ id, message }) {
  return message ? <p className="ferr" id={id} role="alert">{message}</p> : null;
}

export default function FarmForm({ records, onAdd }) {
  const [form, setForm] = useState(EMPTY);
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);

  const existing = new Set(records.map((r) => r.farmName.trim().toLowerCase()));
  const errors = validate(form, existing);
  const show = (key) => (submitted || touched[key]) && errors[key];
  const touch = (key) => setTouched((t) => ({ ...t, [key]: true }));
  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSubmitError("");
  };
  const fieldClass = (key, extra = "") => `fld${show(key) ? " has-err" : ""}${extra}`;
  const errorCount = Object.keys(errors).length;

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
          <div className={fieldClass("cpf")}>
            <label htmlFor="farm-cpf">CPF do titular</label>
            <input id="farm-cpf" inputMode="numeric" placeholder="000.000.000-00" maxLength={14}
              aria-invalid={show("cpf") ? "true" : "false"} aria-describedby="farm-cpf-err"
              value={form.cpf} onChange={(e) => set("cpf", maskCpf(e.target.value))} onBlur={() => touch("cpf")} />
            <FieldError id="farm-cpf-err" message={show("cpf")} />
          </div>
          <div className={fieldClass("ownerName")}>
            <label htmlFor="farm-owner">Nome do titular</label>
            <input id="farm-owner" autoComplete="off" placeholder="Nome completo" maxLength={120}
              aria-invalid={show("ownerName") ? "true" : "false"} aria-describedby="farm-owner-err"
              value={form.ownerName} onChange={(e) => set("ownerName", e.target.value)} onBlur={() => touch("ownerName")} />
            <FieldError id="farm-owner-err" message={show("ownerName")} />
          </div>
          <div className={fieldClass("phone")}>
            <label htmlFor="farm-phone">Telefone / WhatsApp</label>
            <input id="farm-phone" type="tel" inputMode="tel" autoComplete="off" placeholder="(00) 00000-0000" maxLength={15}
              aria-invalid={show("phone") ? "true" : "false"} aria-describedby="farm-phone-err"
              value={form.phone} onChange={(e) => set("phone", maskPhone(e.target.value))} onBlur={() => touch("phone")} />
            <FieldError id="farm-phone-err" message={show("phone")} />
          </div>
          <div className={fieldClass("farmName")}>
            <label htmlFor="farm-name">Nome da fazenda</label>
            <input id="farm-name" autoComplete="off" placeholder="Ex.: Fazenda Boa Vista" maxLength={120}
              aria-invalid={show("farmName") ? "true" : "false"} aria-describedby="farm-name-err"
              value={form.farmName} onChange={(e) => set("farmName", e.target.value)} onBlur={() => touch("farmName")} />
            <FieldError id="farm-name-err" message={show("farmName")} />
          </div>
          <div className="fld">
            <label htmlFor="farm-trade">Nome fantasia <span className="opt">(opcional)</span></label>
            <input id="farm-trade" autoComplete="off" maxLength={120} value={form.tradeName} onChange={(e) => set("tradeName", e.target.value)} />
          </div>
          <div className={fieldClass("cnpj")}>
            <label htmlFor="farm-cnpj">CNPJ <span className="opt">(opcional)</span></label>
            <input id="farm-cnpj" autoCapitalize="characters" placeholder="00.000.000/0000-00" maxLength={18}
              aria-invalid={show("cnpj") ? "true" : "false"} aria-describedby="farm-cnpj-err"
              value={form.cnpj} onChange={(e) => set("cnpj", maskCnpj(e.target.value))} onBlur={() => touch("cnpj")} />
            <FieldError id="farm-cnpj-err" message={show("cnpj")} />
          </div>
        </div>
        {submitError && (
          <div className="vbox" role="alert">
            <span className="vbox-ico" aria-hidden="true">!</span>
            <div><strong>Não foi possível salvar</strong><p>{submitError}</p></div>
          </div>
        )}
        <button type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar fazenda"}</button>
      </form>

      <h2>Fazendas registradas</h2>
      {records.length === 0 ? (
        <div className="empty-card">
          <strong>Nenhuma fazenda registrada ainda</strong>
          <p>Cadastre a primeira fazenda para começar a registrar o desembarque.</p>
        </div>
      ) : (
        <div className="tbl">
          <table>
            <thead>
              <tr><th>Fazenda</th><th>Nome fantasia</th><th>Titular</th><th>Telefone</th><th>CPF</th><th>CNPJ</th></tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>{r.farmName}</td>
                  <td>{r.tradeName || "—"}</td>
                  <td>{r.ownerName}</td>
                  <td>{r.phone || "—"}</td>
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
