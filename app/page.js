import { listEntries, listLots } from "../lib/db";
import { toPublicLot } from "../lib/catalog";
import Catalog from "./_catalogo/Catalog";

// Catálogo público: lotes do mapa + dados do desembarque vinculados (lidos a cada acesso)
export const dynamic = "force-dynamic";
export const metadata = { title: "Mara Rosa Leilão – Catálogo de lotes" };

export default function CatalogPage() {
  const entriesById = new Map(listEntries().map((e) => [e.id, e]));
  const lots = listLots()
    .map((l) => toPublicLot(l, entriesById))
    .filter((l) => l.quantity > 0);
  return <Catalog lots={lots} />;
}
