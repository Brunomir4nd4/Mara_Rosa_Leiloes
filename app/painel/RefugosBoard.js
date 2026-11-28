"use client";

import { useMemo, useState } from "react";
import Icon from "../_ui/Icon";
import MediaGallery from "./MediaGallery";
import { CountUp } from "./Kpis";
import { categoryLabel, categoryOf, label } from "../../lib/catalog";

const pad = (n) => String(n).padStart(2, "0");
const fmtDate = (d) => (d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");

// Refugos (gado com problema). Informação sigilosa:
// - Criador: vê só os refugos vinculados a ele.
// - Equipe (TI, Administrativo, Curral): vê todos e vincula cada um ao Criador pelo select.
export default function RefugosBoard({ me, refugos }) {
  const isCriador = me.role === "CRIADOR";
  const [filter, setFilter] = useState("ALL");
  const [q, setQ] = useState("");

  const heads = refugos.reduce((t, e) => t + (Number(e.quantity) || 0), 0);
  const withMedia = refugos.filter((e) => (e.media ?? []).length).length;
  const unlinked = refugos.filter((e) => !e.ownerId).length;

  const shown = useMemo(() => refugos.filter((e) => {
    if (filter === "NONE" && e.ownerId) return false;
    if (filter === "LINKED" && !e.ownerId) return false;
    if (!q) return true;
    const t = q.toLowerCase();
    return [e.farm, e.ownerName, label(e.reason), e.notes, e.lot && pad(e.lot)].some((v) => String(v ?? "").toLowerCase().includes(t));
  }), [refugos, filter, q]);

  const kpis = isCriador
    ? [{ l: "Refugos", v: refugos.length, h: "registros vinculados a você", hl: true }, { l: "Cabeças", v: heads, h: "no total" }, { l: "Com fotos/vídeos", v: withMedia, h: "registros com anexos" }]
    : [{ l: "Refugos", v: refugos.length, h: "registros no recinto", hl: true }, { l: "Cabeças", v: heads, h: "com problema" }, { l: "Sem criador", v: unlinked, h: "falta vincular", tone: "warn" }, { l: "Com fotos/vídeos", v: withMedia, h: "registros com anexos", tone: "info" }];

  return (
    <div className="rf">
      <div className="rf-secret" role="note">
        <Icon name="lock" size={16} />
        <span>{isCriador
          ? "Informação sigilosa: só você e a equipe do recinto veem estes refugos."
          : "Informação sigilosa: refugos não aparecem no catálogo. Cada refugo é do criador cadastrado na fazenda, e cada criador vê apenas os seus."}</span>
      </div>

      <dl className="kpis">
        {kpis.map((k, i) => (
          <div key={k.l} className={`kpi${k.hl ? " hl" : ""}${k.tone ? ` t-${k.tone}` : ""}`} style={{ "--i": i }}>
            <dt>{k.l}</dt><dd><CountUp value={k.v} /></dd><p>{k.h}</p>
          </div>
        ))}
      </dl>

      {!isCriador && refugos.length > 0 && (
        <div className="filters-top">
          <div className="chips-row" role="group" aria-label="Filtrar refugos">
            {[["ALL", "Todos", refugos.length], ["NONE", "Sem criador", unlinked], ["LINKED", "Com criador", refugos.length - unlinked]].map(([k, l, n]) => (
              <button key={k} type="button" className={`kchip${filter === k ? " on" : ""}`} onClick={() => setFilter(k)}>{l} <em>{n}</em></button>
            ))}
          </div>
          <input className="rf-search" type="search" placeholder="Fazenda, criador, motivo ou lote" aria-label="Buscar refugos" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      )}

      {refugos.length === 0 ? (
        <div className="empty-card big">
          <strong>{isCriador ? "Nenhum refugo vinculado a você" : "Nenhum refugo registrado"}</strong>
          <p>{isCriador
            ? "Quando a equipe do recinto registrar um animal seu com problema, ele aparece aqui com as fotos e os vídeos."
            : "Registre refugos na aba Desembarque escolhendo o tipo “Refugo”."}</p>
        </div>
      ) : shown.length === 0 ? (
        <div className="empty-card"><strong>Nenhum refugo neste filtro</strong><p>Troque o filtro ou a busca.</p></div>
      ) : (
        <ul className="rf-list">
          {shown.map((e, i) => {
            const cat = categoryLabel(categoryOf(e.sexType, e.ageMonths), e.quantity);
            return (
              <li key={e.id} className="rf-card" style={{ "--i": Math.min(i, 10) }}>
                <header className="rf-head">
                  <span className="rf-reason">{label(e.reason)}</span>
                  <div className="rf-title">
                    <strong>{e.quantity} {cat.toLowerCase()}</strong>
                    <span>{e.farm} · desembarque em {fmtDate(e.arrivedAt || e.createdAt)}</span>
                  </div>
                  <span className={`rf-lot${e.lot ? "" : " none"}`}>{e.lot ? <>Lote <b>{pad(e.lot)}</b></> : "Sem lote"}</span>
                </header>
                <dl className="rf-data">
                  <div><dt>Raça</dt><dd>{label(e.breed)}</dd></div>
                  <div><dt>Idade</dt><dd>{e.ageMonths} meses</dd></div>
                  <div><dt>Sexo</dt><dd>{label(e.sexType)}</dd></div>
                  <div><dt>Qualidade</dt><dd>{label(e.quality)}</dd></div>
                </dl>
                {e.notes && <p className="rf-notes"><b>Observações:</b> {e.notes}</p>}
                <MediaGallery entry={e} compact />
                {!isCriador && (
                  <div className={`rf-owner${e.ownerId ? " on" : ""}`}>
                    <Icon name="lock" size={14} />
                    {e.ownerId
                      ? <span>Criador: <b>{e.ownerName}</b> <em>(do cadastro da fazenda)</em></span>
                      : <span>Fazenda sem criador — defina na aba <b>Fazenda</b>.</span>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
