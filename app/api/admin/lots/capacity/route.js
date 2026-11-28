import { changeTotalLots, getTotalLots } from "../../../../../lib/db";
import { MAX_LOTS } from "../../../../../lib/catalog";
import { fail, json, readJson, requireAdmin, serverError } from "../../../../../lib/api";

export const dynamic = "force-dynamic";

// Quantidade de lotes do leilão
export async function GET(request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    return json({ total: await getTotalLots(), max: MAX_LOTS });
  } catch (e) {
    return serverError(e);
  }
}

// { add: n } cria n lotes no final; { remove: n } remove n lotes disponíveis do final
export async function POST(request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const b = await readJson(request);
  const add = Number(b?.add ?? 0);
  const remove = Number(b?.remove ?? 0);
  const delta = add ? add : -remove;
  if (!Number.isInteger(delta) || delta === 0 || (add && remove) || add < 0 || remove < 0) {
    return fail("Informe quantos lotes adicionar ou remover.", 400);
  }

  try {
    return json({ ...(await changeTotalLots(delta)), max: MAX_LOTS });
  } catch (e) {
    if (e.status) return fail(e.message, e.status);
    return serverError(e);
  }
}
