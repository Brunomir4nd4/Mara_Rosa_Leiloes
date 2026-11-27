import { serveFile } from "../../../../../lib/files";
import { requireAdmin, serverError } from "../../../../../lib/api";

export const runtime = "nodejs";

// Fotos e vídeos do desembarque são privados (para o proprietário/equipe): só com login.
// no-cache: o navegador sempre confere o login antes de reaproveitar a cópia.
export async function GET(request, { params }) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const { file } = await params;
  try {
    return await serveFile(request, file, "private, no-cache");
  } catch (e) {
    return serverError(e);
  }
}
