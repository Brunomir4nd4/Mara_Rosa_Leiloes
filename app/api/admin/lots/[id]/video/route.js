import { getLot, setLotVideo } from "../../../../../../lib/db";
import { removeMediaFile, saveUpload } from "../../../../../../lib/files";
import { fail, json, requireAdmin, serverError } from "../../../../../../lib/api";
import { OFFICE } from "../../../../../../lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// O arquivo é guardado como veio (sem recompressão), preservando a qualidade original.
const MAX_BYTES = 1024 * 1024 * 1024; // 1 GB
const TYPES = { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };

const dim = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n < 20000 ? n : null;
};

// Upload: corpo da requisição = arquivo bruto (Content-Type: video/*), gravado em streaming no GridFS
export async function POST(request, { params }) {
  const denied = await requireAdmin(request, OFFICE);
  if (denied) return denied;

  const { id } = await params;
  let saved;
  try {
    const lot = await getLot(id);
    if (!lot) return fail("Lote não encontrado.", 404);

    const type = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const ext = TYPES[type];
    if (!ext) return fail("Formato não suportado. Envie MP4 (recomendado), WEBM ou MOV.", 415);

    saved = await saveUpload(request, { prefix: `lote-${lot.lot}`, ext, maxBytes: MAX_BYTES, tooLarge: "Vídeo acima de 1 GB." });
    if (saved.error) return fail(saved.error, saved.status);

    const video = {
      file: saved.file,
      type,
      size: saved.size,
      width: dim(request.headers.get("x-video-width")),
      height: dim(request.headers.get("x-video-height")),
      uploadedAt: new Date().toISOString(),
    };
    // se o lote foi desvinculado durante o envio: 404 e o arquivo é apagado (não fica solto)
    const { lot: updated, previous } = await setLotVideo(id, video);
    await removeMediaFile(previous?.file);
    return json(updated);
  } catch (e) {
    if (saved?.file) await removeMediaFile(saved.file).catch(() => {});
    if (e.status) return fail(e.message, e.status);
    return serverError(e);
  }
}

export async function DELETE(request, { params }) {
  const denied = await requireAdmin(request, OFFICE);
  if (denied) return denied;

  const { id } = await params;
  try {
    const { lot, previous } = await setLotVideo(id, null);
    await removeMediaFile(previous?.file);
    return json(lot);
  } catch (e) {
    if (e.status) return fail(e.message, e.status);
    return serverError(e);
  }
}
