"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Select from "../_ui/Select";
import { BREEDS, CATEGORIES, QUALITIES, ageLabel, categoryLabel, label, lotTitle, resolutionLabel, sexLabel } from "../../lib/catalog";
import Icon from "../_ui/Icon";
import PageTheme from "../_ui/PageTheme";
import BrandLogo from "../_ui/BrandLogo";
import { CountUp } from "../painel/Kpis";

const SEX_TABS = [
  { id: "ALL", label: "Todos" },
  { id: "MACHO", label: "Machos" },
  { id: "FEMEA", label: "Fêmeas" },
];
const MALE_CATEGORIES = ["BEZERROS", "GARROTES", "BOIS"];
const SORTS = {
  lot: { label: "Nº do lote", fn: (a, b) => a.lot - b.lot },
  qtyDesc: { label: "Mais cabeças", fn: (a, b) => b.quantity - a.quantity || a.lot - b.lot },
  ageAsc: { label: "Mais novos", fn: (a, b) => a.ageMin - b.ageMin || a.lot - b.lot },
  ageDesc: { label: "Mais velhos", fn: (a, b) => b.ageMax - a.ageMax || a.lot - b.lot },
};
const NO_FILTERS = { category: [], quality: [], breed: [] };
// filtro → campo (lista) do lote. Um lote pode juntar vários registros do desembarque.
const FIELD = { category: "categories", quality: "qualities", breed: "breeds" };

const fmt = (n) => n.toLocaleString("pt-BR");
const plural = (n, one, many) => `${fmt(n)} ${n === 1 ? one : many}`;
const lotNo = (n) => String(n).padStart(2, "0");

function QualityBadges({ qualities }) {
  if (!qualities?.length) return null;
  return (
    <span className="qs">
      {qualities.map((q) => <span key={q} className={`q q-${q.toLowerCase()} inline`}>{label(q)}</span>)}
    </span>
  );
}

function LotCard({ lot, index, onOpen }) {
  const videoRef = useRef(null);
  const res = lot.video && resolutionLabel(lot.video.width, lot.video.height);

  // Prévia muda ao passar o mouse; no toque, o clique abre direto o player
  const play = () => videoRef.current?.play().catch(() => {});
  const stop = () => {
    const v = videoRef.current;
    if (v) { v.pause(); v.currentTime = 0.1; }
  };

  const title = lotTitle(lot);
  const mixed = lot.categories.length > 1;

  return (
    <li className="card" style={{ "--i": Math.min(index, 12) }}>
      <button type="button" className="card-btn" onClick={() => onOpen(lot)} onMouseEnter={play} onMouseLeave={stop}
        onFocus={play} onBlur={stop}
        aria-label={`Lote ${lot.lot}: ${title}${mixed ? ` (${lot.categories.map(label).join(", ")})` : ""}, ${lot.breeds.map(label).join(" e ")}, ${ageLabel(lot.ageMin, lot.ageMax)}${lot.qualities.length ? `, qualidade ${lot.qualities.map(label).join(" e ")}` : ""}. Ver detalhes`}>
        <div className="media">
          {lot.video ? (
            <>
              <video ref={videoRef} src={`${lot.video.url}#t=0.1`} muted loop playsInline preload="metadata" tabIndex={-1} />
              <span className="play" aria-hidden="true" />
            </>
          ) : (
            <div className="novideo" aria-hidden="true">
              <BrandLogo className="nv-logo" />
            </div>
          )}
          <span className="lotno" aria-hidden="true"><small>Lote</small>{lotNo(lot.lot)}</span>
          {res && <span className="res">{res}</span>}
        </div>
        <div className="info">
          <div className="info-head">
            <h3>{title}</h3>
            <QualityBadges qualities={lot.qualities} />
          </div>
          {mixed && <p className="mix" aria-hidden="true">{lot.categories.map(label).join(" + ")}</p>}
          <ul className="specs" aria-hidden="true">
            <li><span>Raça</span>{lot.breeds.map(label).join(" / ")}</li>
            <li><span>Idade</span>{ageLabel(lot.ageMin, lot.ageMax)}</li>
            <li><span>Sexo</span>{sexLabel(lot.sex)}</li>
          </ul>
          {lot.farm && <p className="farm">{lot.farm}</p>}
        </div>
      </button>
    </li>
  );
}

