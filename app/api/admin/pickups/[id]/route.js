import { removePickup } from "../../../../../lib/db";
import { fail, json, requireUser, serverError } from "../../../../../lib/api";
import { STAFF } from "../../../../../lib/roles";
import { lotForRole } from "../../../../../lib/visibility";

export const dynamic = "force-dynamic";

// Desfaz uma retirada registrada por engano (o saldo volta para o lote)
export async function DELETE(request, { params }) {
  const { user, denied } = await requireUser(request, STAFF);
  if (denied) return denied;
  const { id } = await params;
  try {
    const r = await removePickup(id);
    return json({ ...r, lot: lotForRole(r.lot, user.role) });
  } catch (e) {
    if (e.status) return fail(e.message, e.status);
    return serverError(e);
  }
}