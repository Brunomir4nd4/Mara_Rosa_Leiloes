import { createWriteStream, promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { getLot, setLotVideo, VIDEO_DIR } from "../../../../../../lib/db";
import { fail, json, requireAdmin, serverError } from "../../../../../../lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// O arquivo é gravado como veio (sem recompressão), preservando a qualidade original.
const MAX_BYTES = 1024 * 1024 * 1024; // 1 GB
const TYPES = { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };

const dim = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n < 20000 ? n : null;
};

async function removeFile(video) {
  if (video?.file) await fs.rm(path.join(VIDEO_DIR, video.file), { force: true });
}

// Upload: corpo da requisição = arquivo bruto (Content-Type: video/*), gravado em streaming no disco
export async function POST(request, { params }) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const { id } = await params;
  const lot = await getLot(id);
  if (!lot) return fail("Lote não encontrado.", 404);

  const type = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const ext = TYPES[type];
  if (!ext) return fail("Formato não suportado. Envie MP4 (recomendado), WEBM ou MOV.", 415);
  if (Number(request.headers.get("content-length")) > MAX_BYTES) return fail("Vídeo acima de 1 GB.", 413);
  if (!request.body) return fail("Nenhum arquivo enviado.", 400);

  await fs.mkdir(VIDEO_DIR, { recursive: true });
  const file = `lote-${lot.lot}-${randomUUID()}.${ext}`;
  const dest = path.join(VIDEO_DIR, file);

  let bytes = 0;
  const limit = new Transform({
    transform(chunk, _enc, cb) {
      bytes += chunk.length;
      cb(bytes > MAX_BYTES ? new Error("TOO_LARGE") : null, chunk);
    },
  });

  try {
    await pipeline(Readable.fromWeb(request.body), limit, createWriteStream(dest));
  } catch (e) {
    await fs.rm(dest, { force: true });
    if (e.message === "TOO_LARGE") return fail("Vídeo acima de 1 GB.", 413);
    console.error(e);
    return fail("O envio foi interrompido. Tente de novo.", 500);
  }
  if (bytes === 0) {
    await fs.rm(dest, { force: true });
    return fail("Arquivo vazio.", 400);
  }

  const video = {
    file,
    type,
    size: bytes,
    width: dim(request.headers.get("x-video-width")),
    height: dim(request.headers.get("x-video-height")),
    uploadedAt: new Date().toISOString(),
  };
  const { lot: updated, previous } = await setLotVideo(id, video);
  await removeFile(previous);
  return json(updated);
}

export async function DELETE(request, { params }) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const { id } = await params;
  try {
    const { lot, previous } = await setLotVideo(id, null);
    await removeFile(previous);
    return json(lot);
  } catch (e) {
    if (e.status) return fail(e.message, e.status);
    return serverError(e);
  }
}
