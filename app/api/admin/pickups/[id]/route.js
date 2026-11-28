import { removePickup } from "../../../../../lib/db";
import { fail, json, requireAdmin, serverError } from "../../../../../lib/api";

export const dynamic = "force-dynamic";

// Desfaz uma retirada registrada por engano (o saldo volta para o lote)
export async function DELETE(request, { params }) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const { id } = await params;
  try {
    return json(await removePickup(id));
  } catch (e) {
    if (e.status) return fail(e.message, e.status);
    return serverError(e);
  }
}