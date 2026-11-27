import { getTotalLots, listEntries, listLots } from "../../../lib/db";
import { label, summarize } from "../../../lib/catalog";
import { PISTA_STATUS, STATUS_INFO, brl } from "../../../lib/pista";
import ReportActions from "./ReportActions";

// Relatório de pista (pós-leilão). Fica em /painel/*, então só abre com login (middleware).
export const dynamic = "force-dynamic";

const TZ = "America/Sao_Paulo";
const pad = (n) => String(n).padStart(2, "0");
const fmt = (n) => n.toLocaleString("pt-BR");
const pct = (n, t) => (t ? `${Math.round((n / t) * 100)}%` : "0%");

export async function generateMetadata() {
  const d = new Date().toLocaleDateString("sv-SE", { timeZone: TZ }); // 2026-11-27 (vira o nome do PDF)
  return { title: `Relatorio-de-pista-Mara-Rosa-${d}` };
}

export default async function RelatorioPage() {
  const [entryList, lotList, totalLots] = await Promise.all([listEntries(), listLots(), getTotalLots()]);
  const entriesById = new Map(entryList.map((e) => [e.id, e]));
  const rows = lotList.map((l) => {
    const entries = l.entryIds.map((id) => entriesById.get(id)).filter(Boolean);
    return { lot: l, entries, s: summarize(entries), status: l.pista?.status ?? "AGUARDANDO", p: l.pista ?? {} };
  });

  const now = new Date();
  const issued = now.toLocaleString("pt-BR", { timeZone: TZ, dateStyle: "long", timeStyle: "short" });
  const count = (st) => rows.filter((r) => r.status === st).length;
  const sold = rows.filter((r) => r.status === "ARREMATADO");
  const revenue = sold.reduce((t, r) => t + (r.p.value ?? 0), 0);
  const soldHeads = sold.reduce((t, r) => t + r.s.quantity, 0);
  const allHeads = rows.reduce((t, r) => t + r.s.quantity, 0);
  const offeredLots = rows.length;

  // Resumo por comprador
  const buyers = [...sold.reduce((m, r) => {
    const k = r.p.buyer;
    const b = m.get(k) ?? { buyer: k, lots: [], heads: 0, total: 0 };
    b.lots.push(r.lot.lot);
    b.heads += r.s.quantity;
    b.total += r.p.value ?? 0;
    return m.set(k, b);
  }, new Map()).values()].sort((a, b) => b.total - a.total);

  const sexCol = (r) => [...new Set(r.entries.map((e) => e.sexType))].join(" + ");
  const ageCol = (s) => (s.ageMin === s.ageMax ? s.ageMin : `${s.ageMin}–${s.ageMax}`);

  return (
    <div className="rp">
      <ReportActions />

      <article className="sheet">
        <header className="rp-head">
          <div className="rp-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.jpg" alt="Mara Rosa Leilões – A vitrine do boi" width={886} height={861} />
          </div>
          <div className="rp-title">
            <span className="rp-kick">Mara Rosa Leilões · A vitrine do boi</span>
            <h1>Relatório de Pista</h1>
            <p>Resultado pós-leilão · emitido em {issued}</p>
          </div>
          <dl className="rp-meta">
            <div><dt>Lotes ofertados</dt><dd>{offeredLots}</dd></div>
            <div><dt>Lotes no quadro</dt><dd>{totalLots}</dd></div>
            <div><dt>Cabeças ofertadas</dt><dd>{fmt(allHeads)}</dd></div>
          </dl>
        </header>

        <section className="rp-kpis" aria-label="Resumo">
          <div className="k-big">
            <span>Total arrematado</span>
            <strong>{brl(revenue)}</strong>
            <em>{soldHeads ? `${brl(Math.round(revenue / soldHeads))} por cabeça (média)` : "Nenhum lote vendido"}</em>
          </div>
          <div className="k-arr"><span>Arrematados</span><strong>{count("ARREMATADO")}</strong><em>{pct(count("ARREMATADO"), offeredLots)} dos lotes</em></div>
          <div className="k-def"><span>Defendidos</span><strong>{count("DEFENDIDO")}</strong><em>{pct(count("DEFENDIDO"), offeredLots)} dos lotes</em></div>
          <div className="k-nao"><span>Não arrematados</span><strong>{count("NAO_ARREMATADO")}</strong><em>{pct(count("NAO_ARREMATADO"), offeredLots)} dos lotes</em></div>
          <div className="k-agu"><span>Aguardando</span><strong>{count("AGUARDANDO")}</strong><em>ainda sem resultado</em></div>
          <div><span>Cabeças vendidas</span><strong>{fmt(soldHeads)}</strong><em>de {fmt(allHeads)} ofertadas</em></div>
        </section>

        {/* barra de distribuição por situação */}
        <div className="rp-dist" aria-hidden="true">
          {PISTA_STATUS.map((st) => count(st) > 0 && (
            <span key={st} className={`d-${st.toLowerCase()}`} style={{ flexGrow: count(st) }}>
              {STATUS_INFO[st].short} · {count(st)}
            </span>
          ))}
        </div>

        <section className="rp-sec">
          <h2><span>✶✶✶</span> Listagem de lotes <span>✶✶✶</span></h2>
          {rows.length === 0 ? (
            <p className="rp-empty">Nenhum lote vinculado.</p>
          ) : (
            <table className="rp-table">
              <thead>
                <tr>
                  <th>Lote</th><th>Fazenda</th><th className="n">Qtd.</th><th>Sexo / Tipo</th><th className="n">Idade</th><th>Raça</th>
                  <th>Situação</th><th className="n">Vlr lote</th><th>Comprador</th><th>Prazo</th><th className="n">Proposta</th><th className="n">Pretendido</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.lot.id}>
                    <td className="lot">{pad(r.lot.lot)}{r.lot.kind === "REFUGO" && <span className="rf-mini">R</span>}</td>
                    <td>{r.lot.farm}</td>
                    <td className="n">{r.s.quantity}</td>
                    <td>{sexCol(r)}</td>
                    <td className="n">{ageCol(r.s)}</td>
                    <td>{r.s.breeds.map(label).join(" / ").toUpperCase()}</td>
                    <td><span className={`pill p-${r.status.toLowerCase()}`}>{STATUS_INFO[r.status].short}</span></td>
                    <td className="n strong">{r.status === "ARREMATADO" ? brl(r.p.value) : ""}</td>
                    <td>{r.p.buyer || ""}</td>
                    <td>{r.p.term || ""}</td>
                    <td className="n">{r.p.proposal ? brl(r.p.proposal) : ""}</td>
                    <td className="n">{r.p.ownerAsk ? brl(r.p.ownerAsk) : ""}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>Totais</td>
                  <td className="n">{fmt(allHeads)}</td>
                  <td colSpan={4} />
                  <td className="n strong">{brl(revenue)}</td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            </table>
          )}
        </section>

        <section className="rp-sec rp-cols">
          <div>
            <h3>Resumo por comprador</h3>
            {buyers.length === 0 ? (
              <p className="rp-empty">Nenhum lote arrematado ainda.</p>
            ) : (
              <table className="rp-table small">
                <thead><tr><th>Comprador</th><th>Lotes</th><th className="n">Cabeças</th><th className="n">Total</th></tr></thead>
                <tbody>
                  {buyers.map((b) => (
                    <tr key={b.buyer}>
                      <td>{b.buyer}</td>
                      <td>{b.lots.map(pad).join(", ")}</td>
                      <td className="n">{fmt(b.heads)}</td>
                      <td className="n strong">{brl(b.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div>
            <h3>Lotes defendidos</h3>
            {count("DEFENDIDO") === 0 ? (
              <p className="rp-empty">Nenhum lote defendido.</p>
            ) : (
              <table className="rp-table small">
                <thead><tr><th>Lote</th><th>Fazenda</th><th className="n">Proposta</th><th className="n">Pretendido</th><th className="n">Diferença</th></tr></thead>
                <tbody>
                  {rows.filter((r) => r.status === "DEFENDIDO").map((r) => (
                    <tr key={r.lot.id}>
                      <td className="lot">{pad(r.lot.lot)}</td>
                      <td>{r.lot.farm}</td>
                      <td className="n">{brl(r.p.proposal)}</td>
                      <td className="n">{brl(r.p.ownerAsk)}</td>
                      <td className="n strong">{r.p.ownerAsk && r.p.proposal ? brl(r.p.ownerAsk - r.p.proposal) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <footer className="rp-foot">
          <span>Mara Rosa Leilões · Relatório de pista</span>
          <span>Valores em reais (R$) · Gerado em {issued}</span>
        </footer>
      </article>
    </div>
  );
}
