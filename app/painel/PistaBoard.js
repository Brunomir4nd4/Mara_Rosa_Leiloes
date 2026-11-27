"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { label, lotTitle, summarize } from "../../lib/catalog";
import { EMPTY_PISTA, PISTA_STATUS, STATUS_INFO, TERMS, brl, validatePista } from "../../lib/pista";
import LotPicker from "./LotPicker";

const pad = (n) => String(n).padStart(2, "0");
const fmt = (n) => n.toLocaleString("pt-BR");
const FILTERS = [{ id: "ALL", label: "Todos" }, ...PISTA_STATUS.map((s) => ({ id: s, label: STATUS_INFO[s].short }))];

// Campo de dinheiro: digita só números e o valor aparece formatado (R$ 12.345,00); guarda centavos
function MoneyInput({ id, value, onChange, invalid, describedBy, autoFocus }) {
  const shown = value == null ? "" : (value / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <div className={`money${invalid ? " invalid" : ""}`}>
      <span aria-hidden="true">R$</span>
      <input id={id} inputMode="numeric" autoComplete="off" placeholder="0,00" value={shown} autoFocus={autoFocus}
        aria-invalid={invalid ? "true" : "false"} aria-describedby={describedBy}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 12);
          onChange(digits ? Number(digits) : null);
        }} />
    </div>
  );
}

const perHead = (cents, qty) => (cents && qty ? `${brl(Math.round(cents / qty))} por cabeça` : "");

function Field({ id, label: text, error, help, children, wide }) {
  return (
    <div className={`fld${error ? " has-err" : ""}${wide ? " wide" : ""}`}>
      <label htmlFor={id}>{text}</label>
      {children}
      {error ? <p className="ferr" id={`${id}-err`} role="alert">{error}</p> : help ? <p className="hint">{help}</p> : null}
    </div>
  );
}

