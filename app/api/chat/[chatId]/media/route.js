import { fail, json, requireUser, serverError } from "../../../../../lib/api";
import { addMessage } from "../../../../../lib/chat";
import { MEDIA_TYPES, removeMediaFile, saveUpload } from "../../../../../lib/files";
import { allowMessage, resolveChat, sender } from "../../access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Fotos chegam já reduzidas pelo navegador; vídeos vão como estão.
// Atenção: na Vercel cada envio aceita ~4,5 MB (vídeos maiores precisam de storage externo).
const MAX_PHOTO = 10 * 1024 * 1024;
const MAX_VIDEO = 100 * 1024 * 1024;
const dim = (v) => { const n = Number(v); return Number.isInteger(n) && n > 0 && n < 20000 ? n : null; };
const header = (request, name, max) => { try { return decodeURIComponent(request.headers.get(name) || "").slice(0, max); } catch { return ""; } };

// Foto ou vídeo (corpo = arquivo). Legenda opcional no cabeçalho X-Caption.
export async function POST(request, { params }) {
  const { user, denied } = await requireUser(request);
  if (denied) return denied;
  const r = await resolveChat((await params).chatId, user);
  if (r.error) return fail(r.error, r.status);
  if (!allowMessage(user.id)) return fail("Muitas mensagens em sequência. Aguarde um minuto.", 429);

  const type = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const t = MEDIA_TYPES[type];
  if (!t) return fail("Formato não aceito. Fotos: JPG, PNG ou WEBP. Vídeos: MP4, WEBM ou MOV.", 415);
  const isPhoto = t.kind === "photo";
  const name = header(request, "x-file-name", 120);
  const caption = header(request, "x-caption", 2000).trim();

  let saved;
  try {
    saved = await saveUpload(request, {
      prefix: `chat-${t.kind}`, ext: t.ext,
      maxBytes: isPhoto ? MAX_PHOTO : MAX_VIDEO,
      tooLarge: isPhoto ? "Foto acima de 10 MB." : "Vídeo acima de 100 MB.",
    });
    if (saved.error) return fail(saved.error, saved.status);
    const msg = await addMessage(r.chatId, sender(user), {
      kind: t.kind, text: caption, file: saved.file, size: saved.size, name,
      replyTo: request.headers.get("x-reply-to") || null,
      width: dim(request.headers.get("x-width")), height: dim(request.headers.get("x-height")),
    });
    return json(msg, 201);
  } catch (e) {
    if (saved?.file) await removeMediaFile(saved.file);
    return serverError(e);
  }
}
