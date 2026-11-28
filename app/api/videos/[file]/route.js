import { serveFile } from "../../../../lib/files";
import { serverError } from "../../../../lib/api";
import { isPublicVideo } from "../../../../lib/db";

export const runtime = "nodejs";

// Vídeo do lote no catálogo público (arquivo original, com suporte a Range).
// Só entrega se um lote do catálogo (não refugo) usa este arquivo — o resto é 404.
// O nome é único por envio, então pode ficar em cache por muito tempo.
export async function GET(request, { params }) {
  const { file } = await params;
  if (!/^lote-\d+-[0-9a-f-]{36}\.(mp4|webm|mov)$/.test(file)) return new Response("Not found", { status: 404 });
  try {
    if (!(await isPublicVideo(file))) return new Response("Not found", { status: 404 });
    return await serveFile(request, file, "public, max-age=31536000, immutable");
  } catch (e) {
    return serverError(e);
  }
}