/* ---------- Console do lote em pista ---------- */
function RingConsole({ lot, summary, entryRows, rows, index, onSave, onNavigate, onPick, onDirty }) {
  const [form, setForm] = useState({ ...EMPTY_PISTA, ...(lot.pista ?? {}) });
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);

  const errors = submitted ? validatePista(form) : {};
  const set = (key, value) => { setForm((f) => ({ ...f, [key]: value })); setServerError(""); };
  const original = JSON.stringify({ ...EMPTY_PISTA, ...(lot.pista ?? {}) });
  const dirty = JSON.stringify(form) !== original;
  const q = summary.quantity;

  // avisa a tela quando há alterações não salvas (para confirmar antes de trocar de lote)
  useEffect(() => { onDirty?.(dirty); }, [dirty, onDirty]);

  async function save(goNext) {
    setSubmitted(true);
    const errs = validatePista(form);
    const firstKey = ["status", "value", "buyer", "term", "proposal", "ownerAsk"].find((k) => errs[k]);
    if (firstKey) { document.getElementById(`ps-${firstKey}`)?.focus(); return; }
    setSaving(true);
    try {
      await onSave(lot, form);
      setSubmitted(false);
      if (goNext) onNavigate(1, true);
    } catch (err) {
      setServerError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const gap = form.status === "DEFENDIDO" && form.ownerAsk && form.proposal && form.ownerAsk > form.proposal
    ? form.ownerAsk - form.proposal : null;

  return (
    <section className={`ring st-${form.status.toLowerCase()}`} aria-labelledby="ring-title">
      <div className="ring-lot">
        <span className="ring-kicker">Lote na pista</span>
        <div className="ring-no" id="ring-title"><small>Lote</small>{pad(lot.lot)}</div>
        <div className="ring-nav">
          <button type="button" onClick={() => onNavigate(-1)} disabled={index === 0} aria-label="Lote anterior">‹</button>
          <LotPicker rows={rows} currentId={lot.id} onPick={onPick} />
          <button type="button" onClick={() => onNavigate(1)} disabled={index === rows.length - 1} aria-label="Próximo lote">›</button>
        </div>
        <h3>{lotTitle(summary)}</h3>
        <dl className="ring-data">
          <div className="full"><dt>Fazenda</dt><dd>{lot.farm}</dd></div>
          <div><dt>Qtd.</dt><dd>{fmt(q)}</dd></div>
          <div><dt>Idade</dt><dd>{summary.ageMin === summary.ageMax ? summary.ageMin : `${summary.ageMin}–${summary.ageMax}`} m</dd></div>
          <div className="full"><dt>Sexo / Tipo</dt><dd>{[...new Set(entryRows.map((e) => label(e.sexType)))].join(" + ")}</dd></div>
          <div className="full"><dt>Raça</dt><dd>{summary.breeds.map(label).join(" / ")}</dd></div>
        </dl>
        <p className="ring-lock">Dados do desembarque · não editáveis aqui</p>
      </div>

      <form className="ring-form" noValidate onSubmit={(e) => { e.preventDefault(); save(true); }}>
        <fieldset className="ring-status">
          <legend>Situação do lote</legend>
          <div className="seg" id="ps-status" tabIndex={-1}>
            {PISTA_STATUS.map((s) => (
              <label key={s} className={`seg-opt so-${s.toLowerCase()}${form.status === s ? " on" : ""}`}>
                <input type="radio" name="ps-status" value={s} checked={form.status === s} onChange={() => set("status", s)} />
                <span className="seg-dot" aria-hidden="true" />
                {STATUS_INFO[s].label}
              </label>
            ))}
          </div>
          <p className="seg-hint">{STATUS_INFO[form.status].hint}</p>
        </fieldset>

        <div className="ring-grid" key={form.status}>
          {form.status === "ARREMATADO" && (
            <>
              <Field id="ps-value" label="Valor do lote (arremate)" error={errors.value} help={perHead(form.value, q)}>
                <MoneyInput id="ps-value" value={form.value} onChange={(v) => set("value", v)} invalid={!!errors.value} describedBy="ps-value-err" />
              </Field>
              <Field id="ps-buyer" label="Comprador" error={errors.buyer}>
                <input id="ps-buyer" autoComplete="off" placeholder="Nome do comprador" maxLength={120} value={form.buyer}
                  aria-invalid={errors.buyer ? "true" : "false"} aria-describedby="ps-buyer-err" onChange={(e) => set("buyer", e.target.value)} />
              </Field>
              <Field id="ps-term" label="Prazo de pagamento" error={errors.term} wide>
                <div className="terms">
                  {TERMS.map((t) => (
                    <button key={t} type="button" className={form.term === t ? "on" : ""} onClick={() => set("term", t)}>{t}</button>
                  ))}
                </div>
                <input id="ps-term" autoComplete="off" placeholder="Ou digite outro prazo" maxLength={60} value={form.term}
                  aria-invalid={errors.term ? "true" : "false"} aria-describedby="ps-term-err" onChange={(e) => set("term", e.target.value)} />
              </Field>
              <Field id="ps-ownerAsk" label="Valor que o dono queria (opcional)" error={errors.ownerAsk} help={perHead(form.ownerAsk, q)}>
                <MoneyInput id="ps-ownerAsk" value={form.ownerAsk} onChange={(v) => set("ownerAsk", v)} invalid={!!errors.ownerAsk} describedBy="ps-ownerAsk-err" />
              </Field>
            </>
          )}

          {(form.status === "DEFENDIDO" || form.status === "NAO_ARREMATADO") && (
            <>
              <Field id="ps-proposal" label={`Maior proposta recebida${form.status === "NAO_ARREMATADO" ? " (opcional)" : ""}`}
                error={errors.proposal} help={perHead(form.proposal, q)}>
                <MoneyInput id="ps-proposal" value={form.proposal} onChange={(v) => set("proposal", v)} invalid={!!errors.proposal} describedBy="ps-proposal-err" />
              </Field>
              <Field id="ps-ownerAsk" label={`Valor que o dono queria${form.status === "NAO_ARREMATADO" ? " (opcional)" : ""}`}
                error={errors.ownerAsk} help={perHead(form.ownerAsk, q)}>
                <MoneyInput id="ps-ownerAsk" value={form.ownerAsk} onChange={(v) => set("ownerAsk", v)} invalid={!!errors.ownerAsk} describedBy="ps-ownerAsk-err" />
              </Field>
              {gap && (
                <div className="ps-gap wide" aria-live="polite">
                  <span>Diferença entre a proposta e o pretendido</span>
                  <strong>{brl(gap)}</strong>
                  <em>{perHead(gap, q)}</em>
                </div>
              )}
            </>
          )}

          {form.status === "AGUARDANDO" && (
            <Field id="ps-ownerAsk" label="Valor que o dono quer (opcional)" error={errors.ownerAsk}
              help={form.ownerAsk ? perHead(form.ownerAsk, q) : "Se o dono já informou o valor mínimo, anote aqui antes do lote entrar."} wide>
              <MoneyInput id="ps-ownerAsk" value={form.ownerAsk} onChange={(v) => set("ownerAsk", v)} invalid={!!errors.ownerAsk} describedBy="ps-ownerAsk-err" />
            </Field>
          )}
        </div>

        {serverError && (
          <div className="vbox" role="alert">
            <span className="vbox-ico" aria-hidden="true">!</span>
            <div><strong>Não foi possível salvar</strong><p>{serverError}</p></div>
          </div>
        )}

        <div className="ring-actions">
          <span className={`ring-dirty${dirty ? " on" : ""}`}>{dirty ? "Alterações não salvas" : lot.pista?.updatedAt ? "Salvo" : ""}</span>
          <button type="button" className="ghost" onClick={() => save(false)} disabled={saving || !dirty}>Salvar</button>
          <button type="submit" className="primary" disabled={saving}>
            {saving ? "Salvando…" : index === rows.length - 1 ? "Salvar lote" : "Salvar e próximo lote →"}
          </button>
        </div>
      </form>
    </section>
  );
}

/* ---------- Tela da Pista ---------- */
export default function PistaBoard({ lots, entries, onSave, goToLotes }) {
  const [current, setCurrent] = useState(null);
  const [filter, setFilter] = useState("ALL");
  const [query, setQuery] = useState("");

  const entriesById = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);
  const rowsOf = (lot) => lot.entryIds.map((id) => entriesById.get(id)).filter(Boolean);
  // alterações não salvas no lote aberto (para confirmar antes de trocar)
  const dirtyRef = useRef(false);
  const onDirty = useRef((d) => { dirtyRef.current = d; }).current;

  const rows = useMemo(
    () => [...lots].sort((a, b) => a.lot - b.lot).map((l) => ({ lot: l, s: summarize(rowsOf(l)), status: l.pista?.status ?? "AGUARDANDO" })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lots, entriesById]
  );

  // começa no último lote aberto (sessão) ou no primeiro que ainda está aguardando
  useEffect(() => {
    if (current == null && rows.length) {
      let saved = null;
      try { saved = sessionStorage.getItem("pista:lote"); } catch {}
      const found = rows.find((r) => r.lot.id === saved);
      setCurrent((found ?? rows.find((r) => r.status === "AGUARDANDO") ?? rows[0]).lot.id);
    }
  }, [rows, current]);
  useEffect(() => {
    if (current) { try { sessionStorage.setItem("pista:lote", current); } catch {} }
  }, [current]);

  if (!rows.length) {
    return (
      <div className="empty-card big">
        <strong>Nenhum lote vinculado ainda</strong>
        <p>A pista mostra os lotes já vinculados a uma fazenda. Vincule os lotes primeiro.</p>
        <button type="button" className="btn-sec" onClick={goToLotes}>Ir para Lotes →</button>
      </div>
    );
  }

  const index = Math.max(0, rows.findIndex((r) => r.lot.id === current));
  const active = rows[index];

  // navegação: ao salvar e avançar, pula para o próximo lote ainda aguardando (se houver)
  function navigate(step, afterSave) {
    if (afterSave) {
      const next = rows.slice(index + 1).find((r) => r.status === "AGUARDANDO") ?? rows[index + 1];
      dirtyRef.current = false;
      if (next) setCurrent(next.lot.id);
      return;
    }
    const target = rows[index + step];
    if (target) go(target.lot.id);
  }

  // troca de lote pedindo confirmação se houver alterações não salvas
  function go(id) {
    if (id === active.lot.id) return;
    if (dirtyRef.current && !window.confirm(`O lote ${pad(active.lot.lot)} tem alterações não salvas. Descartar e abrir outro lote?`)) return;
    dirtyRef.current = false;
    setCurrent(id);
  }

  const count = (s) => rows.filter((r) => r.status === s).length;
  const sold = rows.filter((r) => r.status === "ARREMATADO");
  const revenue = sold.reduce((t, r) => t + (r.lot.pista.value ?? 0), 0);
  const soldHeads = sold.reduce((t, r) => t + r.s.quantity, 0);
  const done = rows.length - count("AGUARDANDO");

  const q = query.trim().toLowerCase();
  const visible = rows.filter((r) =>
    (filter === "ALL" || r.status === filter) &&
    (!q || String(r.lot.lot) === q.replace(/^0+(?=\d)/, "") || r.lot.farm.toLowerCase().includes(q) ||
      (r.lot.pista?.buyer ?? "").toLowerCase().includes(q))
  );

  const sexCol = (lot) => [...new Set(rowsOf(lot).map((e) => e.sexType))].join(" + ");
  const ageCol = (s) => (s.ageMin === s.ageMax ? s.ageMin : `${s.ageMin}–${s.ageMax}`);

  return (
    <div className="pista">
      <dl className="ps-stats">
        <div className="hl">
          <dt>Andamento</dt>
          <dd>{done}<small> de {rows.length} lotes</small></dd>
          <span className="lb-prog" aria-hidden="true"><span style={{ width: `${Math.round((done / rows.length) * 100)}%` }} /></span>
        </div>
        <div className="c-arr"><dt>Arrematados</dt><dd>{count("ARREMATADO")}</dd></div>
        <div className="c-def"><dt>Defendidos</dt><dd>{count("DEFENDIDO")}</dd></div>
        <div className="c-nao"><dt>Não arrematados</dt><dd>{count("NAO_ARREMATADO")}</dd></div>
        <div className="money-stat">
          <dt>Total arrematado</dt><dd>{brl(revenue)}</dd>
          <span className="ps-sub">{soldHeads ? `${brl(Math.round(revenue / soldHeads))} por cabeça (média)` : "Nenhum lote vendido ainda"}</span>
        </div>
      </dl>

      <RingConsole key={active.lot.id + (active.lot.pista?.updatedAt ?? "")} lot={active.lot} summary={active.s} entryRows={rowsOf(active.lot)}
        rows={rows} index={index} onSave={onSave} onNavigate={navigate} onPick={go} onDirty={onDirty} />

      <section className="listing" aria-labelledby="listing-title">
        <header className="listing-head">
          <h2 id="listing-title"><span aria-hidden="true">✶✶✶</span> Listagem de lotes <span aria-hidden="true">✶✶✶</span></h2>
          <div className="listing-tools">
            <div className="chips-row" role="group" aria-label="Filtrar por situação">
              {FILTERS.map((f) => (
                <button key={f.id} type="button" className={`fchip${filter === f.id ? " on" : ""}${f.id !== "ALL" ? ` fc-${f.id.toLowerCase()}` : ""}`}
                  aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                  {f.label} <em>{f.id === "ALL" ? rows.length : count(f.id)}</em>
                </button>
              ))}
            </div>
            <label className="lb-search">
              <span className="sr">Buscar por lote, fazenda ou comprador</span>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4a6 6 0 1 0 3.7 10.7l4.8 4.8 1.4-1.4-4.8-4.8A6 6 0 0 0 10 4zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8z" /></svg>
              <input placeholder="Buscar lote, fazenda…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <div className="report-btns">
              <a className="btn-tool" href="/painel/relatorio" target="_blank" rel="noopener">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5c-5 0-9 4.5-10 7 1 2.5 5 7 10 7s9-4.5 10-7c-1-2.5-5-7-10-7zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm0-6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" /></svg>
                Visualizar relatório
              </a>
              <a className="btn-tool primary" href="/painel/relatorio?pdf=1" target="_blank" rel="noopener">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4h2v9l3.5-3.5 1.4 1.4L12 16.8 6.1 10.9l1.4-1.4L11 13zM5 18h14v2H5z" /></svg>
                Baixar PDF
              </a>
            </div>
          </div>
        </header>

        <div className="tbl listing-tbl">
          <table>
            <thead>
              <tr>
                <th>Lote</th><th>Fazenda</th><th>Qtd.</th><th>Sexo / Tipo</th><th>Idade</th><th>Raça</th>
                <th>Situação</th><th>Vlr lote</th><th>Comprador</th><th>Prazo</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ lot, s, status }) => (
                <tr key={lot.id} className={lot.id === active.lot.id ? "cur" : ""} tabIndex={0}
                  onClick={() => go(lot.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(lot.id); } }}
                  aria-label={`Abrir lote ${lot.lot} na pista`}>
                  <td className="c-lot">{pad(lot.lot)}</td>
                  <td>{lot.farm}</td>
                  <td>{s.quantity}</td>
                  <td>{sexCol(lot)}</td>
                  <td>{ageCol(s)}</td>
                  <td>{s.breeds.join(" / ")}</td>
                  <td><span className={`st st-${status.toLowerCase()}`}>{STATUS_INFO[status].short}</span></td>
                  <td className="num">{status === "ARREMATADO" ? brl(lot.pista.value) : status === "AGUARDANDO" ? "" : <span className="muted">prop. {brl(lot.pista?.proposal)}</span>}</td>
                  <td>{lot.pista?.buyer || ""}</td>
                  <td>{lot.pista?.term || ""}</td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr className="none"><td colSpan={10}>Nenhum lote com esse filtro.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="listing-foot">
          Categoria calculada do desembarque · {rows.map((r) => r.s.categories.map(label)).flat().filter((v, i, a) => a.indexOf(v) === i).join(", ")}
        </p>
      </section>
    </div>
  );
}
