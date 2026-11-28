import { fail, json, requireUser, serverError } from "../../../../../../lib/api";
import { canAccess, isGroupId, updateGroup } from "../../../../../../lib/chat";
import { sender } from "../../../access";

export const runtime = "nodejs";

// Sair do grupo (qualquer participante)
export async function POST(request, { params }) {
  const { user, denied } = await requireUser(request);
  if (denied) return denied;
  const chatId = `g|${(await params).id}`;
  try {
    if (!isGroupId(chatId) || !(await canAccess(chatId, user.id))) return fail("Grupo não encontrado.", 404);
    await updateGroup(chatId, { remove: [user.id] }, sender(user), new Map());
    return json({ ok: true });
  } catch (e) {
    if (e.status) return fail(e.message, e.status);
    return serverError(e);
  }
}
