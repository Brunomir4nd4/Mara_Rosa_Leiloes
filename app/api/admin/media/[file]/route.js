import path from "node:path";
import { MEDIA_DIR, MEDIA_FILE_RE, serveFile } from "../../../../../lib/files";
import { requireAdmin } from "../../../../../lib/api";

export const runtime = "nodejs";

// Fotos e vídeos do desembarque são privados (para o proprietário/equipe): só com login
export async function GET(request, { params }) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const { file } = await params;
  if (!MEDIA_FILE_RE.test(file)) return new Response("Not found", { status: 404 });
  // no-cache: o navegador sempre confere o login antes de reaproveitar a cópia
  return serveFile(request, path.join(MEDIA_DIR, file), file.split(".").pop(), "private, no-cache");
}
