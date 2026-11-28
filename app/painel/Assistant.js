"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Icon from "../_ui/Icon";
import { QUICK_QUESTIONS } from "../../lib/assistant-knowledge";
import BrandLogo from "../_ui/BrandLogo";

const STORE = "mr-assistente";

// Markdown simples e seguro (sem HTML): **negrito**, *itálico*/_itálico_, `código`, listas e quebras de linha
function inline(text, key) {
  const parts = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*|_[^_\n]+_)/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("**")) parts.push(<strong key={`${key}-${i++}`}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) parts.push(<code key={`${key}-${i++}`}>{t.slice(1, -1)}</code>);
    else parts.push(<em key={`${key}-${i++}`}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function Markdown({ text }) {
  const blocks = [];
  let list = null;
  text.split("\n").forEach((line, n) => {
    const ol = line.match(/^\s*(\d+)[.)]\s+(.*)/);
    const ul = line.match(/^\s*[-•*]\s+(.*)/);
    if (ol || ul) {
      const type = ol ? "ol" : "ul";
      if (!list || list.type !== type) { list = { type, items: [] }; blocks.push(list); }
      list.items.push(inline(ol ? ol[2] : ul[1], `l${n}`));
    } else {
      list = null;
      blocks.push(line.trim() ? { type: "p", content: inline(line, `p${n}`) } : { type: "gap" });
    }
  });
  return blocks.map((b, i) => {
    if (b.type === "ol") return <ol key={i}>{b.items.map((it, j) => <li key={j}>{it}</li>)}</ol>;
    if (b.type === "ul") return <ul key={i}>{b.items.map((it, j) => <li key={j}>{it}</li>)}</ul>;
    if (b.type === "gap") return <Fragment key={i} />;
    return <p key={i}>{b.content}</p>;
  });
}

// Emblema da Mara Rosa Leilões em 3D dourado (sem fundo), com reflexo passando por cima.
// busy: gira mais (pensando)
function Mark({ size = 40, busy = false, still = false }) {
  return (
    <span className={`as-emblem${busy ? " busy" : ""}${still ? " still" : ""}`} style={{ width: size, height: size }} aria-hidden="true">
      <BrandLogo className="as-logo" fx />
    </span>
  );
}

// Martelo de leilão batendo (indicador de "digitando")
function Gavel() {
  return (
    <span className="as-gavel" aria-label="Digitando">
      <svg viewBox="0 0 48 32" aria-hidden="true">
        <g className="g-hammer">
          <rect x="20" y="3" width="16" height="8" rx="2" transform="rotate(-30 28 7)" />
          <rect x="6" y="12" width="20" height="3" rx="1.5" transform="rotate(-30 16 13.5)" />
        </g>
        <rect className="g-block" x="26" y="24" width="18" height="5" rx="1.5" />
        <g className="g-hit"><path d="M30 20l-2-3M35 19v-4M40 20l2-3" /></g>
      </svg>
    </span>
  );
}

// ícone de cada pergunta pronta
const TOPIC_ICON = {
  fluxo: "M4 6h4v4H4zm6 0h10M4 14h4v4H4zm6 0h10",
  desembarque: "M3 6h12v10H3zm12 4h4l2 3v3h-6zM6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm11 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  lote: "M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 0h8v8h-8z",
  pista: "M12 2a7 7 0 0 1 7 7c0 4-3 6-4 9H9c-1-3-4-5-4-9a7 7 0 0 1 7-7zm-3 18h6v2H9z",
  retirada: "M3 5h11v10H3zm11 4h4l3 3v3h-7zM6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm11 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  usuarios: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c0-4 3-6 7-6s7 2 7 6M17 3a4 4 0 0 1 0 8M22 21c0-3-2-5-4-5.5",
  video: "M3 6h13v12H3zm13 4 5-3v10l-5-3",
  refugos: "M12 3 2 20h20zm0 6v5m0 3v.01",
  tema: "M12 2a10 10 0 0 0 0 20c1.1 0 2-.9 2-2 0-1.1.9-2 2-2h2.4A4.6 4.6 0 0 0 22 10.8C22 5.9 17.5 2 12 2z",
};
const SHORT = { fluxo: "Passo a passo do leilão", desembarque: "Registrar desembarque", lote: "Vincular um lote", pista: "Resultado na Pista",
  retirada: "Saldo da Retirada", usuarios: "Usuários e funções", refugos: "Refugos e Criador", video: "Vídeo no catálogo", tema: "Tema e foto de perfil" };

