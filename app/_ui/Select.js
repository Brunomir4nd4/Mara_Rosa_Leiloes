"use client";

import { useEffect, useId, useRef, useState } from "react";

// Select personalizado (combobox + listbox) com teclado completo:
// ↑ ↓ Home End navegam, Enter/Espaço escolhem, Esc fecha, digitar letras pula para a opção.
// options: [{ value, label, hint?, disabled? }]
export default function Select({
  id, value, onChange, options, placeholder = "Selecione…", required, ariaLabel, describedBy, className = "", invalid, onBlur,
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const root = useRef(null);
  const btn = useRef(null);
  const list = useRef(null);
  const typed = useRef({ text: "", at: 0 });
  const listId = useId();

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = options[selectedIndex];

  // fecha ao clicar fora
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (!root.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  // mantém a opção ativa visível ao navegar pelo teclado
  useEffect(() => {
    if (open && active >= 0) list.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const [up, setUp] = useState(false);

  function openList() {
    // abre para cima se não houver espaço embaixo (lista tem até 280px)
    const r = btn.current?.getBoundingClientRect();
    setUp(Boolean(r && window.innerHeight - r.bottom < 300 && r.top > window.innerHeight - r.bottom));
    setActive(selectedIndex >= 0 ? selectedIndex : move(-1, 1));
    setOpen(true);
  }

  function choose(i) {
    const o = options[i];
    if (o && !o.disabled) onChange(o.value);
    if (o?.disabled) return;
    setOpen(false);
    btn.current?.focus();
  }

  function move(from, step) {
    let i = from;
    for (let n = 0; n < options.length; n++) {
      i = Math.min(options.length - 1, Math.max(0, i + step));
      if (!options[i]?.disabled) return i;
    }
    return from;
  }

  function onKeyDown(e) {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); setActive((a) => move(a, 1)); break;
      case "ArrowUp": e.preventDefault(); setActive((a) => move(a, -1)); break;
      case "Home": e.preventDefault(); setActive(move(-1, 1)); break;
      case "End": e.preventDefault(); setActive(move(options.length, -1)); break;
      case "Enter": case " ": e.preventDefault(); choose(active); break;
      case "Escape": e.preventDefault(); setOpen(false); break;
      case "Tab": setOpen(false); break;
      default:
        if (e.key.length === 1) {
          const now = Date.now();
          const t = typed.current;
          t.text = (now - t.at < 700 ? t.text : "") + e.key.toLowerCase();
          t.at = now;
          const i = options.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(t.text));
          if (i >= 0) setActive(i);
        }
    }
  }

  return (
    <div ref={root} className={`sel${open ? " open" : ""}${up ? " up" : ""}${invalid ? " invalid" : ""}${className ? ` ${className}` : ""}`}>
      <button
        ref={btn}
        id={id}
        type="button"
        className="sel-btn"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        aria-invalid={invalid ? "true" : undefined}
        onBlur={(e) => { if (!root.current?.contains(e.relatedTarget)) onBlur?.(); }}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
      >
        <span className={selected ? "sel-val" : "sel-val ph"}>{selected ? selected.label : placeholder}</span>
        <svg className="sel-chev" viewBox="0 0 12 8" aria-hidden="true"><path d="M1 1.5l5 5 5-5" /></svg>
      </button>

      {/* input invisível só para a validação "required" nativa do formulário */}
      {required && (
        <input className="sel-native" tabIndex={-1} aria-hidden="true" required value={value ?? ""}
          onChange={() => {}} onFocus={() => btn.current?.focus()} />
      )}

      <ul ref={list} id={listId} role="listbox" className="sel-list" aria-labelledby={id} hidden={!open}>
        {options.length === 0 && <li className="sel-empty" role="presentation">Nenhuma opção disponível</li>}
        {options.map((o, i) => (
          <li
            key={o.value}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={o.value === value}
            aria-disabled={o.disabled || undefined}
            className={`${i === active ? "act" : ""}${o.value === value ? " on" : ""}`}
            onPointerEnter={() => !o.disabled && setActive(i)}
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => choose(i)}
          >
            <span className="sel-opt">{o.label}</span>
            {o.hint && <em>{o.hint}</em>}
            <svg className="sel-check" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 5" /></svg>
          </li>
        ))}
      </ul>
    </div>
  );
}
