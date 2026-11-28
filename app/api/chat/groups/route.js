import { fail, json, readJson, requireUser, serverError } from "../../../../lib/api";
import { createGroup } from "../../../../lib/chat";
import { canManageGroups, sender } from "../access";
import { activeNames, cleanName, idList } from "./shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Novo grupo (só TI e Administrativo): { name, members: [ids] }
export async function POST(request) {
  const { user, denied } = await requireUser(request);
  if (denied) return denied;
  if (!canManageGroups(user)) return fail("Só TI e Administrativo podem criar grupos.", 403);
  const b = await readJson(request);
  const name = cleanName(b?.name);
  if (!name) return fail("Dê um nome ao grupo.", 400);
  try {
    const names = await activeNames();
    const members = idList(b?.members, names).filter((id) => id !== user.id);
    if (!members.length) return fail("Escolha ao menos um participante.", 400);
    const id = await createGroup({ name, members, by: sender(user) });
    return json({ id }, 201);
  } catch (e) {
    return serverError(e);
  }
}
