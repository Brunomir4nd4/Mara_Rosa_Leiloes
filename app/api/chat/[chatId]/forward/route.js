import { fail, json, readJson, requireUser, serverError } from "../../../../../lib/api";
import { canAccess, forwardMessage, getForwardable } from "../../../../../lib/chat";
import { allowMessage, resolveChat, sender } from "../../access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Encaminhar uma mensagem para outras conversas: { messageId, to: [chatIds] } (até 5 destinos).
// O [chatId] da URL é a conversa de origem.
export async function POST(request, { params }) {
  const { user, denied } = await requireUser(request);
  if (denied) return denied;
  const src = await resolveChat((await params).chatId, user);
  if (src.error) return fail(src.error, src.status);
  const b = await readJson(request);
  const to = Array.isArray(b?.to) ? [...new Set(b.to.filter((x) => typeof x === "string"))].slice(0, 5) : [];
  if (!to.length) return fail("Escolha para quem encaminhar.", 400);
  try {
    const m = await getForwardable(b?.messageId);
    if (!m || m.chatId !== src.chatId || !(await canAccess(m.chatId, user.id))) return fail("Mensagem não encontrada.", 404);
    const targets = [];
    for (const raw of to) {
      const r = await resolveChat(encodeURIComponent(raw), user);
      if (r.error) return fail(r.error, r.status);
      targets.push(r.chatId);
    }
    if (!allowMessage(user.id, targets.length)) return fail("Muitas mensagens em sequência. Aguarde um minuto.", 429);
    for (const t of targets) await forwardMessage(m, t, sender(user));
    return json({ ok: true, count: targets.length }, 201);
  } catch (e) {
    return serverError(e);
  }
}
