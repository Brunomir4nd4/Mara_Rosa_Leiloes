"use client";

import { useEffect, useRef, useState } from "react";

// Número que "sobe" até o valor ao aparecer (respeita quem prefere menos movimento)
export function CountUp({ value, ms = 900 }) {
  const [shown, setShown] = useState(value);
  const from = useRef(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setShown(value); return; }
    const start = performance.now();
    const a = from.current;
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(a + (value - a) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown.toLocaleString("pt-BR");
}

// Resumo no topo das abas Fazenda e Desembarque
export default function Kpis({ tab, farms, entries }) {
  const heads = (list) => list.reduce((t, e) => t + (Number(e.quantity) || 0), 0);
  const today = new Date().toLocaleDateString("sv-SE");
  const items = tab === "farm"
    ? [
        { label: "Fazendas", value: farms.length, hint: "cadastradas", hl: true },
        { label: "Com telefone", value: farms.filter((f) => f.phone).length, hint: "contato para o dono" },
        { label: "Com desembarque", value: new Set(entries.map((e) => e.farm)).size, hint: "já mandaram gado" },
        { label: "Cabeças", value: heads(entries), hint: "desembarcadas no total" },
      ]
    : [
        { label: "Cabeças", value: heads(entries.filter((e) => e.kind !== "REFUGO")), hint: "gado normal", hl: true },
        { label: "Hoje", value: heads(entries.filter((e) => e.arrivedAt && new Date(e.arrivedAt).toLocaleDateString("sv-SE") === today)), hint: "cabeças desembarcadas hoje" },
        { label: "Refugo", value: heads(entries.filter((e) => e.kind === "REFUGO")), hint: "cabeças com problema", tone: "warn" },
        { label: "Sem lote", value: heads(entries.filter((e) => !e.lotId)), hint: "falta vincular na aba Lotes", tone: "info" },
      ];
  return (
    <dl className="kpis">
      {items.map((k, i) => (
        <div key={k.label} className={`kpi${k.hl ? " hl" : ""}${k.tone ? ` t-${k.tone}` : ""}`} style={{ "--i": i }}>
          <dt>{k.label}</dt>
          <dd><CountUp value={k.value} /></dd>
          <p>{k.hint}</p>
        </div>
      ))}
    </dl>
  );
}
