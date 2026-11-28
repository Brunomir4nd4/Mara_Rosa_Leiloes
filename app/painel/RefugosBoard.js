"use client";

import { useEffect, useMemo, useState } from "react";
import Icon from "../_ui/Icon";
import Select from "../_ui/Select";
import MediaGallery from "./MediaGallery";
import { CountUp } from "./Kpis";
import { categoryLabel, categoryOf, label } from "../../lib/catalog";

const pad = (n) => String(n).padStart(2, "0");
const fmtDate = (d) => (d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");

// Troca o Criador dono de um refugo (null = sem criador). Devolve o registro atualizado.
async function saveOwner(entryId, ownerId) {
  const res = await fetch(`/api/admin/entries/${entryId}/owner`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ownerId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Não foi possível trocar o criador. Tente de novo.");
  return data;
}

// Refugos (gado com problema). Informação sigilosa:
// - Criador: vê só os refugos vinculados a ele.
// - Equipe (TI, Administrativo, Curral): vê todos. O dono vem do Criador cadastrado na fazenda,
//   e a equipe pode trocar o dono de cada refugo pelo select do cartão.
export default function RefugosBoard({ me, refugos: fromProps, onOwnerChange }) {
  const isCriador = me.role === "CRIADOR";
  const [filter, setFilter] = useState("ALL");
  const [q, setQ] = useState("");
  const [criadores, setCriadores] = useState([]);
  const [owners, setOwners] = useState({}); // trocas feitas aqui: id do refugo → { ownerId, ownerName }
  const [ownerErr, setOwnerErr] = useState({}); // id do refugo → mensagem de erro
  const [saving, setSaving] = useState(null);

  // lista de Criadores para o select (só a equipe tem acesso)
  useEffect(() => {
    if (isCriador) return;
    fetch("/api/admin/criadores").then((r) => (r.ok ? r.json() : [])).then(setCriadores).catch(() => {});
  }, [isCriador]);
  // lista nova do servidor já traz as trocas: descarta as locais
  useEffect(() => setOwners({}), [fromProps]);
  const refugos = useMemo(() => fromProps.map((e) => (owners[e.id] ? { ...e, ...owners[e.id] } : e)), [fromProps, owners]);

  async function changeOwner(e, ownerId) {
    setSaving(e.id);
    setOwnerErr((m) => ({ ...m, [e.id]: "" }));
    try {
      const updated = await saveOwner(e.id, ownerId);
      setOwners((m) => ({ ...m, [e.id]: { ownerId: updated.ownerId ?? null, ownerName: updated.ownerName ?? null } }));
      onOwnerChange?.({ ...e, ownerId: updated.ownerId ?? null, ownerName: updated.ownerName ?? null }); // Desembarque já mostra o novo dono
    } catch (err) {
      setOwnerErr((m) => ({ ...m, [e.id]: err.message }));
    } finally {
      setSaving(null);
    }
  }

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
          : "Informação sigilosa: refugos não aparecem no catálogo. Cada refugo é do criador cadastrado na fazenda (dá para trocar no cartão), e cada criador vê apenas os seus."}</span>
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
                  <div className={`rf-owner${e.ownerId ? " on" : ""}`} style={{ flexWrap: "wrap" }}>
                    <Icon name="lock" size={14} />
                    <span id={`rf-own-l-${e.id}`}>{e.ownerId
                      ? <>Só <b>{e.ownerName}</b> (e a equipe) vê este refugo.</>
                      : <>Sem criador — só a equipe vê este refugo.</>}</span>
                    {/* no celular o select desce para a linha de baixo */}
                    <div style={{ marginLeft: "auto", flex: "0 1 240px", minWidth: 200 }} aria-busy={saving === e.id}>
                      <Select id={`rf-own-${e.id}`} value={e.ownerId ?? ""} ariaLabel={`Criador que pode ver o refugo de ${e.farm}`}
                        onChange={(v) => { if (saving !== e.id && v !== (e.ownerId ?? "")) changeOwner(e, v || null); }}
                        options={[{ value: "", label: "Sem criador" }, ...criadores.map((c) => ({ value: c.id, label: c.name })),
                          ...(e.ownerId && !criadores.some((c) => c.id === e.ownerId) ? [{ value: e.ownerId, label: `${e.ownerName ?? "Criador"} (inativo)`, disabled: true }] : [])]} />
                    </div>
                  </div>
                )}
                {!isCriador && ownerErr[e.id] && <p className="rf-notes" role="alert">{ownerErr[e.id]}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
