"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "../_ui/Icon";
import BrandLogo from "../_ui/BrandLogo";
import { ROLE_INFO } from "../../lib/roles";
import { askNotifyPermission, notifyNew, notifyPermission } from "./chatNotify";

// Chat interno (estilo WhatsApp): grupo "Geral" com todos, grupos criados por TI/Administrativo e conversas diretas.
// Atualiza por consulta periódica: lista a cada 6 s, conversa aberta a cada 2,5 s.
// Status das minhas mensagens: ✓ enviada · ✓✓ entregue (chegou para todos) · ✓✓ azul lida por todos.
const GENERAL = "geral";
const GENERAL_TITLE = "Geral · Mara Rosa Leilões";
const dmId = (a, b) => ["dm", ...[a, b].sort()].join("|");
const enc = (id) => encodeURIComponent(id);
const groupHex = (id) => String(id).slice(2);
const TZ = "America/Sao_Paulo";
const hhmm = (d) => new Date(d).toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const dayKey = (d) => new Date(d).toLocaleDateString("sv-SE", { timeZone: TZ });
function dayLabel(d) {
  const k = dayKey(d);
  if (k === dayKey(new Date())) return "Hoje";
  if (k === dayKey(new Date(Date.now() - 864e5))) return "Ontem";
  return new Date(d).toLocaleDateString("pt-BR", { timeZone: TZ, day: "2-digit", month: "long", year: "numeric" });
}
function listTime(d) {
  if (!d) return "";
  return dayKey(d) === dayKey(new Date()) ? hhmm(d) : dayLabel(d) === "Ontem" ? "Ontem" : new Date(d).toLocaleDateString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" });
}
const whenLabel = (d) => (dayLabel(d) === "Hoje" ? `hoje às ${hhmm(d)}` : dayLabel(d) === "Ontem" ? `ontem às ${hhmm(d)}` : `${new Date(d).toLocaleDateString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" })} às ${hhmm(d)}`);
function lastSeenLabel(iso) {
  if (!iso) return "offline";
  if (dayKey(iso) === dayKey(new Date()) || dayLabel(iso) === "Ontem") return `visto por último ${whenLabel(iso)}`;
  return `visto por último em ${new Date(iso).toLocaleDateString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" })}`;
}
const initial = (name) => (String(name || "?").trim()[0] || "?").toUpperCase();
const fileUrl = (file) => `/api/chat/file/${encodeURIComponent(file)}`;
const roleLabel = (role) => ROLE_INFO[role]?.label ?? role;
const firstName = (n) => String(n || "").split(" ")[0];
const POST_JSON = (body) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

// person: { name, role, avatar, online } · logo: grupo Geral · group: grupo criado (foto ou inicial)
function Avatar({ person, size = 44, logo = false, group = false }) {
  if (logo) return <span className="wc-av group" style={{ width: size, height: size }} aria-hidden="true"><BrandLogo className="wc-av-logo" /></span>;
  return (
    <span className={`wc-av${group ? " grp" : ""} r-${String(person?.role || "").toLowerCase()}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }} aria-hidden="true">
      {person?.avatar
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={person.avatar} alt="" />
        : <span>{group ? <svg viewBox="0 0 24 24" className="wc-grp-ico"><path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.3 3.3 0 0 1 0 6.4M18.5 14.2A6.4 6.4 0 0 1 21.5 20" /></svg> : initial(person?.name)}</span>}
      {person?.online && <i className="wc-online" title="Online" />}
    </span>
  );
}

const RoleTag = ({ role }) => (role ? <span className={`wc-role r-${String(role).toLowerCase()}`}>{roleLabel(role)}</span> : null);

function Ticks({ status }) {
  if (status === "pending") return <span className="wc-tick pending" title="Enviando"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></svg></span>;
  const label = status === "read" ? "Lida" : status === "delivered" ? "Entregue" : "Enviada";
  return (
    <span className={`wc-tick ${status}`} title={label} aria-label={label}>
      {status === "sent"
        ? <svg viewBox="0 0 24 24"><path d="M5 12.5 9.5 17 19 7" /></svg>
        : <svg viewBox="0 0 30 24" className="dbl"><path d="M2 12.5l4.5 4.5L16 7.5M11.5 16.5l.5.5L21.5 7.5" /></svg>}
    </span>
  );
}

// Reduz fotos grandes no navegador (JPEG) para enviar rápido e caber nos limites
async function shrinkPhoto(file, max = 1920) {
  if (!file.type.startsWith("image/")) return { blob: file, width: null, height: null };
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  c.getContext("2d").drawImage(img, 0, 0, w, h);
  URL.revokeObjectURL(img.src);
  const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.85));
  return { blob: blob || file, width: w, height: h };
}

function uploadMedia(chatId, blob, { name, caption, width, height, replyTo }, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/chat/${enc(chatId)}/media`);
    xhr.setRequestHeader("Content-Type", blob.type);
    xhr.setRequestHeader("X-File-Name", encodeURIComponent(name || ""));
    if (caption) xhr.setRequestHeader("X-Caption", encodeURIComponent(caption));
    if (width) xhr.setRequestHeader("X-Width", String(width));
    if (height) xhr.setRequestHeader("X-Height", String(height));
    if (replyTo) xhr.setRequestHeader("X-Reply-To", replyTo);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch {}
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else if (xhr.status === 413) reject(new Error("Arquivo grande demais para o servidor."));
      else reject(new Error(data.error || "Falha no envio. Tente de novo."));
    };
    xhr.onerror = () => reject(new Error("Sem conexão. Tente de novo."));
    xhr.send(blob);
  });
}

// Janelas por cima de todo o painel (fora da área com rolagem/animação do conteúdo)
function Layer({ children }) {
  const [host, setHost] = useState(null);
  useEffect(() => { setHost(document.querySelector(".dash") ?? document.body); }, []);
  if (!host) return null;
  const items = [children].flat(Infinity).filter(Boolean);
  return items.length ? createPortal(<div className="wc wc-layer">{children}</div>, host) : null;
}

const msgPreview = (m) => (m.deleted ? "Mensagem apagada" : m.kind === "photo" ? `📷 ${m.text || "Foto"}` : m.kind === "video" ? `🎥 ${m.text || "Vídeo"}` : m.text);

// Lista de pessoas com caixa de seleção (novo grupo, adicionar participantes, encaminhar)
function PeoplePicker({ people, selected, onToggle, max, search, setSearch, extraTop }) {
  const q = search.trim().toLowerCase();
  const shown = people.filter((p) => !q || p.name.toLowerCase().includes(q) || roleLabel(p.role ?? "").toLowerCase().includes(q));
  return (
    <>
      <label className="wc-search wc-search-in">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4" /></svg>
        <input type="search" placeholder="Buscar" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar" />
      </label>
      {extraTop}
      <div className="wc-pick-list">
        {shown.map((p) => {
          const on = selected.includes(p.id);
          const full = !on && max && selected.length >= max;
          return (
            <button key={p.id} type="button" className={`wc-item wc-pick${on ? " picked" : ""}`} disabled={full} onClick={() => onToggle(p.id)} aria-pressed={on}>
              <Avatar person={p.person ?? p} logo={p.logo} group={p.group} size={40} />
              <span className="wc-item-main">
                <strong>{p.name}</strong>
                <span className="wc-contact-sub">{p.role ? <RoleTag role={p.role} /> : <em>{p.sub}</em>}</span>
              </span>
              <span className="wc-check" aria-hidden="true">{on && <svg viewBox="0 0 24 24"><path d="M5 12.5 9.5 17 19 7" /></svg>}</span>
            </button>
          );
        })}
        {shown.length === 0 && <p className="wc-empty">Ninguém encontrado.</p>}
      </div>
    </>
  );
}

