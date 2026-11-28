"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import FarmForm from "./FarmForm";
import CattleForm from "./CattleForm";
import LotsBoard from "./LotsBoard";
import PistaBoard from "./PistaBoard";
import RetiradaBoard from "./RetiradaBoard";
import AdminBoard from "./AdminBoard";
import ThemePicker, { useTheme } from "./ThemePicker";
import BrandLogo from "../_ui/BrandLogo";
import TopBar, { UserMenu } from "./TopBar";
import Kpis from "./Kpis";
import Assistant from "./Assistant";
import RefugosBoard from "./RefugosBoard";
import { Toasts, useToasts } from "./Toasts";
import { categoryLabel, categoryOf, lotTitle, summarize } from "../../lib/catalog";
import { STATUS_INFO, brl } from "../../lib/pista";

const SECTIONS = [
  { id: "farm", label: "Fazenda", title: "Cadastro da fazenda", sub: "Dados do titular e da propriedade." },
  { id: "cattle", label: "Desembarque", short: "Desemb.", title: "Desembarque", sub: "Registre o gado que chegou de cada fazenda. Depois, vincule na aba Lotes." },
  { id: "lots", label: "Lotes", title: "Lotes", sub: "Escolha um lote disponível e vincule a uma fazenda com o gado do desembarque." },
  { id: "pista", label: "Pista", title: "Pista", sub: "Durante o leilão: registre o resultado de cada lote. Os dados do desembarque já vêm preenchidos." },
  { id: "pickup", label: "Retirada", title: "Retirada", sub: "O comprador busca o gado arrematado. O saldo de cada lote vem do desembarque." },
  { id: "refugos", label: "Refugos", title: "Refugos", sub: "Animais com problema registrados no desembarque, com fotos e vídeos para o dono." },
  { id: "admin", label: "Admin", title: "Administração", sub: "Usuários do painel e suas funções, e os vídeos que aparecem no catálogo." },
];

const pad = (n) => String(n).padStart(2, "0");

// Ícones das abas (aparecem no menu lateral e na barra inferior do celular)
const NAV_ICONS = {
  farm: "M3 11 12 4l9 7v9h-6v-6H9v6H3z",
  cattle: "M3 6h12v10H3zm12 4h4l2 3v3h-6zM6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm11 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  lots: "M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 0h8v8h-8z",
  pista: "M12 2a7 7 0 0 1 7 7c0 4-3 6-4 9H9c-1-3-4-5-4-9a7 7 0 0 1 7-7zm-3 18h6v2H9z",
  pickup: "M3 5h11v10H3zm11 4h4l3 3v3h-7zM6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm11 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 8l2 2 4-4",
  refugos: "M12 3 2 20h20zm0 6v5m0 3v.01",
  admin: "M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5zm0 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
};

