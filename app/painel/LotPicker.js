"use client";

import { useEffect, useId, useRef, useState } from "react";
import { lotTitle } from "../../lib/catalog";
import { PISTA_STATUS, STATUS_INFO } from "../../lib/pista";

const pad = (n) => String(n).padStart(2, "0");

// Seletor de lote da Pista: busca por número/fazenda, filtro por situação e navegação por teclado
export default function LotPicker({ rows, currentId, onPick }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [active, setActive] = useState(0);
  const root = useRef(null);
  const list = useRef(null);
  const search = useRef(null);
  const listId = useId();

  const index = rows.findIndex((r) => r.lot.id === currentId);
  const current = rows[index];

  const q = query.trim().toLowerCase();
  const num = q.replace(/^0+(?=\d)/, "");
  const items = rows.filter((r) =>
    (status === "ALL" || r.status === status) &&
    (!q || String(r.lot.lot).startsWith(num) || pad(r.lot.lot).startsWith(q) || r.lot.farm.toLowerCase().includes(q))
  );

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (!root.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  useEffect(() => { setActive(0); }, [query, status]);
  useEffect(() => {
    if (open) list.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function openPicker() {
    setQuery("");
    setStatus("ALL");
    setActive(Math.max(0, index));
    setOpen(true);
    setTimeout(() => search.current?.focus(), 0);
  }

  function pick(r) {
    if (!r) return;
    setOpen(false);
    onPick(r.lot.id);
  }

  function onKeyDown(e) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); pick(items[active]); }
    else if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
  }

  const count = (s) => rows.filter((r) => r.status === s).length;

  return (
    <div className={`lp${open ? " open" : ""}`} ref={root}>
      <button type="button" className="lp-btn" onClick={() => (open ? setOpen(false) : openPicker())}
        aria-haspopup="dialog" aria-expanded={open}>
        <span className="lp-cur">Lote {current ? pad(current.lot.lot) : "—"}</span>
        <span className="lp-pos">{index + 1} de {rows.length}</span>
        <svg viewBox="0 0 12 8" aria-hidden="true"><path d="M1 1.5l5 5 5-5" /></svg>
      </button>

      {open && (
        <div className="lp-pop" role="dialog" aria-label="Escolher lote">
          <div className="lp-search">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4a6 6 0 1 0 3.7 10.7l4.8 4.8 1.4-1.4-4.8-4.8A6 6 0 0 0 10 4zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8z" /></svg>
            <input ref={search} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKeyDown}
              placeholder="Nº do lote ou fazenda" aria-label="Buscar lote" role="combobox" aria-expanded="true"
              aria-controls={listId} aria-activedescendant={items[active] ? `${listId}-${items[active].lot.id}` : undefined} />
          </div>
          <div className="lp-filters" role="group" aria-label="Filtrar por situação">
            {["ALL", ...PISTA_STATUS].map((s) => (
              <button key={s} type="button" className={`lp-f${status === s ? " on" : ""}${s !== "ALL" ? ` lf-${s.toLowerCase()}` : ""}`}
                aria-pressed={status === s} onClick={() => setStatus(s)}>
                {s === "ALL" ? "Todos" : STATUS_INFO[s].short} <em>{s === "ALL" ? rows.length : count(s)}</em>
              </button>
            ))}
          </div>
          <ul className="lp-list" id={listId} role="listbox" ref={list} aria-label="Lotes">
            {items.length === 0 && <li className="lp-none" role="presentation">Nenhum lote encontrado.</li>}
            {items.map((r, i) => (
              <li key={r.lot.id} id={`${listId}-${r.lot.id}`} role="option" aria-selected={r.lot.id === currentId}
                className={`${i === active ? "act" : ""}${r.lot.id === currentId ? " cur" : ""}`}
                onPointerEnter={() => setActive(i)} onPointerDown={(e) => e.preventDefault()} onClick={() => pick(r)}>
                <span className="lp-no">{pad(r.lot.lot)}</span>
                <span className="lp-txt">
                  <strong>{lotTitle(r.s)}</strong>
                  <span>{r.lot.farm}</span>
                </span>
                <span className={`st st-${r.status.toLowerCase()}`}>{STATUS_INFO[r.status].short}</span>
              </li>
            ))}
          </ul>
          <p className="lp-help"><kbd>↑</kbd><kbd>↓</kbd> navegar · <kbd>Enter</kbd> abrir · <kbd>Esc</kbd> fechar</p>
        </div>
      )}
    </div>
  );
}
