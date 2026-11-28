import { addEntryMedia, getEntry } from "../../../../../../lib/db";
import { MAX_PHOTO, MAX_VIDEO, MEDIA_TYPES, removeMediaFile, saveUpload } from "../../../../../../lib/files";
import { fail, json, requireAdmin, serverError } from "../../../../../../lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PER_ENTRY = 20;

// Anexa uma foto ou vídeo a um registro do desembarque (corpo = arquivo bruto, Content-Type do arquivo)
export async function POST(request, { params }) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const { id } = await params;
  try {
    const entry = await getEntry(id);
    if (!entry) return fail("Registro do desembarque não encontrado.", 404);
    if ((entry.media ?? []).length >= MAX_PER_ENTRY) return fail(`Limite de ${MAX_PER_ENTRY} anexos por registro.`, 400);

    const type = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const t = MEDIA_TYPES[type];
    if (!t) return fail("Formato não suportado. Fotos: JPG, PNG ou WEBP. Vídeos: MP4, WEBM ou MOV.", 415);

    // nome original do arquivo (só para exibir); malformado vira vazio em vez de erro
    let name = "";
    try { name = decodeURIComponent(request.headers.get("x-file-name") || "").slice(0, 120); } catch { name = ""; }

    const isPhoto = t.kind === "photo";
    const saved = await saveUpload(request, {
      prefix: `desembarque-${t.kind}`,
      ext: t.ext,
      maxBytes: isPhoto ? MAX_PHOTO : MAX_VIDEO,
      tooLarge: isPhoto ? "Foto acima de 15 MB." : "Vídeo acima de 500 MB.",
    });
    if (saved.error) return fail(saved.error, saved.status);

    const media = { id: saved.file.split(".")[0], file: saved.file, kind: t.kind, type, size: saved.size, name, uploadedAt: new Date().toISOString() };
    try {
      return json(await addEntryMedia(id, media), 201);
    } catch (e) {
      await removeMediaFile(saved.file);
      throw e;
    }
  } catch (e) {
    if (e.status) return fail(e.message, e.status);
    return serverError(e);
  }
}
