"use client";

import { useEffect, useRef } from "react";

// Campo numérico com botões − e + grandes (no lugar das setinhas minúsculas do navegador).
// Segurar o botão repete o passo. Aceita só números inteiros. `value` é texto (pode ficar vazio).
export default function NumberStepper({
  id, value, onChange, min = 1, max = 9999, step = 1, placeholder, invalid, describedBy, onBlur, unit,
}) {
  const timer = useRef(null);
  const latest = useRef(value);
  latest.current = value;

  useEffect(() => () => clearInterval(timer.current), []);

  const clamp = (n) => Math.min(max, Math.max(min, n));

  function bump(dir) {
    const n = Number(latest.current);
    const next = latest.current === "" || !Number.isFinite(n) ? (dir > 0 ? min : min) : clamp(n + dir * step);
    latest.current = String(next);
    onChange(String(next));
  }

  // segurar o botão: depois de 400 ms repete a cada 80 ms
  function hold(dir) {
    bump(dir);
    clearInterval(timer.current);
    timer.current = setTimeout(() => {
      timer.current = setInterval(() => bump(dir), 80);
    }, 400);
  }
  function release() {
    clearTimeout(timer.current);
    clearInterval(timer.current);
  }

  const n = Number(value);
  const atMin = value !== "" && n <= min;
  const atMax = value !== "" && n >= max;

  return (
    <div className={`stepper${invalid ? " invalid" : ""}`}>
      <button type="button" className="st-btn" aria-label="Diminuir" tabIndex={-1} disabled={atMin}
        onPointerDown={(e) => { e.preventDefault(); hold(-1); }} onPointerUp={release} onPointerLeave={release}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") bump(-1); }}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 11h14v2H5z" /></svg>
      </button>
      <input id={id} type="text" inputMode="numeric" autoComplete="off" placeholder={placeholder} value={value}
        aria-invalid={invalid ? "true" : "false"} aria-describedby={describedBy} onBlur={onBlur}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, String(max).length))}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") { e.preventDefault(); bump(1); }
          if (e.key === "ArrowDown") { e.preventDefault(); bump(-1); }
        }} />
      {unit && <span className="st-unit" aria-hidden="true">{unit}</span>}
      <button type="button" className="st-btn" aria-label="Aumentar" tabIndex={-1} disabled={atMax}
        onPointerDown={(e) => { e.preventDefault(); hold(1); }} onPointerUp={release} onPointerLeave={release}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5h2v14h-2zM5 11h14v2H5z" /></svg>
      </button>
    </div>
  );
}
