import { serveFile } from "../../../../../lib/files";
import { fail, requireUser, serverError } from "../../../../../lib/api";
import { ownerHasMedia } from "../../../../../lib/db";
import { getAvatar } from "../../../../../lib/profiles";

export const runtime = "nodejs";

// Fotos e vídeos do desembarque são privados: só com login.
// O Criador abre apenas os anexos dos refugos dele (e a própria foto de perfil).
// no-cache: o navegador sempre confere o login antes de reaproveitar a cópia.
export async function GET(request, { params }) {
  const { user, denied } = await requireUser(request);
  if (denied) return denied;

  const { file } = await params;
  try {
    if (user.role === "CRIADOR") {
      const own = file.startsWith("avatar-")
        ? (await getAvatar(user.cpf))?.file === file
        : await ownerHasMedia(user.id, file);
      if (!own) return fail("Arquivo não encontrado.", 404);
    }
    return await serveFile(request, file, "private, no-cache");
  } catch (e) {
    return serverError(e);
  }
}
