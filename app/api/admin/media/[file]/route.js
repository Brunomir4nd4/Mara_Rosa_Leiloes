import { serveFile } from "../../../../../lib/files";
import { fail, requireUser, serverError } from "../../../../../lib/api";
import { ownerHasMedia } from "../../../../../lib/db";

export const runtime = "nodejs";

// Fotos e vídeos do desembarque são privados: só com login.
// - Fotos de perfil: visíveis para todos os usuários logados (aparecem no chat).
// - Arquivos do chat: nunca por aqui (só por /api/chat/file, que confere quem participa da conversa).
// - O Criador abre apenas os anexos dos refugos dele.
// no-cache: o navegador sempre confere o login antes de reaproveitar a cópia.
export async function GET(request, { params }) {
  const { user, denied } = await requireUser(request);
  if (denied) return denied;

  const { file } = await params;
  try {
    if (file.startsWith("chat-")) return fail("Arquivo não encontrado.", 404);
    if (user.role === "CRIADOR" && !file.startsWith("avatar-") && !(await ownerHasMedia(user.id, file))) {
      return fail("Arquivo não encontrado.", 404);
    }
    return await serveFile(request, file, "private, no-cache");
  } catch (e) {
    return serverError(e);
  }
}
