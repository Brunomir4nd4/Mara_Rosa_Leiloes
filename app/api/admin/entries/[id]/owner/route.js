import { fail, json, readJson, requireAdmin, serverError } from "../../../../../../lib/api";
import { setEntryOwner } from "../../../../../../lib/db";
import { getUser } from "../../../../../../lib/users";

export const runtime = "nodejs";

// Troca o Criador dono de um refugo ({ ownerId }) ou desvincula ({ ownerId: null }). Só a equipe.
// O dono padrão vem do cadastro da fazenda; aqui a equipe corrige um refugo específico.
// Só vale para registros do tipo REFUGO (os outros não têm dono).
export async function PUT(request, { params }) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const { id } = await params;
  const b = await readJson(request);
  if (!b || typeof b !== "object" || Array.isArray(b) || !("ownerId" in b)) return fail("Informe o criador.", 400);
  if (b.ownerId != null && typeof b.ownerId !== "string") return fail("Criador inválido.", 400);
  try {
    let owner = null;
    if (b.ownerId) {
      const u = await getUser(b.ownerId);
      if (!u || u.role !== "CRIADOR" || !u.active) return fail("Criador não encontrado ou inativo.", 400);
      owner = { id: u._id.toString(), name: u.name };
    }
    return json(await setEntryOwner(id, owner));
  } catch (e) {
    if (e.status) return fail(e.message, e.status);
    return serverError(e);
  }
}
