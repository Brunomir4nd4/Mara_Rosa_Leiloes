import { fail, json, requireUser, serverError } from "../../../../../../lib/api";
import { canAccess, isGroupId, updateGroup } from "../../../../../../lib/chat";
import { MEDIA_TYPES, removeMediaFile, saveUpload } from "../../../../../../lib/files";
import { canManageGroups, sender } from "../../../access";

export const runtime = "nodejs";

async function guard(request, params) {
  const { user, denied } = await requireUser(request);
  if (denied) return { denied };
  if (!canManageGroups(user)) return { denied: fail("Só TI e Administrativo podem mudar a foto do grupo.", 403) };
  const chatId = `g|${(await params).id}`;
  if (!isGroupId(chatId) || !(await canAccess(chatId, user.id))) return { denied: fail("Grupo não encontrado.", 404) };
  return { user, chatId };
}

// Nova foto do grupo (corpo = imagem, já reduzida pelo navegador)
export async function POST(request, { params }) {
  const g = await guard(request, params);
  if (g.denied) return g.denied;
  const type = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const t = MEDIA_TYPES[type];
  if (!t || t.kind !== "photo") return fail("Envie uma foto JPG, PNG ou WEBP.", 415);
  let saved;
  try {
    saved = await saveUpload(request, { prefix: "chat-group", ext: t.ext, maxBytes: 5 * 1024 * 1024, tooLarge: "Foto acima de 5 MB." });
    if (saved.error) return fail(saved.error, saved.status);
    const { previousPhoto } = await updateGroup(g.chatId, { photo: { file: saved.file } }, sender(g.user), new Map());
    await removeMediaFile(previousPhoto);
    return json({ ok: true }, 201);
  } catch (e) {
    if (saved?.file) await removeMediaFile(saved.file);
    if (e.status) return fail(e.message, e.status);
    return serverError(e);
  }
}

// Remover a foto do grupo
export async function DELETE(request, { params }) {
  const g = await guard(request, params);
  if (g.denied) return g.denied;
  try {
    const { previousPhoto } = await updateGroup(g.chatId, { photo: null }, sender(g.user), new Map());
    await removeMediaFile(previousPhoto);
    return json({ ok: true });
  } catch (e) {
    if (e.status) return fail(e.message, e.status);
    return serverError(e);
  }
}
