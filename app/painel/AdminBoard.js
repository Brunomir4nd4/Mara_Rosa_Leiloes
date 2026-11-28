"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { initials } from "./AvatarEditor";
import { isValidCpf, formatCpf } from "../../lib/cpf";
import { ROLES, ROLE_INFO, canManageRole } from "../../lib/roles";
import { lotTitle, resolutionLabel, summarize } from "../../lib/catalog";
import Icon from "../_ui/Icon";

const pad = (n) => String(n).padStart(2, "0");
const fmtSize = (b) => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(2)} GB` : `${Math.max(0.1, b / 1024 / 1024).toFixed(1)} MB`);
const fmtDate = (d) => (d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");

const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_VIDEO = 1024 ** 3; // 1 GB (mesmo limite do servidor)
const VERCEL_LIMIT = 4.5 * 1024 * 1024;

const ROLE_ICONS = {
  TI: "M4 5h16v11H4zm-2 13h20v2H2zM9 9l-2 2 2 2m6-4 2 2-2 2",
  ADMINISTRATIVO: "M6 2h9l5 5v15H6zm8 1v5h5M9 12h8M9 16h8",
  CURRAL: "M3 21V9l9-6 9 6v12h-6v-7H9v7zm2-9h14",
  CRIADOR: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-6 8-6s8 2 8 6M17 3l2 2-2 2",
};

export default function AdminBoard({ me, lots, entries, api, push, onLotChange }) {
  const [tab, setTab] = useState("users");
  const tabs = [
    { id: "users", label: "Usuários" },
    { id: "videos", label: "Vídeos do catálogo" },
  ];
  const idx = tabs.findIndex((t) => t.id === tab);
  return (
    <div className="adm">
      <div className="tabs adm-tabs" role="tablist" style={{ "--n": tabs.length, "--idx": idx }}>
        <span className="tab-ind" aria-hidden="true" />
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={t.id === tab} className={t.id === tab ? "on" : ""} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "users"
        ? <UsersPanel me={me} api={api} push={push} />
        : <VideosPanel lots={lots} entries={entries} api={api} push={push} onLotChange={onLotChange} />}
    </div>
  );
}

/* =================== Usuários =================== */

const EMPTY = { name: "", cpf: "", role: "", password: "", confirm: "" };

function passwordProblem(p) {
  if (p.length < 8) return "Mínimo de 8 caracteres.";
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return "Use letras e números.";
  return "";
}

function strength(p) {
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
  return s; // 0–4
}

function PasswordFields({ idPrefix, form, set, show, touch, errors, required = true }) {
  const [visible, setVisible] = useState(false);
  const s = strength(form.password);
  return (
    <>
      <div className={`fld${show("password") ? " has-err" : ""}`}>
        <label htmlFor={`${idPrefix}-pw`}>Senha {!required && <span className="opt">(deixe vazio para manter)</span>}</label>
        <div className="pw-wrap">
          <input id={`${idPrefix}-pw`} type={visible ? "text" : "password"} autoComplete="new-password" maxLength={200}
            placeholder="Mínimo de 8, com letras e números" aria-invalid={show("password") ? "true" : "false"}
            value={form.password} onChange={(e) => set("password", e.target.value)} onBlur={() => touch("password")} />
          <button type="button" className="pw-eye" onClick={() => setVisible((v) => !v)} aria-label={visible ? "Esconder senha" : "Mostrar senha"}>
            {visible ? "Ocultar" : "Ver"}
          </button>
        </div>
        {form.password && <div className={`pw-meter s${s}`} aria-hidden="true"><i /><i /><i /><i /></div>}
        {show("password") && <p className="ferr" role="alert">{errors.password}</p>}
      </div>
      <div className={`fld${show("confirm") ? " has-err" : ""}`}>
        <label htmlFor={`${idPrefix}-pw2`}>Confirmar senha</label>
        <input id={`${idPrefix}-pw2`} type={visible ? "text" : "password"} autoComplete="new-password" maxLength={200}
          aria-invalid={show("confirm") ? "true" : "false"}
          value={form.confirm} onChange={(e) => set("confirm", e.target.value)} onBlur={() => touch("confirm")} />
        {show("confirm") && <p className="ferr" role="alert">{errors.confirm}</p>}
      </div>
    </>
  );
}

function RolePicker({ value, onChange, allowed, invalid, name }) {
  return (
    <div className={`role-pick${invalid ? " invalid" : ""}`} role="radiogroup" aria-label="Função do usuário">
      {ROLES.map((r) => {
        const off = !allowed(r);
        return (
          <label key={r} className={`role-opt r-${r.toLowerCase()}${value === r ? " on" : ""}${off ? " off" : ""}`}>
            <input type="radio" name={name} value={r} checked={value === r} disabled={off} onChange={() => onChange(r)} />
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ROLE_ICONS[r]} /></svg>
            <strong>{ROLE_INFO[r].label}</strong>
            <span>{off ? "Só a TI pode atribuir esta função." : ROLE_INFO[r].desc}</span>
          </label>
        );
      })}
    </div>
  );
}

function validateUser(form, { requirePassword }) {
  const e = {};
  if (form.name !== undefined && form.name.trim().length < 3) e.name = "Digite o nome completo (mínimo de 3 letras).";
  if (form.cpf !== undefined && !isValidCpf(form.cpf)) e.cpf = !form.cpf ? "Informe o CPF." : "CPF inválido. Confira os 11 números.";
  if (form.role !== undefined && !form.role) e.role = "Escolha a função do usuário.";
  if (requirePassword || form.password) {
    const p = passwordProblem(form.password);
    if (p) e.password = p;
    else if (form.confirm !== form.password) e.confirm = "As senhas não conferem.";
  }
  return e;
}

function UsersPanel({ me, api, push }) {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [serverFields, setServerFields] = useState({});
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    api("/api/admin/users").then(setUsers).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // erro do servidor (ex.: CPF já cadastrado) vale até a pessoa mexer naquele campo
  const errors = { ...validateUser(form, { requirePassword: true }), ...serverFields };
  const show = (k) => (submitted || touched[k]) && errors[k];
  const touch = (k) => setTouched((t) => ({ ...t, [k]: true }));
  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setServerFields((s) => { if (!(k in s)) return s; const n = { ...s }; delete n[k]; return n; });
  };
  const allowed = (r) => canManageRole(me.role, r);

  async function create(e) {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length) {
      const first = { name: "usr-name", cpf: "usr-cpf", password: "usr-pw", confirm: "usr-pw2" }[Object.keys(errors).find((k) => k !== "role")];
      if (first) document.getElementById(first)?.focus();
      return;
    }
    setSaving(true);
    try {
      const user = await api("/api/admin/users", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, cpf: form.cpf, role: form.role, password: form.password }),
      });
      setUsers((l) => [...(l ?? []), user]);
      push({ title: "Usuário criado", message: `${user.name} · ${ROLE_INFO[user.role].label}. Já pode entrar com CPF e senha.` });
      setForm(EMPTY); setTouched({}); setSubmitted(false);
    } catch (err) {
      if (/CPF/.test(err.message)) setServerFields({ cpf: err.message });
      push({ type: "error", title: "Não foi possível criar o usuário", message: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function patch(u, body, done) {
    try {
      const updated = await api(`/api/admin/users/${u.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      setUsers((l) => l.map((x) => (x.id === updated.id ? updated : x)));
      push(done(updated));
      return updated;
    } catch (err) {
      push({ type: "error", title: "Não foi possível alterar", message: err.message });
      throw err;
    }
  }

  function toggleActive(u) {
    if (u.active && !window.confirm(`Desativar ${u.name}? A pessoa sai do painel na hora e não consegue mais entrar.`)) return;
    patch(u, { active: !u.active }, (x) => (x.active
      ? { title: "Usuário reativado", message: `${x.name} pode entrar de novo.` }
      : { type: "info", title: "Usuário desativado", message: `${x.name} não tem mais acesso ao painel.` })).catch(() => {});
  }

  const counts = useMemo(() => Object.fromEntries(ROLES.map((r) => [r, (users ?? []).filter((u) => u.role === r && u.active).length])), [users]);
  const list = (users ?? []).filter((u) => filter === "ALL" || u.role === filter);
  const errCount = submitted ? Object.keys(errors).length : 0;

  return (
    <>
      <dl className="adm-stats">
        {ROLES.map((r) => (
          <div key={r} className={`r-${r.toLowerCase()}`}>
            <dt>{ROLE_INFO[r].label}</dt>
            <dd>{users ? counts[r] : "–"}</dd>
            <p>{{ TI: "Todas as abas", ADMINISTRATIVO: "Todas as abas", CURRAL: "Recinto, sem Pista e Admin", CRIADOR: "Só os próprios refugos" }[r]}</p>
          </div>
        ))}
      </dl>

      <form onSubmit={create} noValidate className="adm-form">
        <h3 className="adm-h3">Novo usuário</h3>
        {errCount > 0 && (
          <div className="vbox" role="alert">
            <span className="vbox-ico" aria-hidden="true">!</span>
            <div><strong>Revise {errCount === 1 ? "1 campo" : `${errCount} campos`} antes de criar</strong></div>
          </div>
        )}
        <div className="grid">
          <div className={`fld${show("name") ? " has-err" : ""}`}>
            <label htmlFor="usr-name">Nome completo</label>
            <input id="usr-name" autoComplete="off" maxLength={80} placeholder="Ex.: Maria da Silva"
              aria-invalid={show("name") ? "true" : "false"} value={form.name}
              onChange={(e) => set("name", e.target.value)} onBlur={() => touch("name")} />
            {show("name") && <p className="ferr" role="alert">{errors.name}</p>}
          </div>
          <div className={`fld${show("cpf") ? " has-err" : ""}`}>
            <label htmlFor="usr-cpf">CPF <span className="opt">(usado para entrar)</span></label>
            <input id="usr-cpf" inputMode="numeric" autoComplete="off" maxLength={14} placeholder="000.000.000-00"
              aria-invalid={show("cpf") ? "true" : "false"} value={form.cpf}
              onChange={(e) => set("cpf", formatCpf(e.target.value))} onBlur={() => touch("cpf")} />
            {show("cpf") && <p className="ferr" role="alert">{errors.cpf}</p>}
          </div>
          <div className="fld wide">
            <span className="flabel">Função</span>
            <RolePicker name="usr-role" value={form.role} onChange={(r) => set("role", r)} allowed={allowed} invalid={show("role")} />
            {show("role") && <p className="ferr" role="alert">{errors.role}</p>}
          </div>
          <PasswordFields idPrefix="usr" form={form} set={set} show={show} touch={touch} errors={errors} />
        </div>
        <button type="submit" disabled={saving}>{saving ? "Criando…" : "Criar usuário"}</button>
      </form>

      <div className="adm-list-head">
        <h2>Usuários</h2>
        <div className="chips-row" role="group" aria-label="Filtrar por função">
          {["ALL", ...ROLES].map((r) => (
            <button key={r} type="button" className={`chip${filter === r ? " on" : ""}`} onClick={() => setFilter(r)}>
              {r === "ALL" ? "Todos" : ROLE_INFO[r].label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="vbox" role="alert"><span className="vbox-ico">!</span><div><strong>Não foi possível carregar</strong><p>{error}</p></div></div>}
      {!users && !error && <p className="empty">Carregando usuários…</p>}
      {users && list.length === 0 && <div className="empty-card"><strong>Nenhum usuário nesta função</strong><p>Crie um usuário no formulário acima.</p></div>}
      {users && list.length > 0 && (
        <ul className="usr-list">
          {list.map((u) => {
            const isMe = u.id === me.id;
            const canEdit = !u.system && allowed(u.role);
            return (
              <li key={u.id} className={`usr${u.active ? "" : " inactive"}`}>
                <span className={`usr-av r-${u.role.toLowerCase()}`} aria-hidden="true">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {u.avatar ? <img src={u.avatar} alt="" /> : initials(u.name)}
                </span>
                <div className="usr-main">
                  <strong>{u.name}{isMe && <em className="usr-me">você</em>}</strong>
                  <span>CPF {u.cpf}{u.system ? " · conta do servidor (.env)" : ` · criado em ${fmtDate(u.createdAt)}`}</span>
                </div>
                <span className={`role-tag r-${u.role.toLowerCase()}`}>{ROLE_INFO[u.role].label}</span>
                <span className={`usr-st${u.active ? " on" : ""}`}>{u.active ? "Ativo" : "Inativo"}</span>
                <div className="usr-act">
                  {canEdit ? (
                    <>
                      <button type="button" className="mini" onClick={() => setEditing(u)}>Editar</button>
                      {!isMe && (
                        <button type="button" className={`mini${u.active ? " danger" : ""}`} onClick={() => toggleActive(u)}>
                          {u.active ? "Desativar" : "Reativar"}
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="usr-lock" title={u.system ? "Definida no servidor" : "Só a TI altera usuários de TI"}><Icon name="lock" size={16} /></span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editing && <EditUser user={editing} me={me} allowed={allowed} onClose={() => setEditing(null)} onSave={patch} />}
    </>
  );
}

function EditUser({ user, me, allowed, onClose, onSave }) {
  const ref = useRef(null);
  const isMe = user.id === me.id;
  const [form, setForm] = useState({ name: user.name, role: user.role, password: "", confirm: "" });
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => { ref.current?.showModal(); }, []);

  const errors = validateUser(form, { requirePassword: false });
  const show = (k) => (submitted || touched[k]) && errors[k];
  const touch = (k) => setTouched((t) => ({ ...t, [k]: true }));
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function save(e) {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length) return;
    const body = {};
    if (form.name.trim() !== user.name) body.name = form.name;
    if (form.role !== user.role) body.role = form.role;
    if (form.password) body.password = form.password;
    if (!Object.keys(body).length) return onClose();
    setSaving(true);
    try {
      await onSave(user, body, (x) => ({
        title: "Usuário atualizado",
        message: body.password && !isMe ? `${x.name}: senha trocada. A pessoa precisa entrar de novo.` : `${x.name} · ${ROLE_INFO[x.role].label}`,
      }));
      onClose();
    } catch {
      setSaving(false);
    }
  }

  return (
    <dialog ref={ref} className="adm-dlg" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      <form onSubmit={save} noValidate>
        <div className="dlg-head">
          <h3 className="adm-h3">Editar usuário</h3>
          <button type="button" className="dlg-x" onClick={onClose} aria-label="Fechar"><Icon name="x" /></button>
        </div>
        <p className="dlg-sub">CPF {user.cpf} · o CPF não muda (é o login).</p>
        <div className="grid">
          <div className={`fld wide${show("name") ? " has-err" : ""}`}>
            <label htmlFor="edit-name">Nome completo</label>
            <input id="edit-name" maxLength={80} value={form.name} onChange={(e) => set("name", e.target.value)} onBlur={() => touch("name")} />
            {show("name") && <p className="ferr" role="alert">{errors.name}</p>}
          </div>
          <div className="fld wide">
            <span className="flabel">Função {isMe && <span className="opt">(você não pode mudar a própria função)</span>}</span>
            <RolePicker name="edit-role" value={form.role} onChange={(r) => set("role", r)} allowed={(r) => !isMe && allowed(r)} />
          </div>
          <PasswordFields idPrefix="edit" form={form} set={set} show={show} touch={touch} errors={errors} required={false} />
        </div>
        <div className="dlg-foot">
          <button type="button" className="mini" onClick={onClose}>Cancelar</button>
          <button type="submit" className="mini pri" disabled={saving}>{saving ? "Salvando…" : "Salvar alterações"}</button>
        </div>
      </form>
    </dialog>
  );
}

/* =================== Vídeos do catálogo =================== */

// Lê largura/altura do vídeo no navegador (enviadas ao servidor para mostrar HD, Full HD, 4K…)
function readVideoSize(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { resolve({ width: v.videoWidth, height: v.videoHeight, duration: v.duration }); URL.revokeObjectURL(url); };
    v.onerror = () => { resolve({}); URL.revokeObjectURL(url); };
    v.src = url;
  });
}

function uploadVideo(lotId, file, size, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/admin/lots/${lotId}/video`);
    xhr.setRequestHeader("Content-Type", file.type);
    if (size.width) xhr.setRequestHeader("X-Video-Width", String(size.width));
    if (size.height) xhr.setRequestHeader("X-Video-Height", String(size.height));
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch {}
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else if (xhr.status === 413) reject(new Error("Arquivo grande demais para o servidor. Na Vercel, cada envio aceita até ~4,5 MB."));
      else reject(new Error(data.error || "Falha no envio. Tente de novo."));
    };
    xhr.onerror = () => reject(new Error("Sem conexão. Verifique a internet e tente de novo."));
    xhr.send(file);
  });
}

function VideosPanel({ lots, entries, api, push, onLotChange }) {
  const [filter, setFilter] = useState("ALL");
  const [q, setQ] = useState("");
  const [progress, setProgress] = useState({}); // lotId → %
  const [preview, setPreview] = useState(null);
  const inputs = useRef({});

  const byId = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);
  const rows = useMemo(() => lots.filter((l) => l.kind !== "REFUGO").sort((a, b) => a.lot - b.lot).map((l) => ({
    lot: l, s: summarize(l.entryIds.map((id) => byId.get(id)).filter(Boolean)),
  })), [lots, byId]);
  const withVideo = rows.filter((r) => r.lot.video).length;
  const shown = rows.filter((r) =>
    (filter === "ALL" || (filter === "MISSING" ? !r.lot.video : Boolean(r.lot.video))) &&
    (!q || String(r.lot.lot) === q.replace(/^0+(?=\d)/, "") || r.lot.farm.toLowerCase().includes(q.toLowerCase())));

  async function pick(row, file) {
    if (!file) return;
    const l = row.lot;
    if (!VIDEO_TYPES.includes(file.type)) return push({ type: "error", title: "Formato não aceito", message: "Envie MP4 (recomendado), WEBM ou MOV." });
    if (file.size > MAX_VIDEO) return push({ type: "error", title: "Vídeo muito grande", message: "O limite é 1 GB por vídeo." });
    if (l.video && !window.confirm(`O lote ${pad(l.lot)} já tem vídeo. Trocar pelo novo arquivo?`)) return;
    const size = await readVideoSize(file);
    setProgress((p) => ({ ...p, [l.id]: 0 }));
    try {
      const updated = await uploadVideo(l.id, file, size, (pct) => setProgress((p) => ({ ...p, [l.id]: pct })));
      onLotChange(updated);
      const res = resolutionLabel(size.width, size.height);
      push({ title: `Vídeo do lote ${pad(l.lot)} publicado`, message: `${res ? `${res} · ` : ""}${fmtSize(file.size)}. Já aparece no catálogo.` });
    } catch (e) {
      push({ type: "error", title: `Não foi possível enviar o vídeo do lote ${pad(l.lot)}`, message: e.message });
    } finally {
      setProgress((p) => { const n = { ...p }; delete n[l.id]; return n; });
    }
  }

  async function remove(row) {
    const l = row.lot;
    if (!window.confirm(`Remover o vídeo do lote ${pad(l.lot)}? Ele some do catálogo.`)) return;
    try {
      const updated = await api(`/api/admin/lots/${l.id}/video`, { method: "DELETE" });
      onLotChange(updated);
      push({ type: "info", title: `Vídeo do lote ${pad(l.lot)} removido`, message: "O lote continua no catálogo, sem vídeo." });
    } catch (e) {
      push({ type: "error", title: "Não foi possível remover", message: e.message });
    }
  }

  if (!rows.length) {
    return (
      <div className="empty-card big">
        <strong>Nenhum lote vinculado ainda</strong>
        <p>Os vídeos são adicionados por lote. Vincule os lotes na aba Lotes e volte aqui.</p>
      </div>
    );
  }

  return (
    <>
      <div className="vid-top">
        <div className="vid-meter">
          <strong>{withVideo} de {rows.length}</strong> lotes com vídeo
          <div className="vid-bar"><i style={{ width: `${(withVideo / rows.length) * 100}%` }} /></div>
        </div>
        <p className="vid-tip">
          Dica: grave na horizontal, em <b>1080p (Full HD)</b> ou mais, e envie em <b>MP4</b>. O arquivo é guardado como veio, sem perder qualidade.
          <br /><span>Na Vercel cada envio aceita até ~{(VERCEL_LIMIT / 1024 / 1024).toFixed(1)} MB; vídeos maiores precisam de um storage externo (Vercel Blob/S3).</span>
        </p>
      </div>

      <div className="filters-top">
        <div className="chips-row" role="group" aria-label="Filtrar lotes">
          {[["ALL", "Todos", rows.length], ["MISSING", "Sem vídeo", rows.length - withVideo], ["DONE", "Com vídeo", withVideo]].map(([k, label, n]) => (
            <button key={k} type="button" className={`chip${filter === k ? " on" : ""}`} onClick={() => setFilter(k)}>{label} <em>{n}</em></button>
          ))}
        </div>
        <input className="vid-search" type="search" placeholder="Lote ou fazenda" aria-label="Buscar lote ou fazenda" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {shown.length === 0 ? (
        <div className="empty-card"><strong>Nenhum lote neste filtro</strong><p>Troque o filtro ou a busca.</p></div>
      ) : (
        <ul className="vid-grid">
          {shown.map((r) => {
            const l = r.lot;
            const pct = progress[l.id];
            const busy = pct !== undefined;
            const res = l.video && resolutionLabel(l.video.width, l.video.height);
            return (
              <li key={l.id} className={`vid-card${l.video ? " has" : ""}${busy ? " busy" : ""}`}>
                <div className="vid-thumb">
                  {l.video ? (
                    <button type="button" className="vid-play" onClick={() => setPreview(l)} aria-label={`Assistir vídeo do lote ${pad(l.lot)}`}>
                      <video src={`/api/videos/${encodeURIComponent(l.video.file)}#t=0.1`} muted playsInline preload="metadata" tabIndex={-1} />
                      <span className="vp-ico" aria-hidden="true"><Icon name="play" size={20} /></span>
                    </button>
                  ) : (
                    <div className="vid-empty" aria-hidden="true">
                      <svg viewBox="0 0 24 24"><path d="M3 6h13v12H3zm13 4 5-3v10l-5-3" /></svg>
                      <span>Sem vídeo</span>
                    </div>
                  )}
                  <span className="vid-lot">LOTE {pad(l.lot)}</span>
                  {l.kind === "REFUGO" && <span className="vid-kind">Refugo</span>}
                  {res && <span className="vid-res">{res}</span>}
                  {busy && (
                    <div className="vid-prog" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                      <div><i style={{ width: `${pct}%` }} /></div><span>Enviando… {pct}%</span>
                    </div>
                  )}
                </div>
                <div className="vid-body">
                  <strong>{lotTitle(r.s)}</strong>
                  <span>{l.farm}</span>
                  {l.video && <span className="vid-meta">{fmtSize(l.video.size)} · enviado em {fmtDate(l.video.uploadedAt)}</span>}
                </div>
                <div className="vid-act">
                  <input ref={(el) => { inputs.current[l.id] = el; }} type="file" accept={VIDEO_TYPES.join(",")} hidden
                    onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; pick(r, f); }} />
                  <button type="button" className="mini pri" disabled={busy} onClick={() => inputs.current[l.id]?.click()}>
                    {l.video ? "Trocar vídeo" : "Enviar vídeo"}
                  </button>
                  {l.video && <button type="button" className="mini danger" disabled={busy} onClick={() => remove(r)}>Remover</button>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {preview && <VideoPreview lot={preview} onClose={() => setPreview(null)} />}
    </>
  );
}

function VideoPreview({ lot, onClose }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return (
    <dialog ref={ref} className="lightbox" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      <div className="lb-box">
        <button type="button" className="lb-x" onClick={onClose} aria-label="Fechar"><Icon name="x" /></button>
        <video src={`/api/videos/${encodeURIComponent(lot.video.file)}`} controls autoPlay playsInline />
        <div className="lb-bar"><span>Lote {pad(lot.lot)} · {lot.farm}</span></div>
      </div>
    </dialog>
  );
}
