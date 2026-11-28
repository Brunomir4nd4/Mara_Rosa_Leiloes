"use client";

import { useEffect, useRef, useState } from "react";
import { ROLE_INFO } from "../../lib/roles";
import AvatarEditor, { Avatar } from "./AvatarEditor";

const TZ = "America/Sao_Paulo";

function greeting(d) {
  const h = Number(d.toLocaleString("pt-BR", { timeZone: TZ, hour: "2-digit", hour12: false }));
  return h < 5 ? "Boa madrugada" : h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

// Relógio do leilão (atualiza a cada 30 s; só no navegador, para não divergir do HTML do servidor)
function useNow() {
  const [now, setNow] = useState(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  return now;
}

// Cartão do usuário logado com menu (dados, função, abas liberadas e Sair)
export function UserMenu({ me, onLogout, onAvatar, compact = false }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const editPhoto = () => { setOpen(false); setEditing(true); };
  const root = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (!root.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const role = me.role.toLowerCase();
  return (
    <div className={`umenu r-${role}${compact ? " compact" : ""}${open ? " open" : ""}`} ref={root}>
      <button type="button" className="um-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        aria-label={`${me.name}, ${me.roleLabel}. Abrir menu do usuário`}>
        <Avatar name={me.name} src={me.avatar} dot />
        {!compact && (
          <span className="um-txt">
            <strong>{me.name}</strong>
            <em>{me.roleLabel}</em>
          </span>
        )}
        {!compact && <svg className="um-caret" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>}
      </button>
      {open && (
        <div className="um-pop" role="menu">
          <div className="um-head">
            <button type="button" className="um-photo" onClick={editPhoto} aria-label={me.avatar ? "Trocar foto de perfil" : "Adicionar foto de perfil"}>
              <Avatar name={me.name} src={me.avatar} className="big" />
              <span className="um-cam" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 7h3l2-3h6l2 3h3v13H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" /></svg></span>
            </button>
            <div>
              <strong>{me.name}</strong>
              <span>CPF {me.cpf}</span>
            </div>
          </div>
          <div className="um-role">
            <span className="role-tag">{me.roleLabel}</span>
            <p>{ROLE_INFO[me.role].desc}</p>
          </div>
          {me.system && <p className="um-note">Conta do sistema (definida no servidor).</p>}
          <button type="button" role="menuitem" className="um-item" onClick={editPhoto}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h3l2-3h6l2 3h3v13H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" /></svg>
            {me.avatar ? "Trocar foto de perfil" : "Adicionar foto de perfil"}
          </button>
          <button type="button" role="menuitem" className="um-out" onClick={onLogout}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" /></svg>
            Sair do painel
          </button>
        </div>
      )}
      {editing && (
        <AvatarEditor me={me} onClose={() => setEditing(false)}
          onSaved={(url) => onAvatar?.(url, "saved")} onRemoved={() => onAvatar?.(null, "removed")} />
      )}
    </div>
  );
}

// Barra superior do conteúdo: onde estou, saudação, relógio e usuário
export default function TopBar({ me, section, onLogout, onAvatar }) {
  const now = useNow();
  const first = me.system ? "" : me.name.split(" ")[0];
  return (
    <header className="topbar">
      <div className="tb-left">
        <span className="tb-crumb">Painel <b aria-hidden="true">/</b> <strong>{section.label}</strong></span>
        <span className="tb-hello">{now ? `${greeting(now)}${first ? `, ${first}` : ""}` : " "}</span>
      </div>
      <div className="tb-right">
        {now && (
          <span className="tb-clock" title="Horário de Brasília">
            <i aria-hidden="true" />
            <span>{now.toLocaleDateString("pt-BR", { timeZone: TZ, weekday: "short", day: "2-digit", month: "short" }).replace(/\./g, "")}</span>
            <strong>{now.toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" })}</strong>
          </span>
        )}
        <UserMenu me={me} onLogout={onLogout} onAvatar={onAvatar} />
      </div>
    </header>
  );
}
