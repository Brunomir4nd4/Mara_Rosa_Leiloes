import { fail, json, readJson, requireAdmin, serverError } from "../../../../../../lib/api";
import { setFarmCriador } from "../../../../../../lib/db";
import { getUser } from "../../../../../../lib/users";

export const runtime = "nodejs";

// Define o Criador dono da fazenda ({ criadorId }) ou remove ({ criadorId: null }). Só a equipe.
// Os refugos da fazenda ainda sem dono passam a ser dele.
export async function PUT(request, { params }) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const { id } = await params;
  const b = await readJson(request);
  if (!b || typeof b !== "object" || Array.isArray(b) || !("criadorId" in b)) return fail("Informe o criador.", 400);
  if (b.criadorId != null && typeof b.criadorId !== "string") return fail("Criador inválido.", 400);
  try {
    let criador = null;
    if (b.criadorId) {
      const u = await getUser(b.criadorId);
      if (!u || u.role !== "CRIADOR" || !u.active) return fail("Criador não encontrado ou inativo.", 400);
      criador = { id: u._id.toString(), name: u.name };
    }
    return json(await setFarmCriador(id, criador));
  } catch (e) {
    if (e.status) return fail(e.message, e.status);
    return serverError(e);
  }
}
