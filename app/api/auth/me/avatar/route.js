import { fail, json, requireUser, serverError } from "../../../../../lib/api";
import { removeMediaFile, saveUpload } from "../../../../../lib/files";
import { avatarUrl, setAvatar } from "../../../../../lib/profiles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// O navegador já recorta e reduz a foto (quadrada, 512 px): o arquivo chega pequeno.
const MAX_BYTES = 2 * 1024 * 1024;
const TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

// Envia/troca a própria foto de perfil (corpo = imagem)
export async function POST(request) {
  const { user, denied } = await requireUser(request);
  if (denied) return denied;
  const type = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const ext = TYPES[type];
  if (!ext) return fail("Formato não aceito. Use JPG, PNG ou WEBP.", 415);

  let saved;
  try {
    saved = await saveUpload(request, { prefix: "avatar", ext, maxBytes: MAX_BYTES, tooLarge: "Foto acima de 2 MB." });
    if (saved.error) return fail(saved.error, saved.status);
    const avatar = { file: saved.file, size: saved.size, uploadedAt: new Date().toISOString() };
    const previous = await setAvatar(user.cpf, avatar);
    await removeMediaFile(previous?.file);
    return json({ avatar: avatarUrl(avatar) });
  } catch (e) {
    if (saved?.file) await removeMediaFile(saved.file).catch(() => {});
    return serverError(e);
  }
}

// Remove a própria foto (volta para as iniciais)
export async function DELETE(request) {
  const { user, denied } = await requireUser(request);
  if (denied) return denied;
  try {
    const previous = await setAvatar(user.cpf, null);
    await removeMediaFile(previous?.file);
    return json({ avatar: null });
  } catch (e) {
    return serverError(e);
  }
}
