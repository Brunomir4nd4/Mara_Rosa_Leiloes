// Quem pode usar uma conversa do chat
import { GENERAL, canAccess, dmMembers, isGroupId } from "../../../lib/chat";
import { OFFICE } from "../../../lib/roles";
import { getChatUser } from "../../../lib/users";

const decode = (v) => { try { return decodeURIComponent(v); } catch { return null; } };

// Só TI e Administrativo criam e administram grupos
export const canManageGroups = (user) => OFFICE.includes(user.role);

// Devolve { chatId } se o usuário pode usar a conversa; senão { error, status }
export async function resolveChat(rawId, user) {
  const chatId = decode(String(rawId ?? ""));
  if (!chatId) return { error: "Conversa inválida.", status: 400 };
  if (chatId === GENERAL) return { chatId };
  if (isGroupId(chatId)) {
    return (await canAccess(chatId, user.id)) ? { chatId } : { error: "Você não participa deste grupo.", status: 404 };
  }
  const members = dmMembers(chatId);
  if (!members || !members.includes(user.id)) return { error: "Conversa não encontrada.", status: 404 };
  const other = members.find((m) => m !== user.id);
  if (!(await getChatUser(other))) return { error: "Este usuário não está mais ativo.", status: 404 };
  return { chatId };
}

// Limite simples: 60 mensagens por minuto por usuário (por instância do servidor)
const hits = new Map();
export function allowMessage(id, weight = 1) {
  const now = Date.now();
  const list = (hits.get(id) || []).filter((t) => now - t < 60_000);
  if (list.length + weight > 60) return false;
  for (let i = 0; i < weight; i++) list.push(now);
  hits.set(id, list);
  return true;
}

// Remetente gravado na mensagem (nome e função no momento do envio)
export const sender = (u) => ({ id: u.id, name: u.system ? "Conta do sistema" : u.name, role: u.role });
