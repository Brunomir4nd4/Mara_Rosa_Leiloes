"use client";

import { useEffect, useRef, useState } from "react";

const KEY = "mr-tema";
export const ACCENTS = [
  { id: "yellow", label: "Amarelo Mara Rosa", color: "#FEC200" },
  { id: "green", label: "Verde", color: "#34c98a" },
  { id: "blue", label: "Azul", color: "#5aa9ff" },
  { id: "purple", label: "Roxo", color: "#a98bff" },
];
const MODES = [
  { id: "dark", label: "Escuro", icon: "M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z" },
  { id: "light", label: "Claro", icon: "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM11 1h2v3h-2zm0 19h2v3h-2zM1 11h3v2H1zm19 0h3v2h-3zM4.2 5.6l1.4-1.4 2.1 2.1-1.4 1.4zm12.1 12.1 1.4-1.4 2.1 2.1-1.4 1.4zM4.2 18.4l2.1-2.1 1.4 1.4-2.1 2.1zM16.3 6.3l2.1-2.1 1.4 1.4-2.1 2.1z" },
  { id: "auto", label: "Automático", icon: "M4 5h16v11H4zm-2 13h20v2H2z" },
];

// Preferência de tema salva neste navegador. Devolve { mode, accent, effective } e um setter.
// global: aplica o tema no <html> (login e catálogo, que não têm o .dash)
export function useTheme({ global = false } = {}) {
  const [pref, setPref] = useState({ mode: "dark", accent: "yellow" });
  const [systemDark, setSystemDark] = useState(true);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "null");
      if (saved?.mode) setPref({ mode: saved.mode, accent: saved.accent || "yellow" });
    } catch {}
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mq.matches);
    const onChange = (e) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function update(next) {
    setPref((p) => {
      const v = { ...p, ...next };
      try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {}
      return v;
    });
  }

  const effective = pref.mode === "auto" ? (systemDark ? "dark" : "light") : pref.mode;
  useEffect(() => {
    if (!global) return;
    const el = document.documentElement;
    el.dataset.theme = effective;
    el.dataset.accent = pref.accent;
  }, [global, effective, pref.accent]);
  useEffect(() => () => {
    if (global) { delete document.documentElement.dataset.theme; delete document.documentElement.dataset.accent; }
  }, [global]);
  return { ...pref, effective, update };
}

export default function ThemePicker({ theme }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (!root.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div className="theme-pick" ref={root}>
      <button type="button" className="theme-btn" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4A4.6 4.6 0 0 0 22 10.8C22 5.9 17.5 2 12 2zM6.5 13a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" /></svg>
        <span>Tema</span>
      </button>
      {open && (
        <div className="theme-pop" role="dialog" aria-label="Personalizar tema">
          <h4>Aparência</h4>
          <div className="tp-modes" role="radiogroup" aria-label="Aparência">
            {MODES.map((m) => (
              <button key={m.id} type="button" role="radio" aria-checked={theme.mode === m.id} className={theme.mode === m.id ? "on" : ""}
                onClick={() => theme.update({ mode: m.id })}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d={m.icon} /></svg>
                {m.label}
              </button>
            ))}
          </div>
          <h4>Cor de destaque</h4>
          <div className="tp-accents" role="radiogroup" aria-label="Cor de destaque">
            {ACCENTS.map((a) => (
              <button key={a.id} type="button" role="radio" aria-checked={theme.accent === a.id} aria-label={a.label} title={a.label}
                className={theme.accent === a.id ? "on" : ""} style={{ background: a.color }} onClick={() => theme.update({ accent: a.id })} />
            ))}
          </div>
          <p className="tp-note">{theme.mode === "auto" ? `Seguindo o sistema (agora: ${theme.effective === "dark" ? "escuro" : "claro"}).` : "Salvo neste navegador."}</p>
        </div>
      )}
    </div>
  );
}
