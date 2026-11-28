"use client";

import { useEffect, useMemo, useState } from "react";
import { label, lotTitle, summarize } from "../../lib/catalog";
import { arrivalError, formatDateTime, toLocalInput } from "../../lib/datetime";
import { maskPlate, transportErrors } from "../../lib/transport";
import DateTimePicker from "../_ui/DateTimePicker";
import NumberStepper from "../_ui/NumberStepper";
import Icon from "../_ui/Icon";

const pad = (n) => String(n).padStart(2, "0");
const fmt = (n) => Number(n || 0).toLocaleString("pt-BR");
const FILTERS = [
  { id: "OPEN", label: "A retirar" },
  { id: "DONE", label: "Concluídos" },
  { id: "ALL", label: "Todos" },
];
const EMPTY = { pickedAt: "", dateEdited: false, quantity: "", driver: "", truckModel: "", plate: "", notes: "" };

function FieldError({ id, message }) {
  return message ? <p className="ferr" id={id} role="alert">{message}</p> : null;
}

/* ---------- Formulário de retirada de um lote ---------- */
function PickupForm({ row, lastTruck, onAdd }) {
  const [form, setForm] = useState(() => ({ ...EMPTY, pickedAt: toLocalInput() }));
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);

  // data e hora automáticas (mesmo comportamento do desembarque)
  useEffect(() => {
    const t = setInterval(() => setForm((f) => (f.dateEdited ? f : { ...f, pickedAt: toLocalInput() })), 20000);
    return () => clearInterval(t);
  }, []);

  const saldo = row.saldo;
  const n = Number(form.quantity);
  const errors = Object.fromEntries(Object.entries({
    pickedAt: form.dateEdited ? arrivalError(form.pickedAt && new Date(form.pickedAt), new Date(), "da retirada") : "",
    quantity: form.quantity === "" ? "Informe quantas cabeças saíram."
      : !Number.isInteger(n) || n < 1 ? "Use um número inteiro maior que zero."
      : n > saldo ? `O saldo deste lote é de ${saldo} ${saldo === 1 ? "cabeça" : "cabeças"}.` : "",
    ...transportErrors(form),
    notes: form.notes.length > 300 ? "Máximo de 300 caracteres." : "",
  }).filter(([, v]) => v));
  const show = (k) => (submitted || touched[k]) && errors[k];
  const touch = (k) => setTouched((t) => ({ ...t, [k]: true }));
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setServerError(""); };
  const fieldClass = (k, extra = "") => `fld${show(k) ? " has-err" : ""}${extra}`;

  async function submit(e) {
    e.preventDefault();
    setSubmitted(true);
    const order = ["pickedAt", "quantity", "driver", "truckModel", "plate", "notes"];
    const first = order.find((k) => errors[k]);
    if (first) { document.getElementById(`rt-${first}`)?.focus(); return; }
    setSaving(true);
    try {
      const pickedAt = (form.dateEdited ? new Date(form.pickedAt) : new Date()).toISOString();
      await onAdd({ lotId: row.lot.id, quantity: n, pickedAt, driver: form.driver, truckModel: form.truckModel, plate: form.plate, notes: form.notes });
      setForm((f) => ({ ...EMPTY, pickedAt: toLocalInput(), driver: f.driver, truckModel: f.truckModel, plate: f.plate }));
      setTouched({});
      setSubmitted(false);
    } catch (err) {
      setServerError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="rt-form" onSubmit={submit} noValidate>
      <div className="grid">
        <div className={fieldClass("pickedAt", " wide")}>
          <label htmlFor="rt-pickedAt">Data e hora da retirada</label>
          <DateTimePicker id="rt-pickedAt" value={form.pickedAt} invalid={Boolean(show("pickedAt"))} describedBy="rt-pickedAt-err"
            onBlur={() => touch("pickedAt")}
            onChange={(v) => setForm((f) => ({ ...f, pickedAt: v, dateEdited: true }))}
            badge={form.dateEdited ? <span className="dt-edit">Ajustado</span> : <span className="dt-auto">Automático</span>} />
          <FieldError id="rt-pickedAt-err" message={show("pickedAt")} />
          {form.dateEdited && !show("pickedAt") && (
            <p className="hint">Ajustado manualmente. <button type="button" className="linkbtn"
              onClick={() => setForm((f) => ({ ...f, pickedAt: toLocalInput(), dateEdited: false }))}>Usar agora</button></p>
          )}
        </div>
        <div className={fieldClass("quantity", " wide")}>
          <label htmlFor="rt-quantity">Cabeças retiradas</label>
          <div className="rt-qty">
            <NumberStepper id="rt-quantity" value={form.quantity} onChange={(v) => set("quantity", v)} onBlur={() => touch("quantity")}
              min={1} max={Math.max(1, saldo)} unit="cab." invalid={Boolean(show("quantity"))} describedBy="rt-quantity-err" />
            <button type="button" className="rt-all" onClick={() => set("quantity", String(saldo))}>Todo o saldo ({saldo})</button>
          </div>
          <FieldError id="rt-quantity-err" message={show("quantity")} />
        </div>
      </div>

      <div className="truck-box">
        <div className="tb-head">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 6h12v9H2zm12 3h4l3 3v3h-7zM6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm11 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" /></svg>
          <strong>Caminhão do comprador</strong>
          <div className="tb-actions">
            {lastTruck && !form.driver && !form.plate && (
              <button type="button" className="linkbtn" onClick={() => setForm((f) => ({ ...f, ...lastTruck }))}>Usar o último ({lastTruck.plate})</button>
            )}
          </div>
        </div>
        <div className="grid tb-grid">
          <div className={fieldClass("driver")}>
            <label htmlFor="rt-driver">Motorista</label>
            <input id="rt-driver" autoComplete="off" placeholder="Nome do motorista" maxLength={80}
              aria-invalid={show("driver") ? "true" : "false"} aria-describedby="rt-driver-err"
              value={form.driver} onChange={(e) => set("driver", e.target.value)} onBlur={() => touch("driver")} />
            <FieldError id="rt-driver-err" message={show("driver")} />
          </div>
          <div className={fieldClass("truckModel")}>
            <label htmlFor="rt-truckModel">Modelo</label>
            <input id="rt-truckModel" autoComplete="off" placeholder="Ex.: Volvo FH 540" maxLength={60}
              aria-invalid={show("truckModel") ? "true" : "false"} aria-describedby="rt-truckModel-err"
              value={form.truckModel} onChange={(e) => set("truckModel", e.target.value)} onBlur={() => touch("truckModel")} />
            <FieldError id="rt-truckModel-err" message={show("truckModel")} />
          </div>
          <div className={fieldClass("plate")}>
            <label htmlFor="rt-plate">Placa</label>
            <input id="rt-plate" className="plate-input" autoComplete="off" placeholder="ABC1D23" maxLength={8}
              aria-invalid={show("plate") ? "true" : "false"} aria-describedby="rt-plate-err"
              value={form.plate} onChange={(e) => set("plate", maskPlate(e.target.value))} onBlur={() => touch("plate")} />
            <FieldError id="rt-plate-err" message={show("plate")} />
          </div>
        </div>
      </div>

      <div className={fieldClass("notes")}>
        <label htmlFor="rt-notes">Observações <span className="opt">(opcional)</span></label>
        <textarea id="rt-notes" rows={2} maxLength={300} placeholder="Ex.: 2 animais ficam para a próxima viagem"
          value={form.notes} onChange={(e) => set("notes", e.target.value)} onBlur={() => touch("notes")} />
        <FieldError id="rt-notes-err" message={show("notes")} />
      </div>

      {serverError && (
        <div className="vbox" role="alert">
          <span className="vbox-ico" aria-hidden="true">!</span>
          <div><strong>Não foi possível registrar</strong><p>{serverError}</p></div>
        </div>
      )}
      <button type="submit" className="rt-submit" disabled={saving}>{saving ? "Registrando…" : "Registrar retirada"}</button>
    </form>
  );
}

