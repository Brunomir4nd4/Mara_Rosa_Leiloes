// Gravação e entrega de arquivos enviados (fotos e vídeos). Só roda no servidor (Node).
import { createReadStream, createWriteStream, promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

export const MEDIA_DIR = path.join(process.cwd(), "data", "media");

// Tipos aceitos nos anexos do desembarque (refugo)
export const MEDIA_TYPES = {
  "image/jpeg": { ext: "jpg", kind: "photo" },
  "image/png": { ext: "png", kind: "photo" },
  "image/webp": { ext: "webp", kind: "photo" },
  "video/mp4": { ext: "mp4", kind: "video" },
  "video/webm": { ext: "webm", kind: "video" },
  "video/quicktime": { ext: "mov", kind: "video" },
};
export const MAX_PHOTO = 15 * 1024 * 1024; // 15 MB
export const MAX_VIDEO = 500 * 1024 * 1024; // 500 MB

const MIME_BY_EXT = Object.fromEntries(Object.entries(MEDIA_TYPES).map(([mime, t]) => [t.ext, mime]));
export const MEDIA_FILE_RE = /^[a-z0-9-]+\.(jpg|png|webp|mp4|webm|mov)$/;

// Grava o corpo da requisição em disco, em streaming, respeitando o limite. Devolve { file, size } ou { error, status }.
export async function saveUpload(request, { dir, prefix, ext, maxBytes, tooLarge }) {
  if (!request.body) return { error: "Nenhum arquivo enviado.", status: 400 };
  if (Number(request.headers.get("content-length")) > maxBytes) return { error: tooLarge, status: 413 };

  await fs.mkdir(dir, { recursive: true });
  const file = `${prefix}-${randomUUID()}.${ext}`;
  const dest = path.join(dir, file);
  let bytes = 0;
  const limit = new Transform({
    transform(chunk, _enc, cb) {
      bytes += chunk.length;
      cb(bytes > maxBytes ? new Error("TOO_LARGE") : null, chunk);
    },
  });

  try {
    await pipeline(Readable.fromWeb(request.body), limit, createWriteStream(dest));
  } catch (e) {
    await fs.rm(dest, { force: true });
    if (e.message === "TOO_LARGE") return { error: tooLarge, status: 413 };
    console.error(e);
    return { error: "O envio foi interrompido. Tente de novo.", status: 500 };
  }
  if (!bytes) {
    await fs.rm(dest, { force: true });
    return { error: "Arquivo vazio.", status: 400 };
  }
  return { file, size: bytes };
}

export async function removeMediaFile(file) {
  if (file && MEDIA_FILE_RE.test(file)) await fs.rm(path.join(MEDIA_DIR, file), { force: true });
}

// Entrega o arquivo com suporte a Range (vídeo pode avançar/voltar sem baixar tudo)
export async function serveFile(request, full, ext, cache = "private, max-age=3600") {
  let stat;
  try {
    stat = await fs.stat(full);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const headers = { "Content-Type": MIME_BY_EXT[ext] ?? "application/octet-stream", "Accept-Ranges": "bytes", "Cache-Control": cache };
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") || "");
  if (range) {
    let start = range[1] === "" ? stat.size - Number(range[2]) : Number(range[1]);
    let end = range[1] !== "" && range[2] !== "" ? Number(range[2]) : stat.size - 1;
    start = Math.max(0, start);
    end = Math.min(end, stat.size - 1);
    if (start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${stat.size}` } });
    return new Response(Readable.toWeb(createReadStream(full, { start, end })), {
      status: 206,
      headers: { ...headers, "Content-Length": String(end - start + 1), "Content-Range": `bytes ${start}-${end}/${stat.size}` },
    });
  }
  return new Response(Readable.toWeb(createReadStream(full)), { headers: { ...headers, "Content-Length": String(stat.size) } });
}
