import { fail, json, requireUser, serverError } from "../../../../../lib/api";
import { markRead } from "../../../../../lib/chat";
import { resolveChat } from "../../access";

export const runtime = "nodejs";

// Marca a conversa como lida
export async function POST(request, { params }) {
  const { user, denied } = await requireUser(request);
  if (denied) return denied;
  const r = await resolveChat((await params).chatId, user);
  if (r.error) return fail(r.error, r.status);
  try {
    await markRead(r.chatId, user.id);
    return json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
