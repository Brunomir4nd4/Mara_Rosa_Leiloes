import { json, requireUser } from "../../../../lib/api";
import { formatCpf } from "../../../../lib/cpf";
import { ROLE_INFO } from "../../../../lib/roles";
import { avatarUrl, getAvatar } from "../../../../lib/profiles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Quem está logado e quais abas pode ver
export async function GET(request) {
  const { user, denied } = await requireUser(request);
  if (denied) return denied;
  return json({
    id: user.id,
    name: user.name,
    cpf: formatCpf(user.cpf),
    role: user.role,
    roleLabel: ROLE_INFO[user.role].label,
    tabs: ROLE_INFO[user.role].tabs,
    system: user.system,
    avatar: avatarUrl(await getAvatar(user.cpf).catch(() => null)),
  });
}
