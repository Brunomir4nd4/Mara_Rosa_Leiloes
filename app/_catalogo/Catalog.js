"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Select from "../_ui/Select";
import { BREEDS, CATEGORIES, QUALITIES, ageLabel, categoryLabel, label, lotTitle, resolutionLabel, sexLabel } from "../../lib/catalog";

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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.jpg" alt="" width={886} height={861} />
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
          <button type="button" className="close" onClick={onClose} aria-label="Fechar">✕</button>
          <div className="player-media">
            {lot.video ? (
              // Arquivo original, sem recompressão: o navegador exibe na resolução enviada
              <video key={lot.id} src={lot.video.url} controls autoPlay playsInline preload="auto" />
            ) : (
              <div className="novideo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.jpg" alt="" width={886} height={861} />
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

export default function Catalog({ lots }) {
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
      <header className="cat-top">
        <a href="/" className="brand" aria-label="Mara Rosa Leilões – início">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpg" alt="" width={886} height={861} />
        </a>
        <div className="cat-hero">
          <p className="kicker">A vitrine do boi</p>
          <h1>Catálogo de lotes</h1>
          <p className="lead">Confira os lotes deste leilão: categoria, raça, idade e qualidade de cada um.</p>
        </div>
      </header>

      <dl className="stats" aria-live="polite">
        <div><dt>Lotes</dt><dd>{fmt(visible.length)}</dd></div>
        <div><dt>Cabeças</dt><dd>{fmt(heads)}</dd></div>
        <div><dt>Machos</dt><dd>{fmt(males)}</dd></div>
        <div><dt>Fêmeas</dt><dd>{fmt(heads - males)}</dd></div>
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

        <div className="fgroups">
          {chipGroups.map((g) => (
            <div className="fgroup" key={g.key} role="group" aria-label={g.title}>
              <span className="ftitle">{g.title}</span>
              <div className="chips">
                {g.options.map((o) => {
                  const on = filters[g.key].includes(o);
                  const n = countFor(g.key, o);
                  return (
                    <button key={o} type="button" className={`chip${on ? " on" : ""}`} aria-pressed={on}
                      onClick={() => toggle(g.key, o)} disabled={!on && n === 0}>
                      {label(o)} <em>{n}</em>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {hasFilters && <button type="button" className="clear" onClick={clear}>Limpar filtros</button>}
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
