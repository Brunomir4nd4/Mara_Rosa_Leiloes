// Usuários do painel (coleção "users"). Só no servidor.
// As contas do ADMIN_ACCOUNTS (.env) continuam valendo como "contas do sistema" (função TI):
// garantem acesso mesmo com o banco vazio e não aparecem para edição.
import { ObjectId } from "mongodb";
import { createHash } from "node:crypto";
import { getDb } from "./mongodb";
import { hashPassword, loadAccounts } from "./password";
import { maskCpf } from "./cpf";
import { ROLES } from "./roles";
import { avatarMap } from "./profiles";

// id estável das contas do .env, sem colisão e sem revelar o CPF
const envId = (cpf) => `env:${createHash("sha256").update(cpf).digest("hex").slice(0, 16)}`;

function httpError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

let setup;
async function users() {
  const col = (await getDb()).collection("users");
  setup ??= col.createIndex({ cpf: 1 }, { unique: true }).catch((e) => { setup = undefined; throw e; });
  await setup;
  return col;
}

// Nunca devolve o hash da senha
const publicUser = ({ _id, passwordHash, ...u }) => ({ id: _id.toString(), ...u, cpf: maskCpf(u.cpf) });

export async function listUsers() {
  const col = await users();
  const raw = await col.find().sort({ createdAt: 1 }).toArray();
  const envCpfs = [...loadAccounts().keys()].filter((cpf) => !raw.some((u) => u.cpf === cpf));
  const photos = await avatarMap([...envCpfs, ...raw.map((u) => u.cpf)]);
  const db = raw.map((u) => ({ ...publicUser(u), avatar: photos.get(u.cpf) ?? null }));
  const system = envCpfs.map((cpf) => ({
    id: envId(cpf), cpf: maskCpf(cpf), name: "Conta do sistema", role: "TI", active: true, system: true, avatar: photos.get(cpf) ?? null,
  }));
  return [...system, ...db];
}

// Usuário ativo pelo CPF (para login e sessão): { cpf, name, role, passwordHash, system }
export async function findLoginUser(cpf) {
  const col = await users();
  const u = await col.findOne({ cpf });
  if (u) return u.active ? { ...u, id: u._id.toString() } : null;
  const hash = loadAccounts().get(cpf);
  return hash ? { cpf, name: "Conta do sistema", role: "TI", passwordHash: hash, system: true, id: envId(cpf) } : null;
}

export async function createUser({ name, cpf, role, password }) {
  if (!ROLES.includes(role)) throw httpError("Função inválida.", 400);
  if (loadAccounts().has(cpf)) throw httpError("Este CPF já é uma conta do sistema (.env).", 409);
  const col = await users();
  const doc = { name, cpf, role, active: true, passwordHash: await hashPassword(password), createdAt: new Date() };
  try {
    const { insertedId } = await col.insertOne(doc);
    return publicUser({ _id: insertedId, ...doc });
  } catch (e) {
    if (e.code === 11000) throw httpError("Já existe um usuário com este CPF.", 409);
    throw e;
  }
}

export async function getUser(id) {
  const _id = typeof id === "string" && ObjectId.isValid(id) ? new ObjectId(id) : null;
  if (!_id) return null;
  return (await users()).findOne({ _id });
}

// Altera nome, função, situação (ativo) e/ou senha
export async function updateUser(id, changes) {
  const target = await getUser(id);
  if (!target) throw httpError("Usuário não encontrado.", 404);
  const set = {};
  if (changes.name != null) set.name = changes.name;
  if (changes.role != null) {
    if (!ROLES.includes(changes.role)) throw httpError("Função inválida.", 400);
    set.role = changes.role;
  }
  if (changes.active != null) set.active = Boolean(changes.active);
  if (changes.password) set.passwordHash = await hashPassword(changes.password);
  set.updatedAt = new Date();
  const col = await users();
  const updated = await col.findOneAndUpdate({ _id: target._id }, { $set: set }, { returnDocument: "after" });
  // nome do Criador também aparece nos refugos vinculados a ele
  if (set.name && updated.role === "CRIADOR") {
    const db = await getDb();
    await db.collection("entries").updateMany({ ownerId: target._id.toString() }, { $set: { ownerName: set.name } });
    await db.collection("farms").updateMany({ criadorId: target._id.toString() }, { $set: { criadorName: set.name } });
  }
  return { user: publicUser(updated), before: target };
}

// Quantos TI ativos existem (banco + contas do sistema) — para nunca ficar sem acesso total
export async function countActiveTI(excludeId) {
  const col = await users();
  const filter = { role: "TI", active: true };
  if (excludeId) filter._id = { $ne: new ObjectId(excludeId) };
  // contas do .env que também existem no banco valem pelo cadastro do banco (não contam duas vezes)
  const envCpfs = [...loadAccounts().keys()];
  const inDb = new Set((await col.find({ cpf: { $in: envCpfs } }, { projection: { cpf: 1 } }).toArray()).map((u) => u.cpf));
  return (await col.countDocuments(filter)) + envCpfs.filter((c) => !inDb.has(c)).length;
}

// Criadores ativos, para vincular refugos (só id e nome)
export async function listCriadores() {
  const col = await users();
  return (await col.find({ role: "CRIADOR", active: true }, { projection: { name: 1 } }).sort({ name: 1 }).toArray())
    .map((u) => ({ id: u._id.toString(), name: u.name }));
}
