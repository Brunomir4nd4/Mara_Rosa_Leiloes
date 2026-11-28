import { listEntries, listPublicLots } from "../../lib/db";
import { toPublicLot } from "../../lib/catalog";
import Catalog from "../_catalogo/Catalog";

// Catálogo público: lotes do quadro + dados do desembarque vinculados (lidos a cada acesso)
export const dynamic = "force-dynamic";
export const metadata = { title: "Mara Rosa Leilão – Catálogo de lotes" };

export default async function CatalogPage() {
  try {
    const [entries, publicLots] = await Promise.all([listEntries(), listPublicLots()]);
    // refugos (animais com problema) não aparecem para o público
    const entriesById = new Map(entries.filter((e) => e.kind !== "REFUGO").map((e) => [e.id, e]));
    const lots = publicLots
      .map((l) => toPublicLot(l, entriesById))
      // sem campos internos de refugo no que vai para o navegador do cliente
      .map(({ refugo, reasons, ...l }) => ({ ...l, entries: (l.entries ?? []).map(({ refugo: _r, reason, ...e }) => e) }))
      .filter((l) => l.quantity > 0);
    return <Catalog lots={lots} />;
  } catch (e) {
    // banco fora do ar: mostra um aviso amigável em vez de erro 500
    console.error("Catálogo indisponível:", e.message);
    return (
      <main className="cat-down">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.jpg" alt="Mara Rosa Leilões – A vitrine do boi" width={886} height={861} />
        <h1>Catálogo temporariamente indisponível</h1>
        <p>Não conseguimos carregar os lotes agora. Tente de novo em alguns minutos.</p>
        <a href="/catalogo">Tentar de novo</a>
      </main>
    );
  }
}
