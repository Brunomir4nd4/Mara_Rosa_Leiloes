"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import FarmForm from "./FarmForm";
import CattleForm from "./CattleForm";
import LotsBoard from "./LotsBoard";
import PistaBoard from "./PistaBoard";
import { Toasts, useToasts } from "./Toasts";
import { categoryLabel, categoryOf, lotTitle, summarize } from "../../lib/catalog";
import { STATUS_INFO, brl } from "../../lib/pista";

const SECTIONS = [
  { id: "farm", label: "Fazenda", title: "Cadastro da fazenda", sub: "Dados do titular e da propriedade." },
  { id: "cattle", label: "Desembarque", title: "Desembarque", sub: "Registre o gado que chegou de cada fazenda. Depois, vincule na aba Lotes." },
  { id: "lots", label: "Lotes", title: "Lotes", sub: "Escolha um lote disponível e vincule a uma fazenda com o gado do desembarque." },
  { id: "pista", label: "Pista", title: "Pista", sub: "Durante o leilão: registre o resultado de cada lote. Os dados do desembarque já vêm preenchidos." },
];

const pad = (n) => String(n).padStart(2, "0");

export default function PainelPage() {
  const router = useRouter();
  const [active, setActive] = useState("farm");
  const [restored, setRestored] = useState(false);
  const [farms, setFarms] = useState([]);
  const [entries, setEntries] = useState([]);
  const [lots, setLots] = useState([]);
  const [capacity, setCapacity] = useState({ total: 40, max: 500 });
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const { toasts, push, dismiss } = useToasts();

  // Lembra a aba aberta (URL ?aba= e sessão) para voltar ao mesmo lugar, ex.: depois do relatório
  useEffect(() => {
    let saved = new URLSearchParams(window.location.search).get("aba");
    try { saved ||= sessionStorage.getItem("painel:aba"); } catch {}
    if (SECTIONS.some((s) => s.id === saved)) setActive(saved);
    setRestored(true);
  }, []);
  useEffect(() => {
    if (!restored) return; // só grava depois de restaurar a aba salva
    try { sessionStorage.setItem("painel:aba", active); } catch {}
    window.history.replaceState(null, "", `/painel?aba=${active}`);
  }, [active, restored]);

  // Chamada à API; se a sessão expirou, volta para o login
  async function api(url, options) {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      router.replace("/login?next=/painel");
      throw new Error(data.error || "Sessão expirada.");
    }
    if (!res.ok) throw new Error(data.error || "Algo deu errado. Tente de novo.");
    return data;
  }

  useEffect(() => {
    Promise.all([api("/api/admin/farms"), api("/api/admin/entries"), api("/api/admin/lots"), api("/api/admin/lots/capacity")])
      .then(([f, e, l, c]) => {
        setFarms(f);
        setEntries(e);
        setLots(l);
        setCapacity(c);
      })
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const post = (url, body) => api(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  async function addFarm(data) {
    const farm = await post("/api/admin/farms", data);
    setFarms((l) => [...l, farm]);
    push({ title: "Fazenda cadastrada", message: `${farm.farmName} já pode receber desembarques.` });
  }

  async function addEntry(data) {
    const entry = await post("/api/admin/entries", data);
    setEntries((l) => [...l, entry]);
    push({
      title: "Desembarque registrado",
      message: `${entry.quantity} ${categoryLabel(categoryOf(entry.sexType, entry.ageMonths), entry.quantity).toLowerCase()} · ${entry.farm}. Vincule na aba Lotes.`,
    });
  }

  async function linkLot(data) {
    try {
      const lot = await post("/api/admin/lots", data);
      setLots((l) => [...l, lot]);
      const s = summarize(entries.filter((e) => lot.entryIds.includes(e.id)));
      push({ title: `Lote ${pad(lot.lot)} vinculado`, message: `${lot.farm} · ${lotTitle(s)}` });
    } catch (e) {
      push({ type: "error", title: "Não foi possível vincular", message: e.message });
      throw e;
    }
  }

  async function unlinkLot(lot) {
    try {
      await api(`/api/admin/lots/${lot.id}`, { method: "DELETE" });
      setLots((l) => l.filter((x) => x.id !== lot.id));
      push({ type: "info", title: `Lote ${pad(lot.lot)} desvinculado`, message: "O gado voltou para “Sem lote”." });
    } catch (e) {
      push({ type: "error", title: "Não foi possível desvincular", message: e.message });
    }
  }

  // delta > 0 adiciona lotes no final do quadro; delta < 0 remove lotes disponíveis do final
  async function resizeLots(delta) {
    const c = await post("/api/admin/lots/capacity", delta > 0 ? { add: delta } : { remove: -delta });
    setCapacity(c);
    const n = Math.abs(delta);
    push(delta > 0
      ? { title: n === 1 ? "1 lote adicionado" : `${n} lotes adicionados`, message: `O leilão agora tem ${c.total} lotes.` }
      : { type: "info", title: n === 1 ? "1 lote removido" : `${n} lotes removidos`, message: `O leilão agora tem ${c.total} lotes.` });
  }

  // Resultado do lote na pista
  async function savePista(lot, data) {
    try {
      const updated = await api(`/api/admin/lots/${lot.id}/pista`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      setLots((l) => l.map((x) => (x.id === updated.id ? updated : x)));
      const p = updated.pista;
      const detail = p.status === "ARREMATADO" ? `${brl(p.value)} · ${p.buyer}`
        : p.status === "DEFENDIDO" ? `Proposta de ${brl(p.proposal)} recusada pelo dono`
        : STATUS_INFO[p.status].hint;
      push({ type: p.status === "ARREMATADO" ? "success" : "info", title: `Lote ${pad(updated.lot)} · ${STATUS_INFO[p.status].label}`, message: detail });
    } catch (e) {
      push({ type: "error", title: "Não foi possível salvar o lote", message: e.message });
      throw e;
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const section = SECTIONS.find((s) => s.id === active);

  return (
    <div className="dash">
      <aside className="side">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="dlogo" src="/logo.jpg" alt="Mara Rosa Leilões – A vitrine do boi" width={886} height={861} />
        <nav aria-label="Navegação do painel">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={s.id === active ? "on" : ""}
              aria-current={s.id === active ? "page" : undefined}
              onClick={() => setActive(s.id)}
            >
              {s.label}
            </button>
          ))}
        </nav>
        <button type="button" className="logout" onClick={logout}>Sair</button>
      </aside>
      <main className={`content${active === "lots" || active === "pista" ? " wide" : ""}`} key={active}>
        <h1>{section.title}</h1>
        <p className="dsub">{section.sub}</p>
        {loadError && (
          <div className="vbox" role="alert">
            <span className="vbox-ico" aria-hidden="true">!</span>
            <div><strong>Não foi possível carregar os dados</strong><p>{loadError}</p></div>
          </div>
        )}
        {loading ? (
          <p className="empty">Carregando…</p>
        ) : (
          <>
            {active === "farm" && <FarmForm records={farms} onAdd={addFarm} />}
            {active === "cattle" && <CattleForm records={entries} farms={farms} lots={lots} onAdd={addEntry} />}
            {active === "lots" && (
              <LotsBoard lots={lots} entries={entries} farms={farms} total={capacity.total} max={capacity.max}
                onLink={linkLot} onUnlink={unlinkLot} onResize={resizeLots}
                goToDesembarque={() => setActive("cattle")} />
            )}
            {active === "pista" && (
              <PistaBoard lots={lots} entries={entries} onSave={savePista} goToLotes={() => setActive("lots")} />
            )}
          </>
        )}
      </main>
      <Toasts toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