/* ---------- Tela de retirada ---------- */
export default function RetiradaBoard({ lots, entries, pickups, onAdd, onRemove, goToPista }) {
  const [filter, setFilter] = useState("OPEN");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);

  const entriesById = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);
  const rows = useMemo(() => lots
    .filter((l) => l.kind !== "REFUGO" && l.pista?.status === "ARREMATADO")
    .sort((a, b) => a.lot - b.lot)
    .map((l) => {
      const s = summarize(l.entryIds.map((id) => entriesById.get(id)).filter(Boolean));
      const heads = l.heads ?? s.quantity;
      const picked = l.pickedUp ?? 0;
      return { lot: l, s, heads, picked, saldo: Math.max(0, heads - picked) };
    }), [lots, entriesById]);

  useEffect(() => {
    if (!selected && rows.length) setSelected((rows.find((r) => r.saldo > 0) ?? rows[0]).lot.id);
  }, [rows, selected]);

  // saldo geral, amarrado ao desembarque
  const landed = entries.reduce((s, e) => s + Number(e.quantity || 0), 0);
  const sold = rows.reduce((s, r) => s + r.heads, 0);
  const pickedTotal = rows.reduce((s, r) => s + r.picked, 0);
  const toPick = sold - pickedTotal;
  const inYard = landed - pickedTotal;
  const lastTruck = pickups[0] ? { driver: pickups[0].driver, truckModel: pickups[0].truckModel, plate: pickups[0].plate } : null;

  const q = query.trim().toLowerCase();
  const visible = rows.filter((r) =>
    (filter === "ALL" || (filter === "OPEN" ? r.saldo > 0 : r.saldo === 0)) &&
    (!q || String(r.lot.lot) === q.replace(/^0+(?=\d)/, "") || (r.lot.pista?.buyer ?? "").toLowerCase().includes(q) || r.lot.farm.toLowerCase().includes(q))
  );
  const counts = { OPEN: rows.filter((r) => r.saldo > 0).length, DONE: rows.filter((r) => r.saldo === 0).length, ALL: rows.length };
  const current = rows.find((r) => r.lot.id === selected);
  const currentPickups = current ? pickups.filter((p) => p.lotId === current.lot.id) : [];

  async function remove(p) {
    if (!window.confirm(`Desfazer a retirada de ${p.quantity} cabeças do lote ${pad(p.lot)}? O saldo volta para o lote.`)) return;
    await onRemove(p);
  }

  if (!rows.length) {
    return (
      <div className="empty-card big">
        <strong>Nenhum lote arrematado ainda</strong>
        <p>A retirada aparece para os lotes marcados como “Arrematado” na Pista.</p>
        {goToPista && <button type="button" className="btn-sec" onClick={goToPista}>Ir para a Pista <Icon name="arrowRight" /></button>}
      </div>
    );
  }

  return (
    <div className="rt">
      <dl className="rt-stats">
        <div><dt>Desembarcadas</dt><dd>{fmt(landed)}</dd><span className="ps-sub">total que entrou no recinto</span></div>
        <div><dt>Arrematadas</dt><dd>{fmt(sold)}</dd><span className="ps-sub">em {rows.length} {rows.length === 1 ? "lote" : "lotes"}</span></div>
        <div className="c-ok"><dt>Retiradas</dt><dd>{fmt(pickedTotal)}</dd><span className="ps-sub">{pickups.length} {pickups.length === 1 ? "retirada" : "retiradas"}</span></div>
        <div className={toPick ? "c-warn" : "c-ok"}><dt>Saldo a retirar</dt><dd>{fmt(toPick)}</dd><span className="ps-sub">arrematadas − retiradas</span></div>
        <div className="hl"><dt>No recinto agora</dt><dd>{fmt(inYard)}</dd><span className="ps-sub">desembarcadas − retiradas</span></div>
      </dl>

      <div className="rt-main">
        <section className="rt-list" aria-label="Lotes arrematados">
          <header className="rt-list-head">
            <h2>Lotes arrematados</h2>
            <div className="chips-row" role="group" aria-label="Filtrar">
              {FILTERS.map((f) => (
                <button key={f.id} type="button" className={`kchip${filter === f.id ? " on" : ""}`} aria-pressed={filter === f.id}
                  onClick={() => setFilter(f.id)}>{f.label} <em>{counts[f.id]}</em></button>
              ))}
            </div>
            <label className="lb-search">
              <span className="sr">Buscar por lote, comprador ou fazenda</span>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4a6 6 0 1 0 3.7 10.7l4.8 4.8 1.4-1.4-4.8-4.8A6 6 0 0 0 10 4zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8z" /></svg>
              <input placeholder="Lote, comprador ou fazenda" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
          </header>
          {visible.length === 0 ? (
            <p className="g-empty">Nenhum lote neste filtro.</p>
          ) : (
            <ul className="rt-cards">
              {visible.map((r) => {
                const pct = r.heads ? Math.round((r.picked / r.heads) * 100) : 0;
                return (
                  <li key={r.lot.id}>
                    <button type="button" className={`rt-card${selected === r.lot.id ? " on" : ""}${r.saldo === 0 ? " done" : ""}`}
                      aria-pressed={selected === r.lot.id} onClick={() => setSelected(r.lot.id)}>
                      <span className="rc-no"><small>Lote</small>{pad(r.lot.lot)}</span>
                      <span className="rc-body">
                        <strong>{r.lot.pista?.buyer || "Comprador"}</strong>
                        <span>{lotTitle(r.s)} · {r.lot.farm}</span>
                        <span className="rc-bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
                        <span className="rc-nums">{r.picked} de {r.heads} retiradas</span>
                      </span>
                      <span className={`rc-saldo${r.saldo === 0 ? " zero" : ""}`}>
                        {r.saldo === 0 ? "Concluído" : <><b>{r.saldo}</b> a retirar</>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="rt-detail">
          {current && (
            <div className="detail-card" key={current.lot.id}>
              <header className="dh linked">
                <span className="dh-no"><small>Lote</small>{pad(current.lot.lot)}</span>
                <span className="dh-status">{current.saldo === 0 ? "Retirada concluída" : `Saldo: ${current.saldo}`}</span>
              </header>
              <div className="rt-info">
                <p className="ld-farm">Comprador</p>
                <h3>{current.lot.pista?.buyer}</h3>
                <dl className="ld-stats">
                  <div><dt>No lote</dt><dd>{current.heads}</dd></div>
                  <div><dt>Retiradas</dt><dd>{current.picked}</dd></div>
                  <div><dt>Prazo</dt><dd>{current.lot.pista?.term || "—"}</dd></div>
                </dl>
                <p className="rt-origin">{lotTitle(current.s)} · {current.s.breeds.map(label).join(" / ")} · {current.lot.farm}</p>
              </div>
              {current.saldo > 0 ? (
                <PickupForm key={`${current.lot.id}-${current.picked}`} row={current} lastTruck={lastTruck} onAdd={onAdd} />
              ) : (
                <div className="rt-done">Todo o gado deste lote já foi retirado.</div>
              )}
              {currentPickups.length > 0 && (
                <div className="rt-hist-lot">
                  <h4>Retiradas deste lote</h4>
                  <ul>
                    {currentPickups.map((p) => (
                      <li key={p.id}>
                        <span><b>{p.quantity} cab.</b> · {formatDateTime(p.pickedAt)}</span>
                        <span className="rt-truck"><span className="plate-tag">{p.plate}</span> {p.driver}</span>
                        <button type="button" className="linkbtn" onClick={() => remove(p)}>Desfazer</button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>

      <section className="rt-history">
        <h2>Histórico de retiradas</h2>
        {pickups.length === 0 ? (
          <p className="g-empty">Nenhuma retirada registrada ainda.</p>
        ) : (
          <div className="tbl">
            <table>
              <thead><tr><th>Data e hora</th><th>Lote</th><th>Comprador</th><th>Cabeças</th><th>Motorista</th><th>Caminhão</th><th>Observações</th></tr></thead>
              <tbody>
                {pickups.map((p) => (
                  <tr key={p.id}>
                    <td className="nowrap">{formatDateTime(p.pickedAt)}</td>
                    <td><span className="lot-pill">Lote {pad(p.lot)}</span></td>
                    <td>{p.buyer}</td>
                    <td>{p.quantity}</td>
                    <td>{p.driver}</td>
                    <td className="nowrap"><span className="plate-tag">{p.plate}</span> {p.truckModel}</td>
                    <td>{p.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
