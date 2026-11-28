// Fotos e vídeos guardados no próprio MongoDB (GridFS, bucket "media").
// Não usa o disco do servidor: funciona em hospedagem sem disco persistente (ex.: Vercel).
// Atenção: na Vercel o corpo de cada requisição tem limite de ~4,5 MB. Vídeos maiores precisam
// de envio direto para um storage (Vercel Blob/S3) — ver README.
import { randomUUID } from "node:crypto";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { GridFSBucket } from "mongodb";
import { getDb } from "./mongodb";

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
// nomes gerados pelo sistema (nunca vêm do usuário): "desembarque-photo-<uuid>.jpg", "lote-12-<uuid>.mp4"
export const FILE_RE = /^[a-z0-9-]+\.(jpg|png|webp|mp4|webm|mov)$/;

async function bucket() {
  return new GridFSBucket(await getDb(), { bucketName: "media" });
}

// Grava o corpo da requisição no GridFS, em streaming, respeitando o limite.
// Devolve { file, size } ou { error, status }.
export async function saveUpload(request, { prefix, ext, maxBytes, tooLarge }) {
  if (!request.body) return { error: "Nenhum arquivo enviado.", status: 400 };
  if (Number(request.headers.get("content-length")) > maxBytes) return { error: tooLarge, status: 413 };

  const file = `${prefix}-${randomUUID()}.${ext}`;
  const upload = (await bucket()).openUploadStream(file, { metadata: { contentType: MIME_BY_EXT[ext] } });
  let bytes = 0;
  const limit = new Transform({
    transform(chunk, _enc, cb) {
      bytes += chunk.length;
      cb(bytes > maxBytes ? new Error("TOO_LARGE") : null, chunk);
    },
  });

  try {
    await pipeline(Readable.fromWeb(request.body), limit, upload);
  } catch (e) {
    await upload.abort().catch(() => {});
    await removeMediaFile(file);
    if (e.message === "TOO_LARGE") return { error: tooLarge, status: 413 };
    console.error("Falha no envio do arquivo:", e.message);
    return { error: "O envio foi interrompido. Tente de novo.", status: 500 };
  }
  if (!bytes) {
    await removeMediaFile(file);
    return { error: "Arquivo vazio.", status: 400 };
  }
  return { file, size: bytes };
}

// Nunca lança erro: a limpeza de um arquivo antigo não pode desfazer uma operação que já deu certo
export async function removeMediaFile(file) {
  if (!file || !FILE_RE.test(file)) return;
  try {
    const b = await bucket();
    for (const f of await b.find({ filename: file }).toArray()) await b.delete(f._id).catch(() => {});
  } catch (e) {
    console.error("Não foi possível apagar o arquivo", file, "-", e.message);
  }
}

// Entrega o arquivo com suporte a Range (vídeo pode avançar/voltar sem baixar tudo)
export async function serveFile(request, file, cache) {
  if (!FILE_RE.test(file)) return new Response("Not found", { status: 404 });
  const b = await bucket();
  const doc = (await b.find({ filename: file }).sort({ uploadDate: -1 }).limit(1).toArray())[0];
  if (!doc) return new Response("Not found", { status: 404 });

  const size = doc.length;
  const headers = {
    "Content-Type": doc.metadata?.contentType ?? MIME_BY_EXT[file.split(".").pop()] ?? "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Cache-Control": cache,
    // o navegador respeita o Content-Type (não "adivinha" HTML/script dentro de um anexo)
    "X-Content-Type-Options": "nosniff",
  };
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") || "");
  if (range) {
    let start = range[1] === "" ? size - Number(range[2]) : Number(range[1]);
    let end = range[1] !== "" && range[2] !== "" ? Number(range[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(end, size - 1);
    if (start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    const stream = b.openDownloadStream(doc._id, { start, end: end + 1 }); // `end` do GridFS é exclusivo
    return new Response(Readable.toWeb(stream), {
      status: 206,
      headers: { ...headers, "Content-Length": String(end - start + 1), "Content-Range": `bytes ${start}-${end}/${size}` },
    });
  }
  return new Response(Readable.toWeb(b.openDownloadStream(doc._id)), { headers: { ...headers, "Content-Length": String(size) } });
}
