import { setLotPista } from "../../../../../../lib/db";
import { normalizePista, validatePista } from "../../../../../../lib/pista";
import { fail, json, readJson, requireAdmin, serverError } from "../../../../../../lib/api";
import { OFFICE } from "../../../../../../lib/roles";

export const dynamic = "force-dynamic";

// Resultado do lote na pista: situação, valor, comprador, prazo, proposta e valor pretendido
export async function PUT(request, { params }) {
  const denied = await requireAdmin(request, OFFICE);
  if (denied) return denied;

  const { id } = await params;
  const b = await readJson(request);
  const toCents = (v) => (v == null || v === "" ? null : Number(v));
  const data = {
    status: b?.status,
    value: toCents(b?.value),
    buyer: String(b?.buyer ?? ""),
    term: String(b?.term ?? ""),
    proposal: toCents(b?.proposal),
    ownerAsk: toCents(b?.ownerAsk),
  };

  const errors = validatePista(data);
  const first = Object.values(errors)[0];
  if (first) return fail(first, 400);

  try {
    return json(await setLotPista(id, normalizePista(data)));
  } catch (e) {
    if (e.status) return fail(e.message, e.status);
    return serverError(e);
  }
}
