"use client";

import { useEffect, useId, useRef, useState } from "react";
import { toLocalInput } from "../../lib/datetime";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const WEEK = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const pad = (n) => String(n).padStart(2, "0");
const sameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const parse = (v) => {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};

// "Qui, 27 nov 2026 · 14:30"
function display(d) {
  if (!d) return "Escolha a data e a hora";
  const wd = WEEK[d.getDay()];
  const mon = MONTHS[d.getMonth()].slice(0, 3).toLowerCase();
  return `${wd}, ${pad(d.getDate())} ${mon} ${d.getFullYear()} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Seletor de data e hora com calendário próprio. `value`/`onChange` no formato "AAAA-MM-DDTHH:mm" (horário local).
// Não deixa escolher dia ou horário depois de `max` (padrão: agora).
export default function DateTimePicker({ id, value, onChange, onBlur, invalid, describedBy, max, badge }) {
  const selected = parse(value);
  const limit = max ?? new Date();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const d = selected ?? new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [focusDay, setFocusDay] = useState(null);
  const root = useRef(null);
  const grid = useRef(null);
  const btn = useRef(null);
  const popId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (!root.current?.contains(e.target)) close(); };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // mantém o foco do teclado no dia ativo
  useEffect(() => {
    if (open && focusDay) grid.current?.querySelector(`[data-day="${focusDay.getTime()}"]`)?.focus();
  }, [open, focusDay]);

  function openPicker() {
    const d = selected ?? new Date();
    setView({ y: d.getFullYear(), m: d.getMonth() });
    setFocusDay(startOfDay(d));
    setOpen(true);
  }
  function close() {
    setOpen(false);
    onBlur?.();
  }

  // aplica dia e/ou horário, sem passar do limite
  function apply(day, hours, minutes) {
    const base = selected ?? new Date();
    let d = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours ?? base.getHours(), minutes ?? base.getMinutes());
    if (d > limit) d = new Date(limit.getFullYear(), limit.getMonth(), limit.getDate(), limit.getHours(), limit.getMinutes());
    onChange(toLocalInput(d));
  }

  const first = new Date(view.y, view.m, 1);
  const cells = Array.from({ length: 42 }, (_, i) => new Date(view.y, view.m, 1 - first.getDay() + i));
  const today = new Date();
  const limitDay = startOfDay(limit);
  const canNext = new Date(view.y, view.m + 1, 1) <= limit;

  function shiftMonth(n) {
    const d = new Date(view.y, view.m + n, 1);
    if (n > 0 && d > limit) return;
    setView({ y: d.getFullYear(), m: d.getMonth() });
  }

  function onGridKey(e) {
    if (!focusDay) return;
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let next = null;
    if (moves[e.key] != null) next = new Date(focusDay.getFullYear(), focusDay.getMonth(), focusDay.getDate() + moves[e.key]);
    else if (e.key === "PageUp") next = new Date(focusDay.getFullYear(), focusDay.getMonth() - 1, focusDay.getDate());
    else if (e.key === "PageDown") next = new Date(focusDay.getFullYear(), focusDay.getMonth() + 1, focusDay.getDate());
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (focusDay <= limitDay) apply(focusDay); return; }
    else if (e.key === "Escape") { e.preventDefault(); close(); btn.current?.focus(); return; }
    if (!next) return;
    e.preventDefault();
    if (next > limitDay) next = limitDay;
    setFocusDay(next);
    setView({ y: next.getFullYear(), m: next.getMonth() });
  }

  const h = selected?.getHours() ?? today.getHours();
  const min = selected?.getMinutes() ?? today.getMinutes();
  const dayForTime = selected ?? today;
  const setTime = (nh, nm) => apply(dayForTime, (nh + 24) % 24, (nm + 60) % 60);

  return (
    <div ref={root} className={`dtp${open ? " open" : ""}${invalid ? " invalid" : ""}`}>
      <button ref={btn} id={id} type="button" className="dtp-btn" aria-haspopup="dialog" aria-expanded={open} aria-controls={popId}
        aria-invalid={invalid ? "true" : undefined} aria-describedby={describedBy}
        onClick={() => (open ? close() : openPicker())}
        onKeyDown={(e) => { if (e.key === "ArrowDown" && !open) { e.preventDefault(); openPicker(); } }}>
        <svg className="dtp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2h2v2h6V2h2v2h3v18H4V4h3zm-1 8v10h12V10zm2 2h3v3H8z" /></svg>
        <span className="dtp-val">{display(selected)}</span>
        {badge}
      </button>

      {open && (
        <div className="dtp-pop" id={popId} role="dialog" aria-label="Escolher data e hora do desembarque">
          <div className="dtp-head">
            <button type="button" className="dtp-nav" onClick={() => shiftMonth(-1)} aria-label="Mês anterior">‹</button>
            <strong aria-live="polite">{MONTHS[view.m]} <span>{view.y}</span></strong>
            <button type="button" className="dtp-nav" onClick={() => shiftMonth(1)} disabled={!canNext} aria-label="Próximo mês">›</button>
          </div>

          <div className="dtp-week" aria-hidden="true">{WEEK.map((w) => <span key={w}>{w.slice(0, 1)}</span>)}</div>
          <div className="dtp-grid" role="grid" ref={grid} onKeyDown={onGridKey}>
            {cells.map((d) => {
              const out = d.getMonth() !== view.m;
              const future = d > limitDay;
              const isSel = sameDay(d, selected);
              const isFocus = sameDay(d, focusDay);
              return (
                <button key={d.getTime()} type="button" role="gridcell" data-day={d.getTime()}
                  className={`dtp-day${out ? " out" : ""}${isSel ? " sel" : ""}${sameDay(d, today) ? " today" : ""}`}
                  tabIndex={isFocus ? 0 : -1} disabled={future} aria-selected={isSel}
                  aria-label={`${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}${future ? " (indisponível)" : ""}`}
                  onClick={() => { setFocusDay(d); apply(d); }}>
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          <div className="dtp-time">
            <span className="dtp-tlabel">Horário</span>
            <div className="dtp-spin" aria-label="Hora">
              <button type="button" onClick={() => setTime(h - 1, min)} aria-label="Hora anterior">−</button>
              <output>{pad(h)}</output>
              <button type="button" onClick={() => setTime(h + 1, min)} aria-label="Próxima hora">+</button>
            </div>
            <span className="dtp-colon">:</span>
            <div className="dtp-spin" aria-label="Minuto">
              <button type="button" onClick={() => setTime(h, min - 5)} aria-label="Menos 5 minutos">−</button>
              <output>{pad(min)}</output>
              <button type="button" onClick={() => setTime(h, min + 5)} aria-label="Mais 5 minutos">+</button>
            </div>
          </div>
          <div className="dtp-quick">
            {[["06:00", 6, 0], ["12:00", 12, 0], ["18:00", 18, 0]].map(([t, hh, mm]) => (
              <button key={t} type="button" className={h === hh && min === mm ? "on" : ""} onClick={() => apply(dayForTime, hh, mm)}>{t}</button>
            ))}
          </div>

          <div className="dtp-foot">
            <button type="button" className="dtp-link" onClick={() => { const y = new Date(); y.setDate(y.getDate() - 1); apply(y); setView({ y: y.getFullYear(), m: y.getMonth() }); }}>Ontem</button>
            <button type="button" className="dtp-link" onClick={() => { onChange(toLocalInput(new Date())); setView({ y: today.getFullYear(), m: today.getMonth() }); }}>Agora</button>
            <button type="button" className="dtp-ok" onClick={() => { close(); btn.current?.focus(); }}>Concluir</button>
          </div>
        </div>
      )}
    </div>
  );
}
