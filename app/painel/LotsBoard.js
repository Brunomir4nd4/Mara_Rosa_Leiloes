"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ageLabel, categoryOf, isRefugo, label, lotTitle, summarize } from "../../lib/catalog";
import Select from "../_ui/Select";
import NumberStepper from "../_ui/NumberStepper";
import MediaGallery from "./MediaGallery";

const pad = (n) => String(n).padStart(2, "0");
const fmt = (n) => n.toLocaleString("pt-BR");
const SEX_TAG = { MACHO: "M", FEMEA: "F", MISTO: "M+F" };
const STATUS_TABS = [
  { id: "ALL", label: "Todos" },
  { id: "FREE", label: "Disponíveis" },
  { id: "LINKED", label: "Vinculados" },
  { id: "REFUGO", label: "Refugo" },
];
const shortFarm = (name) => name.replace(/^fazenda\s+/i, "");
const lotIsRefugo = (rec) => rec?.kind === "REFUGO";

// Ícone de + desenhado (o caractere "+" fica torto dentro de círculos por causa da fonte)
const PlusIcon = () => (
  <svg className="plus-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5h2v14h-2zM5 11h14v2H5z" /></svg>
);

function entryLine(e) {
  return `${fmt(Number(e.quantity))} ${label(categoryOf(e.sexType, e.ageMonths))} · ${label(e.breed)} · ${e.ageMonths} m${e.quality ? ` · ${label(e.quality)}` : ""}`;
}

function useDialog(open) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (open && d && !d.open) d.showModal();
    if (!open && d?.open) d.close();
  }, [open]);
  return ref;
}

