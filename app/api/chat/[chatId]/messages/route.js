import { fail, json, readJson, requireUser, serverError } from "../../../../../lib/api";
import { addMessage, clearTyping, listMessages } from "../../../../../lib/chat";
import { allowMessage, resolveChat, sender } from "../../access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isDate = (v) => typeof v === "string" && !Number.isNaN(Date.parse(v));

// Mensagens da conversa: as últimas, as mais novas que ?after= ou as anteriores a ?before=
export async function GET(request, { params }) {
  const { user, denied } = await requireUser(request);
  if (denied) return denied;
  const r = await resolveChat((await params).chatId, user);
  if (r.error) return fail(r.error, r.status);
  const q = new URL(request.url).searchParams;
  try {
    return json(await listMessages(r.chatId, {
      after: isDate(q.get("after")) ? q.get("after") : null,
      before: isDate(q.get("before")) ? q.get("before") : null,
    }));
  } catch (e) {
    return serverError(e);
  }
}

// Mensagem de texto
export async function POST(request, { params }) {
  const { user, denied } = await requireUser(request);
  if (denied) return denied;
  const r = await resolveChat((await params).chatId, user);
  if (r.error) return fail(r.error, r.status);
  if (!allowMessage(user.id)) return fail("Muitas mensagens em sequência. Aguarde um minuto.", 429);
  const b = await readJson(request);
  const text = typeof b?.text === "string" ? b.text.trim() : "";
  if (!text) return fail("Escreva uma mensagem.", 400);
  if (text.length > 2000) return fail("Mensagem com no máximo 2000 caracteres.", 400);
  try {
    const msg = await addMessage(r.chatId, sender(user), { kind: "text", text, replyTo: typeof b?.replyTo === "string" ? b.replyTo : null });
    await clearTyping(user.id).catch(() => {});
    return json(msg, 201);
  } catch (e) {
    return serverError(e);
  }
}
