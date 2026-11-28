import { json, requireUser, serverError } from "../../../lib/api";
import { ONLINE_MS, listChats, markDelivered, presenceMap, touchPresence } from "../../../lib/chat";
import { listContacts } from "../../../lib/users";
import { canManageGroups } from "./access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Conversas do usuário + contatos (todos os usuários ativos, com nome, função, foto e se estão online).
// Cada consulta também conta como sinal de "online" de quem consultou.
export async function GET(request) {
  const { user, denied } = await requireUser(request);
  if (denied) return denied;
  try {
    await Promise.all([touchPresence(user.id), markDelivered(user.id)]);
    const [chats, contacts] = await Promise.all([listChats(user.id), listContacts()]);
    const seen = await presenceMap(contacts.map((c) => c.id));
    const now = Date.now();
    return json({
      me: user.id, canManageGroups: canManageGroups(user), chats,
      contacts: contacts.map((c) => {
        const lastSeen = seen.get(c.id) ?? null;
        return { ...c, lastSeen, online: Boolean(lastSeen && now - Date.parse(lastSeen) < ONLINE_MS) };
      }),
    });
  } catch (e) {
    return serverError(e);
  }
}
