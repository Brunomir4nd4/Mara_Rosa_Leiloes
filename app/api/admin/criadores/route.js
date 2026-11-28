import { json, requireAdmin, serverError } from "../../../../lib/api";
import { listCriadores } from "../../../../lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Criadores ativos (para o select que vincula um refugo ao dono). Só a equipe.
export async function GET(request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    return json(await listCriadores());
  } catch (e) {
    return serverError(e);
  }
}
