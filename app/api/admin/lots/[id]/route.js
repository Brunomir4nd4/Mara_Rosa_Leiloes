import { unlinkLot } from "../../../../../lib/db";
import { removeMediaFile } from "../../../../../lib/files";
import { fail, json, requireAdmin, serverError } from "../../../../../lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Desvincula o lote: os registros do desembarque voltam a ficar sem lote
export async function DELETE(request, { params }) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const { id } = await params;
  try {
    const removed = await unlinkLot(id);
    await removeMediaFile(removed.video?.file);
    return json({ ok: true, lot: removed.lot });
  } catch (e) {
    if (e.status) return fail(e.message, e.status);
    return serverError(e);
  }
}
