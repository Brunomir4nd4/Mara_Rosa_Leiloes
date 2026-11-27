import { promises as fs } from "node:fs";
import path from "node:path";
import { unlinkLot, VIDEO_DIR } from "../../../../../lib/db";
import { fail, json, requireAdmin } from "../../../../../lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Desvincula o lote: os registros do desembarque voltam a ficar sem lote
export async function DELETE(request, { params }) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const { id } = await params;
  try {
    const removed = await unlinkLot(id);
    if (removed.video?.file) await fs.rm(path.join(VIDEO_DIR, removed.video.file), { force: true });
    return json({ ok: true, lot: removed.lot });
  } catch (e) {
    if (e.status) return fail(e.message, e.status);
    throw e;
  }
}
