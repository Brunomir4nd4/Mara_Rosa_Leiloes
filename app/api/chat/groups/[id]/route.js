import { fail, json, readJson, requireUser, serverError } from "../../../../../lib/api";
import { canAccess, isGroupId, updateGroup } from "../../../../../lib/chat";
import { canManageGroups, sender } from "../../access";
import { activeNames, cleanName, idList } from "../shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Editar grupo (só TI e Administrativo que participam dele): { name?, add?: [ids], remove?: [ids] }
export async function PATCH(request, { params }) {
  const { user, denied } = await requireUser(request);
  if (denied) return denied;
  if (!canManageGroups(user)) return fail("Só TI e Administrativo podem editar grupos.", 403);
  const chatId = `g|${(await params).id}`;
  const b = await readJson(request);
  try {
    if (!isGroupId(chatId) || !(await canAccess(chatId, user.id))) return fail("Grupo não encontrado.", 404);
    const names = await activeNames();
    const changes = {
      name: b?.name !== undefined ? cleanName(b.name) || undefined : undefined,
      add: idList(b?.add, names),
      remove: Array.isArray(b?.remove) ? b.remove.filter((x) => typeof x === "string") : [],
    };
    await updateGroup(chatId, changes, sender(user), names);
    return json({ ok: true });
  } catch (e) {
    if (e.status) return fail(e.message, e.status);
    return serverError(e);
  }
}