export default function PainelPage() {
  const router = useRouter();
  const [active, setActive] = useState("farm");
  const [restored, setRestored] = useState(false);
  const [farms, setFarms] = useState([]);
  const [entries, setEntries] = useState([]);
  const [lots, setLots] = useState([]);
  const [pickups, setPickups] = useState([]);
  const [capacity, setCapacity] = useState({ total: 40, max: 500 });
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null); // usuário logado e abas que a função dele vê
  const [refugos, setRefugos] = useState([]);
  const [criadores, setCriadores] = useState([]);
  const sections = me ? SECTIONS.filter((s) => me.tabs.includes(s.id)) : [];
  const can = (tab) => Boolean(me?.tabs.includes(tab));
  const { toasts, push, dismiss } = useToasts();
  const theme = useTheme();

  // Pista com alterações não salvas: confirma antes de trocar de aba, sair ou fechar a página
  const pistaDirty = useRef(false);
  const confirmLeavePista = () =>
    !pistaDirty.current || window.confirm("Há alterações não salvas no lote da Pista. Sair mesmo assim e perder o que foi digitado?");
  function goTo(id) {
    if (id === active) return;
    if (active === "pista" && !confirmLeavePista()) return;
    pistaDirty.current = false;
    setActive(id);
  }
  useEffect(() => {
    const warn = (e) => { if (pistaDirty.current) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  // Efeitos: luz que segue o mouse nos cartões e ondulação ao clicar nos botões
  useEffect(() => {
    const SPOT = ".kpi,.vid-card,.usr,.rf-card,.rt-stats>div,.adm-stats>div,.dash form";
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const move = (e) => {
      const el = e.target.closest?.(SPOT);
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    const down = (e) => {
      if (reduce) return;
      const b = e.target.closest?.(".dash button");
      if (!b || b.disabled) return;
      const cs = getComputedStyle(b);
      if (cs.position === "static" || cs.overflow === "visible") return; // só onde a onda fica contida
      const r = b.getBoundingClientRect();
      const size = Math.max(r.width, r.height) * 2;
      const s = document.createElement("span");
      s.className = "ripple";
      s.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
      b.appendChild(s);
      s.addEventListener("animationend", () => s.remove());
    };
    document.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerdown", down);
    return () => { document.removeEventListener("pointermove", move); document.removeEventListener("pointerdown", down); };
  }, []);

  // Lembra a aba aberta (URL ?aba= e sessão) para voltar ao mesmo lugar, ex.: depois do relatório
  useEffect(() => {
    let saved = new URLSearchParams(window.location.search).get("aba");
    try { saved ||= sessionStorage.getItem("painel:aba"); } catch {}
    if (SECTIONS.some((s) => s.id === saved)) setActive(saved);
    setRestored(true);
  }, []);
  // aba salva que a função não vê (ex.: Curral com ?aba=pista) volta para Fazenda
  useEffect(() => {
    if (me && !me.tabs.includes(active)) setActive(me.tabs[0]);
  }, [me, active]);
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
      // sessão encerrada/revogada: limpa o cookie antes de ir ao login (evita voltar direto ao painel)
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
      router.replace("/login?next=/painel");
      throw new Error(data.error || "Sessão expirada.");
    }
    if (!res.ok) throw new Error(data.error || "Algo deu errado. Tente de novo.");
    return data;
  }

  useEffect(() => {
    (async () => {
      const u = await api("/api/auth/me");
      setMe(u);
      if (u.role === "CRIADOR") {
        // o Criador só carrega os refugos dele
        setRefugos(await api("/api/refugos"));
        return;
      }
      const [f, e, l, c, p, cr] = await Promise.all([api("/api/admin/farms"), api("/api/admin/entries"), api("/api/admin/lots"),
        api("/api/admin/lots/capacity"), api("/api/admin/pickups"), api("/api/admin/criadores")]);
      setFarms(f); setEntries(e); setLots(l); setCapacity(c); setPickups(p); setCriadores(cr);
    })()
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
    const what = `${entry.quantity} ${categoryLabel(categoryOf(entry.sexType, entry.ageMonths), entry.quantity).toLowerCase()} · ${entry.farm}`;
    push(entry.kind === "REFUGO"
      ? { type: "info", title: "Refugo registrado", message: `${what}. Vincule em um lote de refugo na aba Lotes.` }
      : { title: "Desembarque registrado", message: `${what}. Vincule na aba Lotes.` });
    return entry;
  }

  // registro atualizado (ex.: anexos de foto/vídeo adicionados ou removidos)
  const updateEntry = (entry) => setEntries((l) => l.map((x) => (x.id === entry.id ? entry : x)));

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

  // Retirada do gado arrematado: atualiza o lote (saldo) e o histórico
  async function addPickup(data) {
    try {
      const { pickup, lot } = await post("/api/admin/pickups", data);
      setPickups((l) => [pickup, ...l]);
      setLots((l) => l.map((x) => (x.id === lot.id ? lot : x)));
      const saldo = Math.max(0, (lot.heads ?? 0) - (lot.pickedUp ?? 0));
      push({ title: `Retirada do lote ${pad(lot.lot)} registrada`, message: `${pickup.quantity} cabeças · ${pickup.buyer}. ${saldo ? `Saldo: ${saldo}.` : "Lote concluído."}` });
    } catch (e) {
      push({ type: "error", title: "Não foi possível registrar a retirada", message: e.message });
      throw e;
    }
  }

  async function removePickup(p) {
    try {
      const { lot } = await api(`/api/admin/pickups/${p.id}`, { method: "DELETE" });
      setPickups((l) => l.filter((x) => x.id !== p.id));
      if (lot) setLots((l) => l.map((x) => (x.id === lot.id ? lot : x)));
      push({ type: "info", title: "Retirada desfeita", message: `${p.quantity} cabeças voltaram para o saldo do lote ${pad(p.lot)}.` });
    } catch (e) {
      push({ type: "error", title: "Não foi possível desfazer", message: e.message });
    }
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
      // o comprador pode ter sido corrigido: atualiza o histórico de retiradas
      if (updated.pickedUp) api("/api/admin/pickups").then(setPickups).catch(() => {});
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
    if (active === "pista" && !confirmLeavePista()) return;
    pistaDirty.current = false;
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const section = sections.find((s) => s.id === active) ?? SECTIONS.find((s) => s.id === active);
  const changeAvatar = (url, how) => {
    setMe((m) => ({ ...m, avatar: url }));
    push(how === "saved" ? { title: "Foto atualizada", message: "Sua nova foto já aparece no painel." } : { type: "info", title: "Foto removida", message: "Voltamos a mostrar suas iniciais." });
  };
  // aba Refugos: recarrega ao abrir (anexos e vínculos podem ter mudado em outra aba)
  useEffect(() => {
    if (active === "farm" && me && me.role !== "CRIADOR") { api("/api/admin/criadores").then(setCriadores).catch(() => {}); return; }
    if (active !== "refugos" || !me) return;
    api("/api/refugos").then(setRefugos).catch(() => {});
    if (me.role !== "CRIADOR") api("/api/admin/criadores").then(setCriadores).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, me]);

  async function changeFarmCriador(farm, criadorId) {
    try {
      const { farm: updated, linked } = await api(`/api/admin/farms/${farm.id}/criador`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ criadorId }) });
      setFarms((l) => l.map((x) => (x.id === updated.id ? updated : x)));
      if (linked) api("/api/admin/entries").then(setEntries).catch(() => {});
      push(criadorId
        ? { title: "Criador definido", message: `${updated.farmName} agora é de ${updated.criadorName}.${linked ? ` Os refugos da fazenda passaram para ele.` : ""}` }
        : { type: "info", title: "Criador removido", message: `${updated.farmName} ficou sem criador. Nenhum criador vê os refugos dela agora.` });
    } catch (e) {
      push({ type: "error", title: "Não foi possível definir o criador", message: e.message });
    }
  }

  const updateLot = (lot) => setLots((l) => l.map((x) => (x.id === lot.id ? lot : x)));

  return (
    <div className="dash">
      <aside className="side">
        <BrandLogo className="dlogo" />
        <nav aria-label="Navegação do painel">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              className={s.id === active ? "on" : ""}
              aria-current={s.id === active ? "page" : undefined}
              onClick={() => goTo(s.id)}
            >
              <svg className="nav-ico" viewBox="0 0 24 24" aria-hidden="true"><path d={NAV_ICONS[s.id]} /></svg>
              <span className="nav-l">{s.label}</span>{s.short && <span className="nav-s">{s.short}</span>}
            </button>
          ))}
        </nav>
        {me && <div className="side-user"><UserMenu me={me} onLogout={logout} onAvatar={changeAvatar} compact /></div>}
        <ThemePicker theme={theme} />
        <button type="button" className="logout" onClick={logout}>Sair</button>
      </aside>
      <div className="main-col">
      {me && <TopBar me={me} section={section} onLogout={logout} onAvatar={changeAvatar} />}
      <main className={`content${["lots", "pista", "pickup", "refugos", "admin"].includes(active) ? " wide" : ""}`} key={active}>
        <h1><span className="h1-ico" aria-hidden="true"><svg viewBox="0 0 24 24"><path d={NAV_ICONS[section.id]} /></svg></span><span className="h1-t">{section.title}</span></h1>
        <p className="dsub">{section.sub}</p>
        {!loading && me && (active === "farm" || active === "cattle") && <Kpis tab={active} farms={farms} entries={entries} />}
        {loadError && (
          <div className="vbox" role="alert">
            <span className="vbox-ico" aria-hidden="true">!</span>
            <div><strong>Não foi possível carregar os dados</strong><p>{loadError}</p></div>
          </div>
        )}
        {loading || !me ? (loadError ? null : 
          <div className="skel" aria-busy="true" aria-label="Carregando"><i /><i /><i /></div>
        ) : (
          <>
            {active === "farm" && <FarmForm records={farms} criadores={criadores} onAdd={addFarm} onCriadorChange={changeFarmCriador} />}
            {active === "cattle" && <CattleForm records={entries} farms={farms} lots={lots} onAdd={addEntry} onEntryChange={updateEntry} />}
            {active === "lots" && (
              <LotsBoard lots={lots} entries={entries} farms={farms} total={capacity.total} max={capacity.max}
                onLink={linkLot} onUnlink={unlinkLot} onResize={resizeLots} onEntryChange={updateEntry}
                goToDesembarque={() => setActive("cattle")} />
            )}
            {active === "pickup" && (
              <RetiradaBoard lots={lots} entries={entries} pickups={pickups} onAdd={addPickup} onRemove={removePickup}
                goToPista={can("pista") ? () => setActive("pista") : undefined} />
            )}
            {active === "refugos" && can("refugos") && (
              <RefugosBoard me={me} refugos={refugos} />
            )}
            {active === "admin" && can("admin") && (
              <AdminBoard me={me} lots={lots} entries={entries} api={api} push={push} onLotChange={updateLot} />
            )}
            {active === "pista" && can("pista") && (
              <PistaBoard lots={lots} entries={entries} onSave={savePista} goToLotes={() => setActive("lots")}
                onDirtyChange={(d) => { pistaDirty.current = d; }} />
            )}
          </>
        )}
      </main>
      </div>
      {me && <Assistant me={me} tab={active} />}
      <Toasts toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
