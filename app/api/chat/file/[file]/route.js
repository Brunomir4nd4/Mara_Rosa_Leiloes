import { fail, requireUser, serverError } from "../../../../../lib/api";
import { canAccess, chatsOfFile, groupOfPhoto } from "../../../../../lib/chat";
import { serveFile } from "../../../../../lib/files";

export const runtime = "nodejs";

// Foto/vídeo do chat e foto de grupo: só para quem participa de uma conversa que usa o arquivo
// (o mesmo arquivo pode estar em várias conversas quando a mensagem é encaminhada)
export async function GET(request, { params }) {
  const { user, denied } = await requireUser(request);
  if (denied) return denied;
  const { file } = await params;
  if (!/^chat-(photo|video|group)-/.test(file)) return fail("Arquivo não encontrado.", 404);
  try {
    let ok = false;
    if (file.startsWith("chat-group-")) ok = await groupOfPhoto(file, user.id);
    else for (const chatId of await chatsOfFile(file)) if (await canAccess(chatId, user.id)) { ok = true; break; }
    if (!ok) return fail("Arquivo não encontrado.", 404);
    return await serveFile(request, file, "private, max-age=3600");
  } catch (e) {
    return serverError(e);
  }
}