function Player({ lot, onClose }) {
  const dialog = useRef(null);

  useEffect(() => {
    const d = dialog.current;
    if (lot && !d.open) d.showModal();
    if (!lot && d.open) d.close();
  }, [lot]);

  const res = lot?.video && resolutionLabel(lot.video.width, lot.video.height);

  return (
    <dialog ref={dialog} className="player" onClose={onClose} onClick={(e) => e.target === dialog.current && onClose()}
      aria-labelledby="player-title">
      {lot && (
        <div className="player-box">
          <button type="button" className="close" onClick={onClose} aria-label="Fechar"><Icon name="x" /></button>
          <div className="player-media">
            {lot.video ? (
              // Arquivo original, sem recompressão: o navegador exibe na resolução enviada
              <video key={lot.id} src={lot.video.url} controls autoPlay playsInline preload="auto" />
            ) : (
              <div className="novideo">
                <BrandLogo className="nv-logo" />
              </div>
            )}
          </div>
          <div className="player-info">
            <p className="kicker">Lote {lotNo(lot.lot)}</p>
            <h2 id="player-title">{lotTitle(lot)}</h2>
            <div className="tags">
              <QualityBadges qualities={lot.qualities} />
              {res && <span className="res inline">{res}</span>}
            </div>
            <dl>
              <div><dt>Quantidade</dt><dd>{plural(lot.quantity, "cabeça", "cabeças")}</dd></div>
              <div><dt>Sexo</dt><dd>{sexLabel(lot.sex)}</dd></div>
              <div><dt>Idade</dt><dd>{ageLabel(lot.ageMin, lot.ageMax)}</dd></div>
              <div><dt>Raça</dt><dd>{lot.breeds.map(label).join(" / ")}</dd></div>
              {lot.farm && <div><dt>Fazenda</dt><dd>{lot.farm}</dd></div>}
            </dl>
            <h3 className="comp-title">Composição do lote</h3>
            <ul className="comp">
              {lot.entries.map((e, i) => (
                <li key={i}>
                  <strong>{fmt(e.quantity)} {categoryLabel(e.category, e.quantity)}</strong>
                  <span>{label(e.breed)} · {plural(e.ageMonths, "mês", "meses")}{e.quality ? ` · ${label(e.quality)}` : ""}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </dialog>
  );
}

// Efeitos: cartões inclinam e recebem luz seguindo o mouse; botão "voltar ao topo"
function useCatalogEffects() {
  const [showTop, setShowTop] = useState(false);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const move = (e) => {
      const el = e.target.closest?.(".cat .card-btn, .cat .stats>div");
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      el.style.setProperty("--mx", `${x}px`);
      el.style.setProperty("--my", `${y}px`);
      if (!reduce && el.classList.contains("card-btn")) {
        el.style.setProperty("--ry", `${((x / r.width) - 0.5) * 6}deg`);
        el.style.setProperty("--rx", `${(0.5 - (y / r.height)) * 6}deg`);
      }
    };
    const leave = (e) => {
      const el = e.target.closest?.(".cat .card-btn");
      if (el && !el.contains(e.relatedTarget)) { el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg"); }
    };
    const scroll = () => setShowTop(window.scrollY > 700);
    document.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerout", leave);
    window.addEventListener("scroll", scroll, { passive: true });
    return () => { document.removeEventListener("pointermove", move); document.removeEventListener("pointerout", leave); window.removeEventListener("scroll", scroll); };
  }, []);
  return showTop;
}

export default function Catalog({ lots }) {
  const showTop = useCatalogEffects();
  const [sex, setSex] = useState("ALL");
  const [filters, setFilters] = useState(NO_FILTERS);
  const [sort, setSort] = useState("lot");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(null);

  // Categorias que fazem sentido para a aba de sexo escolhida
  const categories = CATEGORIES.filter((c) =>
    sex === "ALL" ? true : sex === "MACHO" ? MALE_CATEGORIES.includes(c) : !MALE_CATEGORIES.includes(c)
  );

  function changeSex(id) {
    setSex(id);
    // tira categorias que não pertencem à nova aba
    setFilters((f) => ({
      ...f,
      category: f.category.filter((c) => id === "ALL" || (id === "MACHO") === MALE_CATEGORIES.includes(c)),
    }));
  }

  const toggle = (key, value) =>
    setFilters((f) => ({ ...f, [key]: f[key].includes(value) ? f[key].filter((v) => v !== value) : [...f[key], value] }));

  const [showFilters, setShowFilters] = useState(false); // celular: grupos de filtros recolhidos
  const activeCount = Object.values(filters).reduce((t, v) => t + v.length, 0);
  const hasFilters = sex !== "ALL" || Object.values(filters).some((v) => v.length) || search;
  const clear = () => { setSex("ALL"); setFilters(NO_FILTERS); setSearch(""); };

  // Aplica todos os filtros, menos o grupo "skip" (para contar quantos lotes cada opção traria)
  // Busca pelo nº do lote aceita com ou sem zero à esquerda ("3", "03" e "003" acham o lote 3)
  const term = search.replace(/^0+(?=\d)/, "");
  const matches = (l, skip) =>
    (sex === "ALL" || l.sexes.includes(sex)) &&
    (!search || String(l.lot).includes(term) || lotNo(l.lot).includes(search)) &&
    Object.keys(filters).every((k) => k === skip || !filters[k].length || filters[k].some((v) => l[FIELD[k]].includes(v)));

  const visible = useMemo(
    () => lots.filter((l) => matches(l)).sort(SORTS[sort].fn),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lots, sex, filters, sort, search]
  );
  const countFor = (key, value) => lots.filter((l) => l[FIELD[key]].includes(value) && matches(l, key)).length;
  const countSex = (id) => lots.filter((l) => id === "ALL" || l.sexes.includes(id)).length;

  const heads = visible.reduce((s, l) => s + l.quantity, 0);
  const males = visible.reduce((s, l) => s + l.males, 0);
  const sexIndex = SEX_TABS.findIndex((t) => t.id === sex);

  const chipGroups = [
    { key: "category", title: "Categoria", options: categories },
    { key: "quality", title: "Qualidade", options: QUALITIES },
    { key: "breed", title: "Raça", options: BREEDS },
  ];

  return (
    <div className="cat">
      <PageTheme />
      <button type="button" className={`to-top${showTop ? " on" : ""}`} aria-label="Voltar ao topo" tabIndex={showTop ? 0 : -1}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}><Icon name="arrowLeft" /></button>
      <header className="cat-top">
        <a href="/catalogo" className="brand" aria-label="Mara Rosa Leilões – catálogo">
          <BrandLogo className="cb-logo" />
        </a>
        <div className="cat-hero">
          <a href="/login" className="to-login">
            <span className="tl-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M15.4 5.4 14 4l-8 8 8 8 1.4-1.4L8.8 12z" /></svg>
            </span>
            <span className="tl-txt"><small>Voltar para</small>Login</span>
          </a>
          <p className="kicker">A vitrine do boi</p>
          <h1>Catálogo de lotes</h1>
          <p className="lead">Confira os lotes deste leilão: categoria, raça, idade e qualidade de cada um.</p>
        </div>
      </header>

      <dl className="stats" aria-live="polite">
        <div style={{ "--i": 0 }}><dt>Lotes</dt><dd><CountUp value={visible.length} /></dd></div>
        <div style={{ "--i": 1 }}><dt>Cabeças</dt><dd><CountUp value={heads} /></dd></div>
        <div style={{ "--i": 2 }}><dt>Machos</dt><dd><CountUp value={males} /></dd></div>
        <div style={{ "--i": 3 }}><dt>Fêmeas</dt><dd><CountUp value={heads - males} /></dd></div>
      </dl>

      <section className="filters" aria-label="Filtros do catálogo">
        <div className="filters-top">
          <div className="tabs" role="tablist" aria-label="Sexo" style={{ "--idx": sexIndex, "--n": SEX_TABS.length }}>
            <span className="tab-ind" aria-hidden="true" />
            {SEX_TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={sex === t.id} className={sex === t.id ? "on" : ""}
                onClick={() => changeSex(t.id)}>
                {t.label} <em>{countSex(t.id)}</em>
              </button>
            ))}
          </div>
          <div className="tools">
            <label className="search">
              <span className="sr">Buscar pelo número do lote</span>
              <input inputMode="numeric" placeholder="Nº do lote" value={search} maxLength={4}
                onChange={(e) => setSearch(e.target.value.replace(/\D/g, ""))} />
            </label>
            <Select id="cat-sort" ariaLabel={`Ordenar por: ${SORTS[sort].label}`} value={sort} onChange={setSort}
              options={Object.entries(SORTS).map(([id, s]) => ({ value: id, label: s.label }))} />
          </div>
        </div>

        <button type="button" className={`f-toggle${showFilters ? " on" : ""}`} aria-expanded={showFilters} aria-controls="cat-fgroups"
          onClick={() => setShowFilters((v) => !v)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18M6 12h12M10 19h4" /></svg>
          Filtros{activeCount > 0 && <em>{activeCount}</em>}
          <svg className="f-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </button>
        <div className={`fgroups${showFilters ? " open" : ""}`} id="cat-fgroups">
          {chipGroups.map((g) => (
            <div className="fgroup" key={g.key} role="group" aria-label={g.title}>
              <span className="ftitle">{g.title}</span>
              <div className="chips">
                {g.options.map((o) => {
                  const on = filters[g.key].includes(o);
                  const n = countFor(g.key, o);
                  return (
                    <button key={o} type="button" className={`chip${on ? " on" : ""}${!on && n === 0 ? " empty" : ""}`} aria-pressed={on}
                      onClick={() => toggle(g.key, o)} disabled={!on && n === 0}>
                      {label(o)} <em>{n}</em>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {hasFilters && (
            <button type="button" className="clear clear-pill" onClick={clear}>
              <Icon name="x" size={14} /> Limpar filtros
            </button>
          )}
        </div>
      </section>

      {lots.length === 0 ? (
        <p className="cat-empty">Os lotes deste leilão ainda não foram publicados. Volte em breve.</p>
      ) : visible.length === 0 ? (
        <p className="cat-empty">Nenhum lote com esses filtros. <button type="button" className="clear" onClick={clear}>Limpar filtros</button></p>
      ) : (
        <ul className="grid-lots" key={`${sex}|${JSON.stringify(filters)}|${sort}|${search}`}>
          {visible.map((l, i) => <LotCard key={l.id} lot={l} index={i} onOpen={setOpen} />)}
        </ul>
      )}

      <footer className="cat-foot">Mara Rosa Leilões · A vitrine do boi</footer>

      <Player lot={open} onClose={() => setOpen(null)} />
    </div>
  );
}
