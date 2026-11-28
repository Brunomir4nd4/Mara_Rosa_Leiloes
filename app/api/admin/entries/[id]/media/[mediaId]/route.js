import { removeEntryMedia } from "../../../../../../../lib/db";
import { removeMediaFile } from "../../../../../../../lib/files";
import { fail, json, requireAdmin, serverError } from "../../../../../../../lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Remove um anexo (foto ou vídeo) do registro do desembarque
export async function DELETE(request, { params }) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const { id, mediaId } = await params;
  try {
    const { entry, removed } = await removeEntryMedia(id, mediaId);
    await removeMediaFile(removed.file);
    return json(entry);
  } catch (e) {
    if (e.status) return fail(e.message, e.status);
    return serverError(e);
  }
}
