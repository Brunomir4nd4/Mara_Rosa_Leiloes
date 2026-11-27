import { linkLot, listLots } from "../../../../lib/db";
import { fail, json, readJson, requireAdmin } from "../../../../lib/api";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  return json(listLots());
}

// Vincula um lote do mapa a uma fazenda e a registros do desembarque dela
export async function POST(request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const b = await readJson(request);
  const lot = Number(b?.lot);
  const farm = String(b?.farm ?? "").trim();
  const entryIds = Array.isArray(b?.entryIds) ? b.entryIds.filter((id) => typeof id === "string") : [];
  if (!farm) return fail("Selecione a fazenda.", 400);

  try {
    return json(await linkLot({ lot, farm, entryIds }), 201);
  } catch (e) {
    if (e.status) return fail(e.message, e.status);
    throw e;
  }
}
