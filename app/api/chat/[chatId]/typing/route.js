import { fail, json, requireUser, serverError } from "../../../../../lib/api";
import { setTyping, touchPresence, typingIn } from "../../../../../lib/chat";
import { resolveChat, sender } from "../../access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Quem está digitando nesta conversa (e renova o "online" de quem consulta)
export async function GET(request, { params }) {
  const { user, denied } = await requireUser(request);
  if (denied) return denied;
  const r = await resolveChat((await params).chatId, user);
  if (r.error) return fail(r.error, r.status);
  try {
    await touchPresence(user.id);
    return json(await typingIn(r.chatId, user.id));
  } catch (e) {
    return serverError(e);
  }
}

// "Estou digitando" (o cliente envia no máximo a cada 3 s enquanto digita)
export async function POST(request, { params }) {
  const { user, denied } = await requireUser(request);
  if (denied) return denied;
  const r = await resolveChat((await params).chatId, user);
  if (r.error) return fail(r.error, r.status);
  try {
    await setTyping(user.id, r.chatId, sender(user).name);
    return json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
