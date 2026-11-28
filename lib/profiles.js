// Perfil do usuário (foto). Fica numa coleção própria, indexada pelo CPF:
// vale tanto para usuários do banco quanto para as contas do sistema (.env).
import { getDb } from "./mongodb";

let setup;
async function profiles() {
  const col = (await getDb()).collection("profiles");
  setup ??= col.createIndex({ cpf: 1 }, { unique: true }).catch((e) => { setup = undefined; throw e; });
  await setup;
  return col;
}

export const avatarUrl = (avatar) => (avatar?.file ? `/api/admin/media/${avatar.file}` : null);

export async function getAvatar(cpf) {
  return (await (await profiles()).findOne({ cpf }))?.avatar ?? null;
}

// Troca (ou remove, com null) a foto. Devolve a anterior para apagar o arquivo.
export async function setAvatar(cpf, avatar) {
  const before = await (await profiles()).findOneAndUpdate(
    { cpf },
    { $set: { avatar, updatedAt: new Date() } },
    { upsert: true, returnDocument: "before" },
  );
  return before?.avatar ?? null;
}

// cpf → url da foto (para a lista de usuários)
export async function avatarMap(cpfs) {
  const docs = await (await profiles()).find({ cpf: { $in: cpfs }, "avatar.file": { $exists: true } }).toArray();
  return new Map(docs.map((d) => [d.cpf, avatarUrl(d.avatar)]));
}
