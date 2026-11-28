import { fail, json, requireUser, serverError } from "../../../../../lib/api";
import { canAccess, deleteOwnMessage, messageReceipts } from "../../../../../lib/chat";
import { removeMediaFile } from "../../../../../lib/files";

export const runtime = "nodejs";

// "Dados da mensagem" (só de mensagens próprias): entrega e leitura por pessoa
export async function GET(request, { params }) {
  const { user, denied } = await requireUser(request);
  if (denied) return denied;
  try {
    const r = await messageReceipts((await params).id, user.id);
    if (!r || !(await canAccess(r.chatId, user.id))) return fail("Mensagem não encontrada.", 404);
    return json(r);
  } catch (e) {
    return serverError(e);
  }
}

// Apagar a própria mensagem ("mensagem apagada" para todos; o arquivo só é removido se nenhuma
// mensagem encaminhada ainda o usa)
export async function DELETE(request, { params }) {
  const { user, denied } = await requireUser(request);
  if (denied) return denied;
  try {
    const { file } = await deleteOwnMessage((await params).id, user.id);
    await removeMediaFile(file);
    return json({ ok: true });
  } catch (e) {
    if (e.status) return fail(e.message, e.status);
    return serverError(e);
  }
}
