import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { VIDEO_DIR } from "../../../../lib/db";

export const runtime = "nodejs";

const MIME = { mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime" };

// Entrega o vídeo original com suporte a Range (o player pode avançar/voltar sem baixar tudo)
export async function GET(request, { params }) {
  const { file } = await params;
  const match = /^lote-\d+-[0-9a-f-]{36}\.(mp4|webm|mov)$/.exec(file);
  if (!match) return new Response("Not found", { status: 404 });

  const full = path.join(VIDEO_DIR, file);
  let stat;
  try {
    stat = await fs.stat(full);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const headers = {
    "Content-Type": MIME[match[1]],
    "Accept-Ranges": "bytes",
    // nome do arquivo é único por envio, então pode ficar em cache por muito tempo
    "Cache-Control": "public, max-age=31536000, immutable",
  };

  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") || "");
  if (range) {
    let start = range[1] === "" ? stat.size - Number(range[2]) : Number(range[1]);
    let end = range[1] !== "" && range[2] !== "" ? Number(range[2]) : stat.size - 1;
    start = Math.max(0, start);
    end = Math.min(end, stat.size - 1);
    if (start > end) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${stat.size}` } });
    }
    const stream = Readable.toWeb(createReadStream(full, { start, end }));
    return new Response(stream, {
      status: 206,
      headers: { ...headers, "Content-Length": String(end - start + 1), "Content-Range": `bytes ${start}-${end}/${stat.size}` },
    });
  }

  return new Response(Readable.toWeb(createReadStream(full)), {
    headers: { ...headers, "Content-Length": String(stat.size) },
  });
}