export default function ChatBoard({ me, api, push, onUnread, openRequest }) {
  const [data, setData] = useState(null); // { chats, contacts, canManageGroups }
  const [activeId, setActiveId] = useState(null);
  const [msgs, setMsgs] = useState({}); // chatId -> mensagens
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [picking, setPicking] = useState(false); // lista de contatos (nova conversa)
  const [attach, setAttach] = useState(null); // { file, url, kind }
  const [uploads, setUploads] = useState([]); // envios em andamento
  const [viewer, setViewer] = useState(null); // foto em tela cheia
  const [error, setError] = useState("");
  const [typing, setTyping] = useState([]); // quem está digitando na conversa aberta
  const [replyTo, setReplyTo] = useState(null); // mensagem sendo respondida
  const [menu, setMenu] = useState(null); // id da mensagem com o menu aberto
  const [forward, setForward] = useState(null); // { msg, selected, search }
  const [msgInfo, setMsgInfo] = useState(null); // { msg, data }
  const [panel, setPanel] = useState(false); // dados do grupo / do contato
  const [groupForm, setGroupForm] = useState(null); // { name, selected, search, photo, step }
  const [adding, setAdding] = useState(null); // { selected, search } (adicionar participantes)
  const [busy, setBusy] = useState(false);
  const [notif, setNotif] = useState("default");
  const lastTypingSent = useRef(0);
  const listRef = useRef(null);
  const fileRef = useRef(null);
  const groupPhotoRef = useRef(null);
  const field = useRef(null);
  const nearBottom = useRef(true);
  const prevChats = useRef(null);
  const activeIdRef = useRef(null);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  useEffect(() => { setNotif(notifyPermission()); }, []);

  // Tela cheia: o chat ocupa exatamente da barra de cima até o fim da tela (ou até as abas de baixo no celular).
  // Recalcula ao girar a tela e quando o teclado do celular abre (visualViewport), para o campo de digitar não sumir.
  const rootRef = useRef(null);
  useEffect(() => {
    const fit = () => {
      const el = rootRef.current;
      if (!el) return;
      const vh = window.visualViewport?.height ?? window.innerHeight;
      const nav = document.querySelector(".dash nav");
      const navFixed = nav && getComputedStyle(nav).position === "fixed";
      const keyboard = window.innerHeight - vh > 120; // teclado aberto: as abas de baixo ficam atrás dele
      const bottom = navFixed && !keyboard ? nav.getBoundingClientRect().height : 0;
      const top = el.getBoundingClientRect().top;
      el.style.height = `${Math.max(320, Math.floor(vh - Math.max(0, top) - bottom))}px`;
    };
    document.documentElement.classList.add("chat-full");
    window.scrollTo(0, 0);
    fit();
    const t = setTimeout(fit, 300);
    window.addEventListener("resize", fit);
    window.visualViewport?.addEventListener("resize", fit);
    return () => {
      clearTimeout(t);
      document.documentElement.classList.remove("chat-full");
      window.removeEventListener("resize", fit);
      window.visualViewport?.removeEventListener("resize", fit);
    };
  }, []);

  const contacts = useMemo(() => new Map((data?.contacts ?? []).map((c) => [c.id, c])), [data]);
  const chats = useMemo(() => data?.chats ?? [], [data]);
  const canManage = Boolean(data?.canManageGroups);

  const chatInfo = useCallback((c) => {
    if (!c) return null;
    if (c.id === GENERAL) return { title: GENERAL_TITLE, logo: true, group: true };
    if (c.type === "group") return { title: c.name || "Grupo", group: true, person: { name: c.name, avatar: c.photo } };
    const p = contacts.get(c.other);
    return { title: p?.name ?? "Usuário removido", person: p ?? { name: "?" } };
  }, [contacts]);

  // ---------- lista de conversas ----------
  const loadList = useCallback(async () => {
    try {
      const d = await api("/api/chat");
      notifyNew(prevChats.current, d.chats, d.me, { activeId: activeIdRef.current, title: (c) => (c.id === GENERAL ? GENERAL_TITLE : c.name ?? "Chat") });
      prevChats.current = d.chats;
      setData(d);
      onUnread?.(d.chats.reduce((t, c) => t + (c.id === activeIdRef.current && document.visibilityState === "visible" ? 0 : c.unread), 0));
      // saiu ou foi removido do grupo aberto
      const a = activeIdRef.current;
      if (a && a.startsWith("g|") && !d.chats.some((c) => c.id === a)) { setActiveId(null); setPanel(false); }
      setError("");
    } catch (e) { setError(e.message); }
  }, [api, onUnread]);
  useEffect(() => { loadList(); const t = setInterval(loadList, 6000); return () => clearInterval(t); }, [loadList]);

  // ---------- mensagens da conversa aberta ----------
  const loadMessages = useCallback(async (chatId, initialLoad) => {
    const current = msgs[chatId] ?? [];
    const last = current.filter((m) => !m.pending).at(-1);
    const url = `/api/chat/${enc(chatId)}/messages${!initialLoad && last ? `?after=${encodeURIComponent(last.createdAt)}` : ""}`;
    try {
      api(`/api/chat/${enc(chatId)}/typing`).then(setTyping).catch(() => {});
      const list = await api(url);
      if (initialLoad || !last) setMsgs((m) => ({ ...m, [chatId]: list }));
      else if (list.length) setMsgs((m) => {
        const have = new Set((m[chatId] ?? []).map((x) => x.id));
        return { ...m, [chatId]: [...(m[chatId] ?? []), ...list.filter((x) => !have.has(x.id))] };
      });
      if ((initialLoad || list.length) && document.visibilityState === "visible") {
        api(`/api/chat/${enc(chatId)}/read`, { method: "POST" }).then(loadList).catch(() => {});
      }
    } catch (e) { setError(e.message); }
  }, [api, msgs, loadList]);

  useEffect(() => {
    if (!activeId) return;
    loadMessages(activeId, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);
  useEffect(() => {
    if (!activeId) return;
    const t = setInterval(() => loadMessages(activeId, false), 2500);
    return () => clearInterval(t);
  }, [activeId, loadMessages]);
  // voltou para a aba do navegador com a conversa aberta: marca como lida
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && activeIdRef.current) {
        api(`/api/chat/${enc(activeIdRef.current)}/read`, { method: "POST" }).then(loadList).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [api, loadList]);

  // rola para o fim quando chegam mensagens (se a pessoa já estava no fim)
  const current = activeId ? msgs[activeId] ?? null : null;
  useEffect(() => {
    const el = listRef.current;
    if (el && nearBottom.current) el.scrollTop = el.scrollHeight;
  }, [current, uploads, activeId]);
  const onScroll = () => {
    const el = listRef.current;
    if (el) nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  // fecha o menu da mensagem ao clicar fora / Esc fecha janelas
  useEffect(() => {
    if (!menu) return;
    const close = (e) => { if (!e.target.closest?.(".wc-menu, .wc-more")) setMenu(null); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menu]);
  useEffect(() => {
    const esc = (e) => {
      if (e.key !== "Escape") return;
      if (viewer) setViewer(null); else if (forward) setForward(null); else if (msgInfo) setMsgInfo(null);
      else if (groupForm) setGroupForm(null); else if (adding) setAdding(null); else if (panel) setPanel(false); else if (replyTo) setReplyTo(null);
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [viewer, forward, msgInfo, groupForm, adding, panel, replyTo]);

  function openChat(id) {
    setTyping([]);
    setActiveId(id);
    setPicking(false);
    setAttach(null);
    setReplyTo(null);
    setPanel(false);
    setMenu(null);
    nearBottom.current = true;
    setTimeout(() => field.current?.focus(), 50);
  }
  const startWith = (contactId) => openChat(dmId(me.id, contactId));

  // pedido de fora (clique numa notificação)
  useEffect(() => { if (openRequest?.id) openChat(openRequest.id); }, [openRequest]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- envio ----------
  async function sendText() {
    const t = text.trim();
    if (!activeId || (!t && !attach)) return;
    if (attach) return sendAttach(t);
    const chatId = activeId;
    const reply = replyTo;
    setText("");
    setReplyTo(null);
    lastTypingSent.current = 0;
    const temp = {
      id: `tmp-${Date.now()}`, pending: true, kind: "text", text: t, from: { id: me.id, name: me.name, role: me.role }, createdAt: new Date().toISOString(),
      ...(reply ? { reply: { id: reply.id, from: reply.from?.name, fromId: reply.from?.id, kind: reply.kind, text: msgPreview(reply) } } : {}),
    };
    setMsgs((m) => ({ ...m, [chatId]: [...(m[chatId] ?? []), temp] }));
    nearBottom.current = true;
    try {
      const msg = await api(`/api/chat/${enc(chatId)}/messages`, POST_JSON({ text: t, replyTo: reply?.id ?? null }));
      setMsgs((m) => ({ ...m, [chatId]: (m[chatId] ?? []).map((x) => (x.id === temp.id ? msg : x)) }));
      loadList();
    } catch (e) {
      setMsgs((m) => ({ ...m, [chatId]: (m[chatId] ?? []).filter((x) => x.id !== temp.id) }));
      setText(t);
      setReplyTo(reply);
      push({ type: "error", title: "Mensagem não enviada", message: e.message });
    }
  }

  function pickFile(file) {
    if (!file) return;
    const kind = file.type.startsWith("image/") ? "photo" : file.type.startsWith("video/") ? "video" : null;
    if (!kind || !["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm", "video/quicktime"].includes(file.type)) {
      return push({ type: "error", title: "Formato não aceito", message: "Fotos: JPG, PNG ou WEBP. Vídeos: MP4, WEBM ou MOV." });
    }
    if (kind === "video" && file.size > 100 * 1024 * 1024) return push({ type: "error", title: "Vídeo muito grande", message: "O limite é 100 MB." });
    if (kind === "photo" && file.size > 30 * 1024 * 1024) return push({ type: "error", title: "Foto muito grande", message: "O limite é 30 MB." });
    if (attach?.url) URL.revokeObjectURL(attach.url);
    setAttach({ file, kind, url: URL.createObjectURL(file) });
    setTimeout(() => field.current?.focus(), 50);
  }

  async function sendAttach(caption) {
    const a = attach;
    const chatId = activeId;
    const reply = replyTo;
    setAttach(null);
    setText("");
    setReplyTo(null);
    const up = { id: `up-${Date.now()}`, kind: a.kind, url: a.url, progress: 0, caption, chatId };
    setUploads((u) => [...u, up]);
    nearBottom.current = true;
    try {
      const { blob, width, height } = a.kind === "photo" ? await shrinkPhoto(a.file) : { blob: a.file };
      const msg = await uploadMedia(chatId, blob, { name: a.file.name, caption, width, height, replyTo: reply?.id },
        (p) => setUploads((u) => u.map((x) => (x.id === up.id ? { ...x, progress: p } : x))));
      setMsgs((m) => ({ ...m, [chatId]: [...(m[chatId] ?? []), msg] }));
      loadList();
    } catch (e) {
      push({ type: "error", title: a.kind === "photo" ? "Foto não enviada" : "Vídeo não enviado", message: e.message });
    } finally {
      setUploads((u) => u.filter((x) => x.id !== up.id));
      URL.revokeObjectURL(a.url);
    }
  }

  async function removeMsg(m) {
    setMenu(null);
    if (!window.confirm("Apagar esta mensagem para todos?")) return;
    try {
      await api(`/api/chat/messages/${m.id}`, { method: "DELETE" });
      setMsgs((all) => ({ ...all, [activeId]: (all[activeId] ?? []).map((x) => (x.id === m.id ? { ...x, deleted: true, kind: "text", text: "", file: undefined, reply: undefined, forwarded: undefined } : x)) }));
      loadList();
    } catch (e) {
      push({ type: "error", title: "Não foi possível apagar", message: e.message });
    }
  }

  function startReply(m) {
    setMenu(null);
    setReplyTo(m);
    setTimeout(() => field.current?.focus(), 30);
  }

  async function copyMsg(m) {
    setMenu(null);
    try { await navigator.clipboard.writeText(m.text); push({ type: "info", title: "Mensagem copiada" }); } catch {}
  }

  async function openInfo(m) {
    setMenu(null);
    setMsgInfo({ msg: m, data: null });
    try {
      const d = await api(`/api/chat/messages/${m.id}`);
      setMsgInfo((x) => (x?.msg.id === m.id ? { msg: m, data: d } : x));
    } catch (e) {
      setMsgInfo(null);
      push({ type: "error", title: "Não foi possível abrir os dados", message: e.message });
    }
  }

  async function sendForward() {
    if (!forward?.selected.length) return;
    setBusy(true);
    try {
      await api(`/api/chat/${enc(activeId)}/forward`, POST_JSON({ messageId: forward.msg.id, to: forward.selected }));
      const n = forward.selected.length;
      push({ title: "Mensagem encaminhada", message: n === 1 ? "Enviada para 1 conversa." : `Enviada para ${n} conversas.` });
      setForward(null);
      loadList();
    } catch (e) {
      push({ type: "error", title: "Não foi possível encaminhar", message: e.message });
    } finally { setBusy(false); }
  }

  // menu da mensagem: botão direito (computador) ou toque longo (celular)
  const pressTimer = useRef(null);
  const pressHandlers = (id) => ({
    onContextMenu: (e) => { e.preventDefault(); setMenu(id); },
    onPointerDown: (e) => {
      if (e.pointerType !== "touch") return;
      clearTimeout(pressTimer.current);
      pressTimer.current = setTimeout(() => { setMenu(id); navigator.vibrate?.(15); }, 450);
    },
    onPointerUp: () => clearTimeout(pressTimer.current),
    onPointerMove: () => clearTimeout(pressTimer.current),
    onPointerCancel: () => clearTimeout(pressTimer.current),
  });

  function jumpTo(id) {
    const el = listRef.current?.querySelector(`[data-mid="${id}"]`);
    if (!el) return push({ type: "info", title: "Mensagem antiga", message: "A mensagem original não está carregada nesta tela." });
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
  }

  // ---------- grupos ----------
  async function createGroup() {
    const g = groupForm;
    if (!g.name.trim() || !g.selected.length) return;
    setBusy(true);
    try {
      const { id } = await api("/api/chat/groups", POST_JSON({ name: g.name, members: g.selected }));
      if (g.photo) await uploadGroupPhoto(id, g.photo.file, true);
      if (g.photo?.url) URL.revokeObjectURL(g.photo.url);
      setGroupForm(null);
      await loadList();
      openChat(id);
      push({ title: "Grupo criado", message: `"${g.name.trim()}" com ${g.selected.length + 1} participantes.` });
    } catch (e) {
      push({ type: "error", title: "Não foi possível criar o grupo", message: e.message });
    } finally { setBusy(false); }
  }

  async function uploadGroupPhoto(id, file, quiet) {
    const { blob } = await shrinkPhoto(file, 640);
    const res = await fetch(`/api/chat/groups/${groupHex(id)}/photo`, { method: "POST", headers: { "Content-Type": blob.type }, body: blob });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Falha ao enviar a foto.");
    if (!quiet) { push({ title: "Foto do grupo atualizada" }); loadList(); loadMessages(id, false); }
  }

  async function groupAction(fn, okTitle) {
    setBusy(true);
    try {
      await fn();
      if (okTitle) push({ title: okTitle });
      await loadList();
      if (activeIdRef.current) loadMessages(activeIdRef.current, false);
    } catch (e) {
      push({ type: "error", title: "Não foi possível concluir", message: e.message });
    } finally { setBusy(false); }
  }
  const patchGroup = (body) => api(`/api/chat/groups/${groupHex(activeId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  // ---------- dados de exibição ----------
  const activeChat = activeId ? chats.find((c) => c.id === activeId) ?? (activeId.startsWith("dm|") ? {
    id: activeId, type: "direct", other: activeId.split("|").slice(1).find((x) => x !== me.id), last: null, unread: 0, reads: {}, delivered: {},
  } : activeId === GENERAL ? { id: GENERAL, type: "general", reads: {}, delivered: {} } : null) : null;
  const activeInfo = chatInfo(activeChat);
  const isGroup = Boolean(activeInfo?.group);
  const isGeneral = activeId === GENERAL;
  const memberIds = useMemo(() => {
    if (!activeChat) return [];
    if (activeChat.type === "general") return [...contacts.keys()];
    return activeChat.members ?? [me.id, activeChat.other];
  }, [activeChat, contacts, me.id]);
  const memberPeople = memberIds.map((id) => contacts.get(id) ?? { id, name: "Usuário removido", role: null });
  const onlinePeople = memberPeople.filter((c) => c.online && c.id !== me.id);

  // status das minhas mensagens, pelas marcas de entrega/leitura de cada participante
  function statusOf(m) {
    if (m.pending) return "pending";
    const others = memberIds.filter((id) => id !== me.id);
    if (!others.length) return "sent";
    const at = m.createdAt;
    if (others.every((id) => activeChat?.reads?.[id] >= at)) return "read";
    if (others.every((id) => activeChat?.delivered?.[id] >= at)) return "delivered";
    return "sent";
  }

  const q = search.trim().toLowerCase();
  const shownChats = chats
    .filter((c) => c.id === GENERAL || c.last)
    .filter((c) => !q || chatInfo(c).title.toLowerCase().includes(q))
    .sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));
  const people = (data?.contacts ?? []).filter((c) => c.id !== me.id && (!q || c.name.toLowerCase().includes(q) || roleLabel(c.role).toLowerCase().includes(q)));
  const others = (data?.contacts ?? []).filter((c) => c.id !== me.id);

  // destinos do encaminhamento: conversas existentes + pessoas ainda sem conversa
  const forwardTargets = useMemo(() => {
    const list = chats.filter((c) => c.id === GENERAL || c.last).map((c) => {
      const info = chatInfo(c);
      return { id: c.id, name: info.title, logo: info.logo, group: info.group && !info.logo, person: info.person, sub: info.group ? "Grupo" : "", role: info.group ? null : info.person?.role };
    });
    const have = new Set(list.map((x) => x.id));
    for (const p of others) { const id = dmId(me.id, p.id); if (!have.has(id)) list.push({ id, name: p.name, role: p.role, person: p }); }
    return list;
  }, [chats, chatInfo, others, me.id]);

  const messages = current ?? [];
  const notifyButton = notif === "default" || notif === "denied";

  // ---------- render ----------
  return (
    <div ref={rootRef} className={`wc${activeId ? " has-chat" : ""}${panel ? " has-panel" : ""}`}>
      {/* ===== Lista ===== */}
      <aside className="wc-side">
        <div className="wc-side-head">
          <Avatar person={me} size={40} />
          <div className="wc-me"><strong>{me.name}</strong><RoleTag role={me.role} /></div>
          {canManage && (
            <button type="button" className="wc-icon" onClick={() => setGroupForm({ name: "", selected: [], search: "", photo: null, step: 1 })}
              title="Novo grupo" aria-label="Novo grupo">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6" /></svg>
            </button>
          )}
          <button type="button" className={`wc-icon${picking ? " on" : ""}`} onClick={() => { setPicking((v) => !v); setSearch(""); }}
            title="Nova conversa" aria-label="Nova conversa">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H8l-4 4zM12 8v5M9.5 10.5h5" /></svg>
          </button>
        </div>
        {notifyButton && (
          <button type="button" className="wc-notify" onClick={async () => {
            if (notif === "denied") return push({ type: "info", title: "Notificações bloqueadas", message: "Libere as notificações deste site no cadeado da barra de endereço do navegador." });
            setNotif(await askNotifyPermission());
          }}>
            <span className="wc-notify-ico"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0" /></svg></span>
            <span><b>{notif === "denied" ? "Notificações bloqueadas" : "Ativar notificações"}</b><small>{notif === "denied" ? "Libere no cadeado da barra de endereço." : "Receba um aviso quando chegar mensagem nova."}</small></span>
          </button>
        )}
        <label className="wc-search">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4" /></svg>
          <input type="search" placeholder={picking ? "Buscar pessoa ou função" : "Buscar conversa"} value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar" />
        </label>

        <div className="wc-list">
          {error && !data && <p className="wc-empty">{error}</p>}
          {!data && !error && <div className="wc-skel"><i /><i /><i /></div>}
          {data && picking && (
            <>
              {canManage && (
                <button type="button" className="wc-item wc-newgroup" onClick={() => { setPicking(false); setGroupForm({ name: "", selected: [], search: "", photo: null, step: 1 }); }}>
                  <span className="wc-av grp" style={{ width: 44, height: 44 }}><span><svg viewBox="0 0 24 24" className="wc-grp-ico"><path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6" /></svg></span></span>
                  <span className="wc-item-main"><strong>Novo grupo</strong></span>
                </button>
              )}
              <p className="wc-list-title">Nova conversa · {people.length} {people.length === 1 ? "pessoa" : "pessoas"}</p>
              {people.map((p) => (
                <button key={p.id} type="button" className="wc-item" onClick={() => startWith(p.id)}>
                  <Avatar person={p} />
                  <span className="wc-item-main">
                    <strong>{p.name}</strong>
                    <span className="wc-contact-sub"><RoleTag role={p.role} /><em className={p.online ? "on" : ""}>{p.online ? "online" : lastSeenLabel(p.lastSeen)}</em></span>
                  </span>
                </button>
              ))}
              {people.length === 0 && <p className="wc-empty">Ninguém encontrado.</p>}
            </>
          )}
          {data && !picking && shownChats.map((c) => {
            const info = chatInfo(c);
            const mine = c.last?.fromId === me.id;
            const sys = c.last?.kind === "system";
            return (
              <button key={c.id} type="button" className={`wc-item${c.id === activeId ? " on" : ""}${c.unread ? " unread" : ""}`} onClick={() => openChat(c.id)}>
                <Avatar person={info.person} logo={info.logo} group={info.group} />
                <span className="wc-item-main">
                  <span className="wc-item-top"><strong>{info.title}</strong><time>{listTime(c.lastAt)}</time></span>
                  <span className="wc-item-bottom">
                    <span className="wc-preview">
                      {c.last ? (
                        <>
                          {mine && !sys && <Ticks status={(() => {
                            const ids = c.type === "general" ? [...contacts.keys()] : c.members ?? [];
                            const o = ids.filter((id) => id !== me.id);
                            if (!o.length) return "sent";
                            if (o.every((id) => c.reads?.[id] >= c.lastAt)) return "read";
                            if (o.every((id) => c.delivered?.[id] >= c.lastAt)) return "delivered";
                            return "sent";
                          })()} />}
                          {!sys && (mine ? "Você: " : info.group ? `${firstName(c.last.from)}: ` : "")}
                          {(c.last.kind === "photo" || c.last.kind === "video") && <Icon name="camera" size={13} />} {c.last.text || (c.last.kind === "text" ? "Mensagem apagada" : "")}
                        </>
                      ) : "Converse com toda a equipe"}
                    </span>
                    {c.unread > 0 && <em className="wc-badge">{c.unread > 99 ? "99+" : c.unread}</em>}
                  </span>
                </span>
              </button>
            );
          })}
          {data && !picking && shownChats.length <= 1 && (
            <button type="button" className="wc-start" onClick={() => setPicking(true)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg> Começar conversa com alguém
            </button>
          )}
        </div>
      </aside>

      {/* ===== Conversa ===== */}
      <section className="wc-main">
        {!activeId ? (
          <div className="wc-welcome">
            <span className="wc-welcome-logo"><BrandLogo className="wc-av-logo" /></span>
            <h3>Chat Mara Rosa Leilões</h3>
            <p>Converse com toda a equipe no grupo <b>Geral</b>, em grupos ou com qualquer pessoa cadastrada. Envie textos, fotos e vídeos, responda e encaminhe mensagens. As conversas individuais são vistas só pelos participantes.</p>
            <button type="button" className="wc-cta" onClick={() => openChat(GENERAL)}>Abrir o grupo Geral</button>
          </div>
        ) : (
          <>
            <header className="wc-head">
              <button type="button" className="wc-back" onClick={() => { setActiveId(null); setPanel(false); }} aria-label="Voltar para as conversas"><Icon name="arrowLeft" size={20} /></button>
              <button type="button" className="wc-head-open" onClick={() => setPanel((v) => !v)} title={isGroup ? "Dados do grupo" : "Dados do contato"}>
                <Avatar person={activeInfo?.person} logo={activeInfo?.logo} group={isGroup} size={42} />
                <span className="wc-head-txt">
                  <strong>{activeInfo?.title}</strong>
                  {isGroup ? (
                    <span className={typing.length ? "wc-typing" : ""}>
                      {typing.length ? `${typing.map((t) => firstName(t.name)).join(", ")} ${typing.length > 1 ? "estão" : "está"} digitando…`
                        : `${memberIds.length} participantes · ${onlinePeople.length} online · toque para ver os dados`}
                    </span>
                  ) : (
                    <span className="wc-status">
                      <RoleTag role={activeInfo?.person?.role} />
                      <em className={typing.length ? "wc-typing" : activeInfo?.person?.online ? "on" : ""}>
                        {typing.length ? "digitando…" : activeInfo?.person?.online ? "online" : lastSeenLabel(activeInfo?.person?.lastSeen)}
                      </em>
                    </span>
                  )}
                </span>
              </button>
              {isGroup && onlinePeople.length > 0 && (
                <span className="wc-stack" title={onlinePeople.map((p) => p.name).join(", ") + " online"}>
                  {onlinePeople.slice(0, 5).map((p) => <Avatar key={p.id} person={p} size={28} />)}
                  {onlinePeople.length > 5 && <em>+{onlinePeople.length - 5}</em>}
                </span>
              )}
              <button type="button" className={`wc-icon${panel ? " on" : ""}`} onClick={() => setPanel((v) => !v)} title={isGroup ? "Dados do grupo" : "Dados do contato"} aria-label="Dados da conversa">
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></svg>
              </button>
            </header>

            <div className="wc-msgs" ref={listRef} onScroll={onScroll}>
              {current === null && <div className="wc-loading">Carregando mensagens…</div>}
              {current && messages.length === 0 && uploads.filter((u) => u.chatId === activeId).length === 0 && (
                <div className="wc-tip">
                  <Icon name="lock" size={14} /> {isGeneral ? "Mensagens do grupo Geral são vistas por todos os usuários." : isGroup ? "Só os participantes do grupo veem estas mensagens." : "Só vocês dois veem esta conversa. Diga olá!"}
                </div>
              )}
              {messages.map((m, i) => {
                const prev = messages[i - 1];
                const newDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
                if (m.kind === "system") {
                  return (
                    <Fragment key={m.id}>
                      {newDay && <div className="wc-day"><span>{dayLabel(m.createdAt)}</span></div>}
                      <div className="wc-sys"><span>{m.text}</span></div>
                    </Fragment>
                  );
                }
                const mine = m.from?.id === me.id;
                const sameAuthor = prev && prev.kind !== "system" && !newDay && prev.from?.id === m.from?.id && new Date(m.createdAt) - new Date(prev.createdAt) < 5 * 60e3;
                const author = contacts.get(m.from?.id) ?? m.from;
                const live = !m.deleted && !m.pending;
                return (
                  <Fragment key={m.id}>
                    {newDay && <div className="wc-day"><span>{dayLabel(m.createdAt)}</span></div>}
                    <div className={`wc-row${mine ? " mine" : ""}${sameAuthor ? " cont" : ""}`} data-mid={m.id}
                      onDoubleClick={() => live && startReply(m)}>
                      {isGroup && !mine && <span className="wc-row-av">{!sameAuthor && <Avatar person={author} size={30} />}</span>}
                      <div className={`wc-bubble${m.kind !== "text" && !m.deleted ? " media" : ""}${m.deleted ? " deleted" : ""}${menu === m.id ? " menu-open" : ""}`}
                        {...(live ? pressHandlers(m.id) : {})}>
                        {isGroup && !mine && !sameAuthor && (
                          <span className="wc-from"><b>{author?.name ?? m.from?.name}</b><RoleTag role={author?.role ?? m.from?.role} /></span>
                        )}
                        {m.deleted ? (
                          <span className="wc-text"><Icon name="x" size={12} /> {mine ? "Você apagou esta mensagem" : "Mensagem apagada"}</span>
                        ) : (
                          <>
                            {m.forwarded && <span className="wc-fwd"><svg viewBox="0 0 24 24"><path d="M14 5l7 7-7 7M21 12H9a6 6 0 0 0-6 6" /></svg> Encaminhada</span>}
                            {m.reply && (
                              <button type="button" className="wc-quote" onClick={() => jumpTo(m.reply.id)}>
                                <b>{m.reply.fromId === me.id ? "Você" : m.reply.from}</b>
                                <span>{m.reply.kind === "photo" ? "📷 " : m.reply.kind === "video" ? "🎥 " : ""}{m.reply.text}</span>
                              </button>
                            )}
                            {m.kind === "photo" && (
                              <button type="button" className="wc-photo" onClick={() => setViewer(fileUrl(m.file))} aria-label="Ver foto">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={fileUrl(m.file)} alt={m.name || "Foto"} loading="lazy"
                                  style={m.width && m.height ? { aspectRatio: `${m.width} / ${m.height}` } : undefined} />
                              </button>
                            )}
                            {m.kind === "video" && <video className="wc-video" src={fileUrl(m.file)} controls playsInline preload="metadata" />}
                            {m.text && <span className="wc-text">{m.text}</span>}
                          </>
                        )}
                        <span className="wc-meta">
                          {hhmm(m.createdAt)}
                          {mine && !m.deleted && <Ticks status={statusOf(m)} />}
                        </span>
                        {live && (
                          <button type="button" className="wc-more" onClick={() => setMenu((x) => (x === m.id ? null : m.id))} aria-label="Opções da mensagem" aria-expanded={menu === m.id}>
                            <svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg>
                          </button>
                        )}
                        {menu === m.id && (
                          <div className={`wc-menu${mine ? " right" : ""}`} role="menu">
                            <button type="button" role="menuitem" onClick={() => startReply(m)}><svg viewBox="0 0 24 24"><path d="M10 5 3 12l7 7M3 12h12a6 6 0 0 1 6 6" /></svg>Responder</button>
                            <button type="button" role="menuitem" onClick={() => { setMenu(null); setForward({ msg: m, selected: [], search: "" }); }}><svg viewBox="0 0 24 24"><path d="M14 5l7 7-7 7M21 12H9a6 6 0 0 0-6 6" /></svg>Encaminhar</button>
                            {m.text && <button type="button" role="menuitem" onClick={() => copyMsg(m)}><svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></svg>Copiar</button>}
                            {mine && <button type="button" role="menuitem" onClick={() => openInfo(m)}><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></svg>Dados da mensagem</button>}
                            {mine && <button type="button" role="menuitem" className="danger" onClick={() => removeMsg(m)}><svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" /></svg>Apagar para todos</button>}
                          </div>
                        )}
                      </div>
                    </div>
                  </Fragment>
                );
              })}
              {uploads.filter((u) => u.chatId === activeId).map((u) => (
                <div key={u.id} className="wc-row mine">
                  <div className="wc-bubble media uploading">
                    {u.kind === "photo"
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={u.url} alt="" className="wc-photo-local" />
                      : <video src={u.url} className="wc-video" muted playsInline />}
                    <span className="wc-up"><i style={{ width: `${u.progress}%` }} /><b>Enviando… {u.progress}%</b></span>
                    {u.caption && <span className="wc-text">{u.caption}</span>}
                  </div>
                </div>
              ))}
            </div>

            {replyTo && (
              <div className="wc-replybar">
                <div className="wc-quote static">
                  <b>{replyTo.from?.id === me.id ? "Você" : replyTo.from?.name}</b>
                  <span>{msgPreview(replyTo)}</span>
                </div>
                {replyTo.kind === "photo" && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fileUrl(replyTo.file)} alt="" className="wc-replythumb" />
                )}
                <button type="button" className="wc-icon" onClick={() => setReplyTo(null)} aria-label="Cancelar resposta"><Icon name="x" size={16} /></button>
              </div>
            )}

            {attach && (
              <div className="wc-attach">
                {attach.kind === "photo"
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={attach.url} alt="Foto escolhida" />
                  : <video src={attach.url} muted playsInline controls />}
                <span>{attach.kind === "photo" ? "Foto" : "Vídeo"} pronta para enviar. Escreva uma legenda (opcional) e envie.</span>
                <button type="button" className="wc-icon" onClick={() => { URL.revokeObjectURL(attach.url); setAttach(null); }} aria-label="Remover anexo"><Icon name="x" size={16} /></button>
              </div>
            )}

            {(
              <form className="wc-compose" onSubmit={(e) => { e.preventDefault(); sendText(); }}
                onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pickFile(e.dataTransfer.files?.[0]); }}>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" hidden
                  onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }} />
                <button type="button" className="wc-clip" onClick={() => fileRef.current?.click()} title="Enviar foto ou vídeo" aria-label="Enviar foto ou vídeo">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 11.5 12 20a5.5 5.5 0 0 1-7.8-7.8l8.5-8.5a3.7 3.7 0 0 1 5.2 5.2l-8.5 8.5a1.8 1.8 0 0 1-2.6-2.6l7.8-7.8" /></svg>
                </button>
                <textarea ref={field} rows={1} value={text} maxLength={2000} placeholder={attach ? "Legenda (opcional)" : "Mensagem"} aria-label="Mensagem"
                  onChange={(e) => {
                    setText(e.target.value);
                    if (e.target.value && Date.now() - lastTypingSent.current > 3000) {
                      lastTypingSent.current = Date.now();
                      api(`/api/chat/${enc(activeId)}/typing`, { method: "POST" }).catch(() => {});
                    }
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(); } }} />
                <button type="submit" className="wc-send" disabled={!text.trim() && !attach} aria-label="Enviar">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 3 10 14M21 3l-7 18-4-7-7-4z" /></svg>
                </button>
              </form>
            )}
          </>
        )}
      </section>

      {/* ===== Dados do grupo / do contato ===== */}
      {panel && activeChat && (
        <aside className="wc-panel" aria-label={isGroup ? "Dados do grupo" : "Dados do contato"}>
          <div className="wc-panel-head">
            <button type="button" className="wc-icon" onClick={() => setPanel(false)} aria-label="Fechar"><Icon name="x" size={18} /></button>
            <strong>{isGroup ? "Dados do grupo" : "Dados do contato"}</strong>
          </div>
          <div className="wc-panel-body">
            <div className="wc-panel-hero">
              <span className="wc-hero-av">
                <Avatar person={activeInfo.person} logo={activeInfo.logo} group={isGroup} size={128} />
                {activeChat.type === "group" && canManage && (
                  <>
                    <input ref={groupPhotoRef} type="file" accept="image/jpeg,image/png,image/webp" hidden
                      onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) groupAction(() => uploadGroupPhoto(activeId, f, true), "Foto do grupo atualizada"); }} />
                    <button type="button" className="wc-hero-cam" onClick={() => groupPhotoRef.current?.click()} disabled={busy} title="Mudar foto do grupo" aria-label="Mudar foto do grupo">
                      <Icon name="camera" size={18} />
                    </button>
                  </>
                )}
              </span>
              {activeChat.type === "group" && canManage ? (
                <form className="wc-rename" onSubmit={(e) => {
                  e.preventDefault();
                  const name = new FormData(e.currentTarget).get("name")?.toString().trim();
                  if (name && name !== activeChat.name) groupAction(() => patchGroup({ name }), "Nome do grupo atualizado");
                }}>
                  <input name="name" defaultValue={activeChat.name} key={activeChat.name} maxLength={60} aria-label="Nome do grupo" />
                  <button type="submit" disabled={busy}>Salvar</button>
                </form>
              ) : <h3>{activeInfo.title}</h3>}
              {isGroup
                ? <p>Grupo · {memberIds.length} participantes{activeChat.createdBy ? ` · criado por ${contacts.get(activeChat.createdBy)?.name ?? "—"}` : ""}</p>
                : <p className="wc-status"><RoleTag role={activeInfo.person?.role} /><em className={activeInfo.person?.online ? "on" : ""}>{activeInfo.person?.online ? "online" : lastSeenLabel(activeInfo.person?.lastSeen)}</em></p>}
              {activeChat.type === "group" && canManage && activeChat.photo && (
                <button type="button" className="wc-link" disabled={busy} onClick={() => groupAction(() => api(`/api/chat/groups/${groupHex(activeId)}/photo`, { method: "DELETE" }), "Foto removida")}>Remover foto</button>
              )}
            </div>

            {isGeneral && <p className="wc-panel-note">Grupo fixo com todos os usuários ativos do sistema. Ninguém pode sair ou ser removido.</p>}

            {isGroup && (
              <div className="wc-panel-sec">
                <p className="wc-list-title">{memberIds.length} participantes · {onlinePeople.length + 1} online</p>
                {activeChat.type === "group" && canManage && (
                  <button type="button" className="wc-item wc-newgroup" onClick={() => setAdding({ selected: [], search: "" })}>
                    <span className="wc-av grp" style={{ width: 40, height: 40 }}><span><svg viewBox="0 0 24 24" className="wc-grp-ico"><path d="M12 5v14M5 12h14" /></svg></span></span>
                    <span className="wc-item-main"><strong>Adicionar participantes</strong></span>
                  </button>
                )}
                {[...memberPeople].sort((a, b) => (a.id === me.id ? -1 : b.id === me.id ? 1 : a.name.localeCompare(b.name))).map((p) => (
                  <div key={p.id} className="wc-item wc-member">
                    <Avatar person={p} size={40} />
                    <span className="wc-item-main">
                      <strong>{p.id === me.id ? "Você" : p.name}{activeChat.createdBy === p.id && <small className="wc-admin">criador</small>}</strong>
                      <span className="wc-contact-sub"><RoleTag role={p.role} /><em className={p.online || p.id === me.id ? "on" : ""}>{p.id === me.id || p.online ? "online" : lastSeenLabel(p.lastSeen)}</em></span>
                    </span>
                    {activeChat.type === "group" && canManage && p.id !== me.id && (
                      <button type="button" className="wc-icon sm" disabled={busy} title={`Remover ${p.name}`} aria-label={`Remover ${p.name}`}
                        onClick={() => window.confirm(`Remover ${p.name} do grupo?`) && groupAction(() => patchGroup({ remove: [p.id] }), "Participante removido")}>
                        <Icon name="x" size={14} />
                      </button>
                    )}
                    {p.id !== me.id && <button type="button" className="wc-icon sm" title={`Conversar com ${p.name}`} aria-label={`Conversar com ${p.name}`} onClick={() => startWith(p.id)}>
                      <svg viewBox="0 0 24 24"><path d="M4 5h16v11H8l-4 4z" /></svg>
                    </button>}
                  </div>
                ))}
              </div>
            )}

            {activeChat.type === "group" && (
              <button type="button" className="wc-leave" disabled={busy} onClick={() => window.confirm("Sair deste grupo? Você deixa de ver as mensagens.") && groupAction(async () => {
                await api(`/api/chat/groups/${groupHex(activeId)}/leave`, { method: "POST" });
                setActiveId(null); setPanel(false);
              }, "Você saiu do grupo")}>
                <svg viewBox="0 0 24 24"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" /></svg> Sair do grupo
              </button>
            )}
          </div>
        </aside>
      )}

      <Layer>
      {/* ===== Novo grupo ===== */}
      {groupForm && (
        <div className="wc-modal" role="dialog" aria-label="Novo grupo" onClick={(e) => e.target === e.currentTarget && setGroupForm(null)}>
          <div className="wc-modal-card">
            <div className="wc-panel-head">
              <button type="button" className="wc-icon" onClick={() => (groupForm.step === 2 ? setGroupForm({ ...groupForm, step: 1 }) : setGroupForm(null))} aria-label="Voltar">
                {groupForm.step === 2 ? <Icon name="arrowLeft" size={18} /> : <Icon name="x" size={18} />}
              </button>
              <strong>{groupForm.step === 1 ? "Adicionar participantes" : "Novo grupo"}</strong>
              <em>{groupForm.selected.length} selecionado{groupForm.selected.length === 1 ? "" : "s"}</em>
            </div>
            {groupForm.step === 1 ? (
              <>
                {groupForm.selected.length > 0 && (
                  <div className="wc-chips">
                    {groupForm.selected.map((id) => { const p = contacts.get(id); return (
                      <button key={id} type="button" className="wc-chip" onClick={() => setGroupForm({ ...groupForm, selected: groupForm.selected.filter((x) => x !== id) })}>
                        <Avatar person={p} size={22} />{firstName(p?.name)}<Icon name="x" size={11} />
                      </button>
                    ); })}
                  </div>
                )}
                <PeoplePicker people={others} selected={groupForm.selected} search={groupForm.search} setSearch={(s) => setGroupForm({ ...groupForm, search: s })}
                  onToggle={(id) => setGroupForm({ ...groupForm, selected: groupForm.selected.includes(id) ? groupForm.selected.filter((x) => x !== id) : [...groupForm.selected, id] })} />
                <div className="wc-modal-foot">
                  <button type="button" className="wc-cta" disabled={!groupForm.selected.length} onClick={() => setGroupForm({ ...groupForm, step: 2 })}>Avançar</button>
                </div>
              </>
            ) : (
              <form className="wc-newgroup-form" onSubmit={(e) => { e.preventDefault(); createGroup(); }}>
                <label className="wc-photo-pick">
                  <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => {
                    const f = e.target.files?.[0]; e.target.value = "";
                    if (!f) return;
                    if (groupForm.photo?.url) URL.revokeObjectURL(groupForm.photo.url);
                    setGroupForm({ ...groupForm, photo: { file: f, url: URL.createObjectURL(f) } });
                  }} />
                  {groupForm.photo
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={groupForm.photo.url} alt="Foto do grupo" />
                    : <span><Icon name="camera" size={26} /><small>Adicionar foto do grupo</small></span>}
                </label>
                <label className="wc-field">
                  <span>Nome do grupo</span>
                  <input autoFocus value={groupForm.name} maxLength={60} placeholder="Ex.: Equipe do curral" onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} />
                </label>
                <p className="wc-panel-note">{groupForm.selected.length + 1} participantes (você e mais {groupForm.selected.length}). Só TI e Administrativo podem criar e editar grupos.</p>
                <div className="wc-modal-foot">
                  <button type="submit" className="wc-cta" disabled={busy || !groupForm.name.trim()}>{busy ? "Criando…" : "Criar grupo"}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ===== Adicionar participantes a um grupo ===== */}
      {adding && activeChat?.type === "group" && (
        <div className="wc-modal" role="dialog" aria-label="Adicionar participantes" onClick={(e) => e.target === e.currentTarget && setAdding(null)}>
          <div className="wc-modal-card">
            <div className="wc-panel-head">
              <button type="button" className="wc-icon" onClick={() => setAdding(null)} aria-label="Fechar"><Icon name="x" size={18} /></button>
              <strong>Adicionar participantes</strong>
              <em>{adding.selected.length} selecionado{adding.selected.length === 1 ? "" : "s"}</em>
            </div>
            <PeoplePicker people={others.filter((p) => !memberIds.includes(p.id))} selected={adding.selected} search={adding.search} setSearch={(s) => setAdding({ ...adding, search: s })}
              onToggle={(id) => setAdding({ ...adding, selected: adding.selected.includes(id) ? adding.selected.filter((x) => x !== id) : [...adding.selected, id] })} />
            <div className="wc-modal-foot">
              <button type="button" className="wc-cta" disabled={busy || !adding.selected.length}
                onClick={() => groupAction(async () => { await patchGroup({ add: adding.selected }); setAdding(null); }, "Participantes adicionados")}>Adicionar</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Encaminhar ===== */}
      {forward && (
        <div className="wc-modal" role="dialog" aria-label="Encaminhar mensagem" onClick={(e) => e.target === e.currentTarget && setForward(null)}>
          <div className="wc-modal-card">
            <div className="wc-panel-head">
              <button type="button" className="wc-icon" onClick={() => setForward(null)} aria-label="Fechar"><Icon name="x" size={18} /></button>
              <strong>Encaminhar mensagem para</strong>
              <em>{forward.selected.length}/5</em>
            </div>
            <PeoplePicker people={forwardTargets} selected={forward.selected} max={5} search={forward.search} setSearch={(s) => setForward({ ...forward, search: s })}
              onToggle={(id) => setForward({ ...forward, selected: forward.selected.includes(id) ? forward.selected.filter((x) => x !== id) : [...forward.selected, id] })}
              extraTop={<div className="wc-quote static wc-fwd-preview"><b>{forward.msg.from?.id === me.id ? "Você" : forward.msg.from?.name}</b><span>{msgPreview(forward.msg)}</span></div>} />
            <div className="wc-modal-foot">
              <button type="button" className="wc-cta" disabled={busy || !forward.selected.length} onClick={sendForward}>
                {busy ? "Enviando…" : "Encaminhar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Dados da mensagem ===== */}
      {msgInfo && (
        <div className="wc-modal" role="dialog" aria-label="Dados da mensagem" onClick={(e) => e.target === e.currentTarget && setMsgInfo(null)}>
          <div className="wc-modal-card">
            <div className="wc-panel-head">
              <button type="button" className="wc-icon" onClick={() => setMsgInfo(null)} aria-label="Fechar"><Icon name="x" size={18} /></button>
              <strong>Dados da mensagem</strong>
            </div>
            <div className="wc-info-msg"><div className="wc-bubble mine-like"><span className="wc-text">{msgPreview(msgInfo.msg)}</span><span className="wc-meta">{hhmm(msgInfo.msg.createdAt)}</span></div></div>
            {!msgInfo.data ? <div className="wc-loading">Carregando…</div> : (() => {
              const others2 = memberIds.filter((id) => id !== me.id);
              const readers = others2.filter((id) => msgInfo.data.read[id]).sort((a, b) => msgInfo.data.read[a].localeCompare(msgInfo.data.read[b]));
              const delivered = others2.filter((id) => !msgInfo.data.read[id] && msgInfo.data.delivered[id]);
              const waiting = others2.filter((id) => !msgInfo.data.read[id] && !msgInfo.data.delivered[id]);
              const row = (id, at) => { const p = contacts.get(id) ?? { name: "Usuário removido" }; return (
                <div key={id} className="wc-item wc-member">
                  <Avatar person={p} size={36} />
                  <span className="wc-item-main"><strong>{p.name}</strong><span className="wc-contact-sub"><RoleTag role={p.role} /></span></span>
                  {at && <time className="wc-info-time">{whenLabel(at)}</time>}
                </div>
              ); };
              return (
                <div className="wc-info-body">
                  <p className="wc-info-title read"><Ticks status="read" /> Lida por {readers.length}</p>
                  {readers.map((id) => row(id, msgInfo.data.read[id]))}
                  {!readers.length && <p className="wc-empty sm">Ninguém leu ainda.</p>}
                  <p className="wc-info-title"><Ticks status="delivered" /> Entregue a {delivered.length}</p>
                  {delivered.map((id) => row(id, msgInfo.data.delivered[id]))}
                  {!delivered.length && <p className="wc-empty sm">—</p>}
                  {waiting.length > 0 && <>
                    <p className="wc-info-title"><Ticks status="sent" /> Ainda não recebida ({waiting.length})</p>
                    {waiting.map((id) => row(id, null))}
                  </>}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {viewer && (
        <div className="wc-viewer" role="dialog" aria-label="Foto" onClick={() => setViewer(null)}>
          <button type="button" className="wc-viewer-x" aria-label="Fechar"><Icon name="x" size={20} /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={viewer} alt="Foto" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
      </Layer>
    </div>
  );
}