export default function Assistant({ me, tab }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState(null); // "ai" | "local"
  const list = useRef(null);
  const field = useRef(null);
  const abort = useRef(null);

  // conversa guardada na aba do navegador (some ao fechar a aba)
  useEffect(() => {
    try { const s = JSON.parse(sessionStorage.getItem(STORE) || "[]"); if (Array.isArray(s)) setMessages(s); } catch {}
  }, []);
  useEffect(() => {
    if (busy) return;
    try { sessionStorage.setItem(STORE, JSON.stringify(messages.slice(-30))); } catch {}
  }, [messages, busy]);
  // conversa vazia: mostra a saudação (topo); com mensagens: acompanha a última
  useEffect(() => {
    if (!list.current) return;
    list.current.scrollTo({ top: messages.length ? list.current.scrollHeight : 0, behavior: messages.length ? "smooth" : "auto" });
  }, [messages, open]);
  useEffect(() => { if (open) setTimeout(() => field.current?.focus(), 250); }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function ask(text) {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    const history = [...messages, { role: "user", content: q }];
    setMessages([...history, { role: "assistant", content: "", pending: true }]);
    setBusy(true);
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tab, messages: history.map(({ role, content }) => ({ role, content })) }),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Não consegui responder agora.");
      }
      setMode(res.headers.get("X-Assistant-Mode"));
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: acc, pending: true }]);
      }
      setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: acc || "Não consegui responder agora." }]);
    } catch (e) {
      const msg = e.name === "AbortError" ? "Resposta interrompida." : e.message === "Failed to fetch" ? "Sem conexão com o servidor." : e.message;
      setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: msg, error: true }]);
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }

  function clear() {
    abort.current?.abort();
    setMessages([]);
    try { sessionStorage.removeItem(STORE); } catch {}
  }

  // perguntas prontas que fazem sentido para a função
  const ONLY = { CRIADOR: ["refugos", "tema"], CURRAL: ["fluxo", "desembarque", "lote", "retirada", "refugos", "tema"] }[me.role];
  const quick = ONLY ? QUICK_QUESTIONS.filter((x) => ONLY.includes(x.id)) : QUICK_QUESTIONS;
  const first = me.system ? "" : `, ${me.name.split(" ")[0]}`;
  const empty = messages.length === 0;

  const hour = new Date().getHours();
  const hello = hour < 5 ? "Boa madrugada" : hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const status = busy ? "Pensando…" : "Assistente inteligente · online";

  return (
    <div className={`as${open ? " open" : ""}`}>
      <button type="button" className="as-fab" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="as-panel"
        aria-label={open ? "Fechar assistente" : "Abrir assistente Mara Rosa Leilões"}>
        <span className="as-fab-ring" aria-hidden="true" />
        <span className="as-fab-face" aria-hidden="true">{open ? <Icon name="x" size={22} /> : <Mark size={40} />}</span>
        {!open && <span className="as-orbit" aria-hidden="true"><i /></span>}
        {!open && <span className="as-fab-chip" aria-hidden="true">IA</span>}
        {!open && <span className="as-fab-tip"><b>Mara Rosa Leilões</b>Precisa de ajuda? Pergunte aqui</span>}
      </button>

      <section id="as-panel" className="as-panel" role="dialog" aria-label="Assistente Mara Rosa Leilões" aria-hidden={!open}>
        <span className="as-aurora a1" aria-hidden="true" />
        <span className="as-aurora a2" aria-hidden="true" />
        <header className="as-head">
          <Mark size={44} busy={busy} />
          <div className="as-title">
            <strong>Mara Rosa <em>Leilões</em></strong>
            <span><i className={`as-live${busy ? " busy" : ""}`} aria-hidden="true" />{status}</span>
          </div>
          {!empty && (
            <button type="button" className="as-icon" onClick={clear} title="Nova conversa" aria-label="Nova conversa">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4" /></svg>
            </button>
          )}
          <button type="button" className="as-icon" onClick={() => setOpen(false)} aria-label="Fechar"><Icon name="x" size={18} /></button>
        </header>

        <div className="as-body" ref={list} aria-live="polite">
          {empty ? (
            <div className="as-hello">
              <Mark size={84} />
              <span className="as-kicker">Assistente inteligente</span>
              <h3>{hello}{first}!</h3>
              <p>Sou o assistente da Mara Rosa Leilões. Pergunte qualquer coisa sobre o painel ou escolha um assunto:</p>
              <div className="as-quick">
                {quick.map((x, i) => (
                  <button key={x.id} type="button" style={{ "--i": i }} onClick={() => ask(x.q)} title={x.q}>
                    <span className="as-q-ico" aria-hidden="true"><svg viewBox="0 0 24 24"><path d={TOPIC_ICON[x.id] || TOPIC_ICON.fluxo} /></svg></span>
                    <span className="as-q-txt">{SHORT[x.id] || x.q}</span>
                    <Icon name="arrowRight" size={14} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`as-msg ${m.role}${m.error ? " err" : ""}`}>
                {m.role === "assistant" && <Mark size={30} busy={m.pending} still={!m.pending} />}
                <div className="as-bubble">
                  {m.role === "assistant" && m.pending && !m.content
                    ? <Gavel />
                    : m.role === "assistant" ? <><Markdown text={m.content} />{m.pending && <span className="as-caret" aria-hidden="true" />}</> : m.content}
                </div>
              </div>
            ))
          )}
        </div>

        {!empty && !busy && (
          <div className="as-chips">
            {quick.slice(0, 5).map((x) => (
              <button key={x.id} type="button" onClick={() => ask(x.q)}>{SHORT[x.id] || x.q}</button>
            ))}
          </div>
        )}

        <form className="as-form" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
          <textarea ref={field} rows={1} value={input} maxLength={2000} placeholder="Pergunte ao assistente…" aria-label="Sua pergunta"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input); } }} />
          {busy ? (
            <button type="button" className="as-send stop" onClick={() => abort.current?.abort()} aria-label="Parar resposta">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2" /></svg>
            </button>
          ) : (
            <button type="submit" className="as-send" disabled={!input.trim()} aria-label="Enviar pergunta">
              <span className="as-send-glow" aria-hidden="true" />
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 3 10 14M21 3l-7 18-4-7-7-4z" /></svg>
            </button>
          )}
        </form>
        <p className="as-foot"><Icon name="lock" size={11} /> Assistente da plataforma Mara Rosa Leilões. Nunca informe senhas.</p>
      </section>
    </div>
  );
}