/* ---------- Vincular um lote disponível ---------- */
function LinkForm({ lot, farms, available, onLink, goToDesembarque }) {
  // gado sem lote separado por tipo (lote de refugo só recebe refugo)
  const byKind = (kind) => {
    const m = new Map();
    for (const [farm, list] of available) {
      const l = list.filter((e) => (kind === "REFUGO") === isRefugo(e));
      if (l.length) m.set(farm, l);
    }
    return m;
  };
  const normal = byKind("NORMAL");
  const refugo = byKind("REFUGO");

  const [kind, setKind] = useState(normal.size || !refugo.size ? "NORMAL" : "REFUGO");
  const [farm, setFarm] = useState("");
  const [picked, setPicked] = useState(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);

  const pool = kind === "REFUGO" ? refugo : normal;
  const farmOptions = farms.map((f) => {
    const n = (pool.get(f.farmName) ?? []).length;
    return { value: f.farmName, label: f.farmName, hint: n ? `${n} sem lote` : "sem gado", disabled: !n };
  });

  // Nada para vincular: mostra só o aviso com o atalho para o desembarque
  if (!normal.size && !refugo.size) {
    return (
      <div className="lk-none">
        <span className="lk-none-ico" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M3 7h18v2H3zm2 4h14v8H5zm2 2v4h10v-4z" /></svg>
        </span>
        <strong>Nenhum gado sem lote</strong>
        <p>Todo o gado do desembarque já está em lotes. Registre um novo desembarque para ocupar o lote {pad(lot)}.</p>
        <button type="button" className="btn-sec" onClick={goToDesembarque}>Registrar desembarque →</button>
      </div>
    );
  }

  const farmEntries = farm ? pool.get(farm) ?? [] : [];

  function chooseKind(k) {
    setKind(k);
    setFarm("");
    setPicked(new Set());
    setSubmitted(false);
    setServerError("");
  }

  function chooseFarm(name) {
    setFarm(name);
    setPicked(new Set((pool.get(name) ?? []).map((e) => e.id))); // já marca todos
    setServerError("");
  }

  function toggle(id) {
    setPicked((p) => {
      const next = new Set(p);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setServerError("");
  }

  const errors = {
    farm: farm ? "" : "Escolha a fazenda que vai ocupar este lote.",
    entries: !farm || picked.size ? "" : "Marque pelo menos um registro do desembarque.",
  };
  const chosen = farmEntries.filter((e) => picked.has(e.id));
  const preview = chosen.length ? summarize(chosen) : null;

  async function submit(e) {
    e.preventDefault();
    setSubmitted(true);
    if (errors.farm) { document.getElementById("lk-farm")?.focus(); return; }
    if (errors.entries) return;
    setSaving(true);
    try {
      await onLink({ lot, farm, entryIds: [...picked] });
    } catch (err) {
      setServerError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={`lk${kind === "REFUGO" ? " is-refugo" : ""}`} onSubmit={submit} noValidate>
      <div className="lk-step">
        <span className="lk-n">1</span>
        <fieldset className="lk-kind">
          <legend>Tipo do lote</legend>
          <div className="lk-kind-opts">
            {[["NORMAL", "Lote normal", normal], ["REFUGO", "Lote de refugo", refugo]].map(([k, text, m]) => (
              <label key={k} className={`${kind === k ? "on" : ""}${k === "REFUGO" ? " k-refugo" : ""}${m.size ? "" : " off"}`}>
                <input type="radio" name="lk-kind" checked={kind === k} disabled={!m.size} onChange={() => chooseKind(k)} />
                <span>{text}</span>
                <em>{m.size ? (() => { const n = [...m.values()].flat().length; return `${n} ${n === 1 ? "registro" : "registros"} sem lote`; })() : "nenhum registro"}</em>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="lk-step">
        <span className="lk-n">2</span>
        <div className={`fld${submitted && errors.farm ? " has-err" : ""}`}>
          <label htmlFor="lk-farm">Fazenda</label>
          <Select key={kind} id="lk-farm" value={farm} onChange={chooseFarm} options={farmOptions} placeholder="Selecione…"
            invalid={Boolean(submitted && errors.farm)} describedBy="lk-farm-err" />
          {submitted && errors.farm && <p className="ferr" id="lk-farm-err" role="alert">{errors.farm}</p>}
        </div>
      </div>

      <div className={`lk-step${farm ? "" : " off"}`}>
        <span className="lk-n">3</span>
        <fieldset className={`lk-entries${submitted && errors.entries ? " has-err" : ""}`} disabled={!farm} aria-describedby="lk-entries-err">
          <legend>{kind === "REFUGO" ? "Refugo do desembarque" : "Gado do desembarque"}</legend>
          {!farm ? (
            <p className="lk-wait">Escolha a fazenda para ver o gado sem lote.</p>
          ) : (
            <>
              <div className="lk-all">
                <button type="button" className="linkbtn" onClick={() => setPicked(new Set(farmEntries.map((e) => e.id)))}>Marcar todos</button>
                <button type="button" className="linkbtn" onClick={() => setPicked(new Set())}>Limpar</button>
              </div>
              {farmEntries.map((e) => (
                <label key={e.id} className={`ecard${picked.has(e.id) ? " on" : ""}${isRefugo(e) ? " refugo" : ""}`}>
                  <input type="checkbox" checked={picked.has(e.id)} onChange={() => toggle(e.id)} />
                  <span className="ecard-box" aria-hidden="true" />
                  <span className="ecard-txt">
                    {entryLine(e)}
                    {isRefugo(e) && (
                      <span className="ecard-ref">
                        {label(e.reason)}{e.media?.length ? ` · ${e.media.length} ${e.media.length === 1 ? "anexo" : "anexos"}` : " · sem anexos"}
                      </span>
                    )}
                  </span>
                </label>
              ))}
              {submitted && errors.entries && <p className="ferr" id="lk-entries-err" role="alert">{errors.entries}</p>}
            </>
          )}
        </fieldset>
      </div>

      {preview && (
        <div className="lk-preview" aria-live="polite">
          <span className="lk-pv-label">Como o lote {pad(lot)} vai aparecer</span>
          <strong>{lotTitle(preview)}{kind === "REFUGO" && <span className="rf-tag">Refugo</span>}</strong>
          <span>{preview.categories.map(label).join(" · ")} — {ageLabel(preview.ageMin, preview.ageMax)}</span>
          {kind === "REFUGO" && preview.reasons.length > 0 && <span className="lk-pv-ref">Motivos: {preview.reasons.map(label).join(", ")}</span>}
        </div>
      )}

      {serverError && (
        <div className="vbox" role="alert">
          <span className="vbox-ico" aria-hidden="true">!</span>
          <div><strong>Não foi possível vincular</strong><p>{serverError}</p></div>
        </div>
      )}

      <button type="submit" className="lk-submit" disabled={saving}>
        {saving ? "Vinculando…" : `Vincular ${kind === "REFUGO" ? "refugo " : ""}ao lote ${pad(lot)}`}
      </button>
    </form>
  );
}

/* ---------- Lote vinculado (com dados do desembarque e anexos) ---------- */
function LinkedDetail({ record, entries, onAskUnlink, onEntryChange }) {
  const s = summarize(entries);
  const refugo = lotIsRefugo(record);
  return (
    <div className="ld">
      <p className="ld-farm">{record.farm}</p>
      <h3>{lotTitle(s)}{refugo && <span className="rf-tag">Refugo</span>}</h3>
      <dl className="ld-stats">
        <div><dt>Machos</dt><dd>{fmt(s.males)}</dd></div>
        <div><dt>Fêmeas</dt><dd>{fmt(s.females)}</dd></div>
        <div><dt>Idade</dt><dd>{ageLabel(s.ageMin, s.ageMax)}</dd></div>
      </dl>
      <h4>Composição (desembarque)</h4>
      <ul className="ld-list">
        {entries.map((e) => (
          <li key={e.id} className={isRefugo(e) ? "refugo" : ""}>
            <span className="ld-line">{entryLine(e)}</span>
            {isRefugo(e) && (
              <>
                <span className="ld-ref">{label(e.reason)}</span>
                {e.notes && <span className="ld-notes">“{e.notes}”</span>}
              </>
            )}
            {(isRefugo(e) || e.media?.length > 0) && (
              <MediaGallery entry={e} onChange={onEntryChange} editable compact />
            )}
          </li>
        ))}
      </ul>
      <button type="button" className="danger" onClick={onAskUnlink}>Desvincular lote</button>
    </div>
  );
}

/* ---------- Adicionar / remover lotes ---------- */
function CapacityDialog({ open, onClose, total, max, trailingFree, onChange }) {
  const ref = useDialog(open);
  const [mode, setMode] = useState("add");
  const [value, setValue] = useState("10");
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setMode("add"); setValue("10"); setSubmitted(false); setServerError(""); }
  }, [open]);

  const limit = mode === "add" ? max - total : trailingFree;
  const n = Number(value);
  let error = "";
  if (value === "" || !Number.isInteger(n) || n < 1) error = "Informe um número inteiro maior que zero.";
  else if (mode === "add" && n > limit) error = limit ? `Dá para adicionar no máximo ${limit} (limite de ${max} lotes).` : `O leilão já tem o máximo de ${max} lotes.`;
  else if (mode === "remove" && n > limit) error = limit ? `Só ${limit === 1 ? "o último lote está disponível" : `os últimos ${limit} lotes estão disponíveis`} para remover.` : "";

  const from = mode === "add" ? total + 1 : total - n + 1;
  const to = mode === "add" ? total + n : total;

  async function submit(e) {
    e.preventDefault();
    setSubmitted(true);
    if (error || (mode === "remove" && !trailingFree)) return;
    setSaving(true);
    try {
      await onChange(mode === "add" ? n : -n);
      onClose();
    } catch (err) {
      setServerError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const chips = mode === "add" ? [5, 10, 20, 50] : [1, 5, 10];

  return (
    <dialog ref={ref} className="cap" onClose={onClose} aria-labelledby="cap-title">
      <form onSubmit={submit} noValidate className="cap-form">
        <header className="cap-head">
          <div>
            <h3 id="cap-title">Quantidade de lotes</h3>
            <p>Hoje o leilão tem <b>{total}</b> lotes (máximo {max}).</p>
          </div>
          <button type="button" className="cap-x" onClick={onClose} aria-label="Fechar">✕</button>
        </header>

        <div className="cap-tabs" role="tablist" style={{ "--idx": mode === "add" ? 0 : 1 }}>
          <span className="cap-ind" aria-hidden="true" />
          <button type="button" role="tab" aria-selected={mode === "add"} className={mode === "add" ? "on" : ""}
            onClick={() => { setMode("add"); setValue("10"); setSubmitted(false); setServerError(""); }}>Adicionar</button>
          <button type="button" role="tab" aria-selected={mode === "remove"} className={mode === "remove" ? "on" : ""}
            onClick={() => { setMode("remove"); setValue("1"); setSubmitted(false); setServerError(""); }}>Remover</button>
        </div>

        {mode === "remove" && !trailingFree ? (
          <div className="vbox info">
            <span className="vbox-ico" aria-hidden="true">i</span>
            <div>
              <strong>Não há lotes para remover</strong>
              <p>O último lote ({pad(total)}) está vinculado. Só dá para remover lotes disponíveis do final do quadro.</p>
            </div>
          </div>
        ) : (
          <>
            <div className={`fld${submitted && error ? " has-err" : ""}`}>
              <label htmlFor="cap-n">{mode === "add" ? "Quantos lotes adicionar?" : "Quantos lotes remover do final?"}</label>
              <div className="cap-row">
                <NumberStepper id="cap-n" value={value} min={1} max={Math.max(1, limit)} unit="lotes"
                  invalid={Boolean(submitted && error)} describedBy="cap-err"
                  onChange={(v) => { setValue(v); setServerError(""); }} />
                <div className="cap-chips">
                  {chips.filter((c) => c <= Math.max(limit, 1)).map((c) => (
                    <button key={c} type="button" className={Number(value) === c ? "on" : ""} onClick={() => setValue(String(c))}>
                      {mode === "add" ? "+" : "−"}{c}
                    </button>
                  ))}
                </div>
              </div>
              {submitted && error && <p className="ferr" id="cap-err" role="alert">{error}</p>}
            </div>

            {!error && (
              <div className={`cap-preview ${mode}`}>
                <div className="cap-plates" aria-hidden="true">
                  <span>{pad(from)}</span>
                  {to > from && <><i>…</i><span>{pad(to)}</span></>}
                </div>
                <div>
                  <strong>
                    {mode === "add"
                      ? (n === 1 ? `Será criado o lote ${pad(from)}` : `Serão criados os lotes ${pad(from)} a ${pad(to)}`)
                      : (n === 1 ? `Será removido o lote ${pad(to)}` : `Serão removidos os lotes ${pad(from)} a ${pad(to)}`)}
                  </strong>
                  <span>O leilão passa a ter {mode === "add" ? total + n : total - n} lotes.</span>
                </div>
              </div>
            )}
          </>
        )}

        {serverError && (
          <div className="vbox" role="alert">
            <span className="vbox-ico" aria-hidden="true">!</span>
            <div><strong>Não foi possível alterar</strong><p>{serverError}</p></div>
          </div>
        )}

        <div className="cap-actions">
          <button type="button" className="ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className={mode === "add" ? "primary" : "danger"} disabled={saving || (mode === "remove" && !trailingFree)}>
            {saving ? "Salvando…" : mode === "add" ? `Adicionar ${Number(value) > 0 ? n : ""} ${n === 1 ? "lote" : "lotes"}` : `Remover ${Number(value) > 0 ? n : ""} ${n === 1 ? "lote" : "lotes"}`}
          </button>
        </div>
      </form>
    </dialog>
  );
}

/* ---------- Tela de lotes ---------- */
export default function LotsBoard({ lots, entries, farms, total, max, onLink, onUnlink, onResize, onEntryChange, goToDesembarque }) {
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState("ALL");
  const [query, setQuery] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [capOpen, setCapOpen] = useState(false);
  const [fresh, setFresh] = useState(new Set());
  const confirmRef = useDialog(confirming);
  const detailRef = useRef(null);

  const entriesById = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);
  const byNumber = useMemo(() => new Map(lots.map((l) => [l.lot, l])), [lots]);

  // gado do desembarque que ainda não está em nenhum lote, por fazenda
  const available = useMemo(() => {
    const used = new Set(lots.flatMap((l) => l.entryIds));
    const map = new Map();
    for (const e of entries) {
      if (used.has(e.id)) continue;
      map.set(e.farm, [...(map.get(e.farm) ?? []), e]);
    }
    return map;
  }, [lots, entries]);

  const summaries = useMemo(
    () => new Map(lots.map((l) => [l.lot, summarize(l.entryIds.map((id) => entriesById.get(id)).filter(Boolean))])),
    [lots, entriesById]
  );
  const entriesOf = (record) => record.entryIds.map((id) => entriesById.get(id)).filter(Boolean);

  const linkedCount = lots.length;
  const freeCount = total - linkedCount;
  const headsInLots = [...summaries.values()].reduce((s, x) => s + x.quantity, 0);
  const waiting = [...available.values()].flat().reduce((s, e) => s + Number(e.quantity), 0);
  const progress = total ? Math.round((linkedCount / total) * 100) : 0;

  // quantos lotes disponíveis seguidos existem no final (podem ser removidos)
  let trailingFree = 0;
  for (let n = total; n >= 1 && !byNumber.has(n); n--) trailingFree++;

  // se o lote selecionado deixou de existir (lotes removidos), limpa a seleção
  useEffect(() => { if (selected && selected > total) setSelected(null); }, [selected, total]);

  function matches(n) {
    const rec = byNumber.get(n);
    if (status === "FREE" && rec) return false;
    if (status === "LINKED" && !rec) return false;
    if (status === "REFUGO" && !lotIsRefugo(rec)) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const num = q.replace(/^0+(?=\d)/, "");
    return String(n) === num || pad(n) === q || Boolean(rec?.farm.toLowerCase().includes(q));
  }

  function select(n) {
    setSelected(n);
    if (window.matchMedia("(max-width: 1100px)").matches) {
      setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }
  }

  async function confirmUnlink() {
    const rec = byNumber.get(selected);
    if (!rec) return;
    setUnlinking(true);
    try {
      await onUnlink(rec);
      setConfirming(false);
    } finally {
      setUnlinking(false);
    }
  }

  async function resize(delta) {
    const before = total;
    await onResize(delta);
    if (delta > 0) {
      // destaca os lotes novos por alguns segundos
      setStatus("ALL");
      setQuery("");
      setFresh(new Set(Array.from({ length: delta }, (_, i) => before + i + 1)));
      setTimeout(() => setFresh(new Set()), 3500);
    }
  }

  const numbers = Array.from({ length: total }, (_, i) => i + 1);
  const shown = numbers.filter(matches);
  const selRec = selected ? byNumber.get(selected) : null;
  const selSummary = selRec ? summaries.get(selRec.lot) : null;
  const counts = { ALL: total, FREE: freeCount, LINKED: linkedCount, REFUGO: lots.filter(lotIsRefugo).length };

  return (
    <div className="lb">
      <dl className="lb-stats">
        <div className="hl">
          <dt>Lotes vinculados</dt>
          <dd>{linkedCount}<small> de {total}</small></dd>
          <span className="lb-prog" aria-hidden="true"><span style={{ width: `${progress}%` }} /></span>
        </div>
        <div><dt>Lotes disponíveis</dt><dd>{freeCount}</dd></div>
        <div><dt>Cabeças em lote</dt><dd>{fmt(headsInLots)}</dd></div>
        <div className={waiting ? "warn" : ""}><dt>Cabeças sem lote</dt><dd>{fmt(waiting)}</dd></div>
      </dl>

      <div className="lb-main">
        <section className="board" aria-labelledby="board-title">
          <header className="board-head">
            <div className="bh-title">
              <h2 id="board-title">Quadro de lotes</h2>
              <p>{total} lotes · {linkedCount} vinculados · {freeCount} disponíveis</p>
            </div>
            <button type="button" className="btn-add" onClick={() => setCapOpen(true)}>
              <span aria-hidden="true"><PlusIcon /></span> Adicionar lotes
            </button>
          </header>

          <div className="board-tools">
            <div className="lb-tabs" role="tablist" aria-label="Filtrar lotes" style={{ "--idx": STATUS_TABS.findIndex((t) => t.id === status) }}>
              <span className="lb-ind" aria-hidden="true" />
              {STATUS_TABS.map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={status === t.id} className={status === t.id ? "on" : ""}
                  onClick={() => setStatus(t.id)}>{t.label} <em>{counts[t.id]}</em></button>
              ))}
            </div>
            <label className="lb-search">
              <span className="sr">Buscar pelo número do lote ou pela fazenda</span>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4a6 6 0 1 0 3.7 10.7l4.8 4.8 1.4-1.4-4.8-4.8A6 6 0 0 0 10 4zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8z" /></svg>
              <input placeholder="Nº do lote ou fazenda" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
          </div>

          {/* Legenda: só existem dois estados de lote */}
          <ul className="legend" aria-label="Legenda">
            <li><span className="sw sw-free" />Disponível</li>
            <li><span className="sw sw-linked" />Vinculado à fazenda</li>
              <li><span className="sw sw-refugo" />Lote de refugo</li>
            <li className="legend-tags"><b>M</b> machos <b>F</b> fêmeas <b>M+F</b> misto</li>
          </ul>

          {shown.length === 0 ? (
            <div className="board-empty">
              <strong>Nenhum lote encontrado</strong>
              <p>Confira o número ou o nome da fazenda.</p>
              <button type="button" className="linkbtn" onClick={() => { setQuery(""); setStatus("ALL"); }}>Limpar busca</button>
            </div>
          ) : (
            <ul className="lots" key={`${status}|${query}`}>
              {shown.map((n, i) => {
                const rec = byNumber.get(n);
                const s = rec ? summaries.get(n) : null;
                const on = selected === n;
                return (
                  <li key={n} style={{ "--i": Math.min(i, 30) }}>
                    <button type="button" className={`lt ${rec ? "is-linked" : "is-free"}${lotIsRefugo(rec) ? " is-refugo" : ""}${on ? " is-sel" : ""}${fresh.has(n) ? " is-new" : ""}`}
                      aria-pressed={on} onClick={() => select(n)}
                      aria-label={rec ? `Lote ${n}: vinculado à ${rec.farm}, ${lotTitle(s)}` : `Lote ${n}: disponível`}>
                      <span className="lt-head">
                        <span className="lt-label">Lote</span>
                        <span className="lt-no">{pad(n)}</span>
                        {rec && <span className="lt-tag">{lotIsRefugo(rec) ? "REFUGO" : SEX_TAG[s.sex]}</span>}
                        {fresh.has(n) && <span className="lt-new">Novo</span>}
                      </span>
                      <span className="lt-body">
                        {rec ? (
                          <>
                            <span className="lt-title">{lotTitle(s)}</span>
                            <span className="lt-farm" title={rec.farm}>{shortFarm(rec.farm)}</span>
                          </>
                        ) : (
                          <>
                            <span className="lt-plus" aria-hidden="true"><PlusIcon /></span>
                            <span className="lt-free">Disponível</span>
                          </>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
              {(status === "ALL" || status === "FREE") && !query && total < max && (
                <li style={{ "--i": Math.min(shown.length, 30) }}>
                  <button type="button" className="lt-addtile" onClick={() => setCapOpen(true)}>
                    <span aria-hidden="true"><PlusIcon /></span>
                    Adicionar lotes
                  </button>
                </li>
              )}
            </ul>
          )}
        </section>

        <aside className="detail" ref={detailRef} aria-live="polite">
          {!selected ? (
            <div className="detail-empty">
              <div className="de-pens" aria-hidden="true"><span /><span className="on" /><span /></div>
              <strong>Escolha um lote no quadro</strong>
              <p>Clique em um lote <b>disponível</b> para vincular a uma fazenda, ou em um lote <b>vinculado</b> para ver o gado dele.</p>
            </div>
          ) : (
            <div className="detail-card" key={selected}>
              <header className={`dh ${selRec ? "linked" : "free"}`}>
                <span className="dh-no"><small>Lote</small>{pad(selected)}</span>
                <span className="dh-status">{selRec ? "Vinculado" : "Disponível"}</span>
                <button type="button" className="dh-close" onClick={() => setSelected(null)} aria-label="Fechar detalhe">✕</button>
              </header>
              {selRec ? (
                <LinkedDetail record={selRec} entries={entriesOf(selRec)} onAskUnlink={() => setConfirming(true)} onEntryChange={onEntryChange} />
              ) : (
                <LinkForm key={selected} lot={selected} farms={farms} available={available}
                  onLink={onLink} goToDesembarque={goToDesembarque} />
              )}
            </div>
          )}
        </aside>
      </div>

      <CapacityDialog open={capOpen} onClose={() => setCapOpen(false)} total={total} max={max}
        trailingFree={trailingFree} onChange={resize} />

      <dialog ref={confirmRef} className="confirm" onClose={() => setConfirming(false)} aria-labelledby="cf-title">
        {selRec && (
          <>
            <span className="cf-ico" aria-hidden="true">!</span>
            <h3 id="cf-title">Desvincular o lote {pad(selRec.lot)}?</h3>
            <p>
              {selSummary && `As ${fmt(selSummary.quantity)} cabeças`} da <b>{selRec.farm}</b> voltam para “Sem lote”
              e o lote sai do catálogo público. Os registros do desembarque não são apagados.
            </p>
            <div className="cf-actions">
              <button type="button" className="ghost" onClick={() => setConfirming(false)} autoFocus>Cancelar</button>
              <button type="button" className="danger" onClick={confirmUnlink} disabled={unlinking}>
                {unlinking ? "Desvinculando…" : "Desvincular"}
              </button>
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}
