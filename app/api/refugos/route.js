import { json, requireUser, serverError } from "../../../lib/api";
import { listRefugos } from "../../../lib/db";
import { EVERYONE } from "../../../lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Refugos: a equipe vê todos; o Criador vê só os vinculados a ele (informação sigilosa).
export async function GET(request) {
  const { user, denied } = await requireUser(request, EVERYONE);
  if (denied) return denied;
  try {
    const list = await listRefugos(user.role === "CRIADOR" ? user.id : null);
    // para o Criador, nada de dados internos da equipe
    return json(user.role === "CRIADOR" ? list.map(({ driver, truckModel, plate, ...e }) => e) : list);
  } catch (e) {
    return serverError(e);
  }
}
