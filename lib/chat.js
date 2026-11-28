// Chat interno entre os usuários do painel (estilo WhatsApp).
// - "geral": grupo com todos os usuários ativos.
// - Conversa direta: id "dm|<idA>|<idB>" (ids em ordem), só os dois participantes.
// - Grupo criado (TI/Administrativo): id "g|<hex>", com nome, foto e participantes.
// Mensagens: texto, foto ou vídeo (GridFS), resposta (citação), encaminhada e mensagens de sistema.
// Entrega e leitura por pessoa: delivered.<id> (o painel dela buscou as conversas) e reads.<id> (abriu a conversa).
import { ObjectId } from "mongodb";
import { getDb } from "./mongodb";

export const GENERAL = "geral";
const SEP = "|";

function httpError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

let setup;
async function cols() {
  const db = await getDb();
  const c = { chats: db.collection("chats"), messages: db.collection("messages"), presence: db.collection("chat_presence") };
  setup ??= Promise.all([
    c.messages.createIndex({ chatId: 1, createdAt: -1 }),
    c.messages.createIndex({ file: 1 }, { sparse: true }),
    c.chats.createIndex({ members: 1, lastAt: -1 }),
  ]).catch((e) => { setup = undefined; throw e; });
  await setup;
  return c;
}

export const dmId = (a, b) => ["dm", ...[a, b].sort()].join(SEP);
export const isGroupId = (id) => /^g\|[0-9a-f]{24}$/.test(String(id));

// Participantes de uma conversa direta (ou null se o id não for de conversa direta válida)
export function dmMembers(chatId) {
  const p = String(chatId).split(SEP);
  return p.length === 3 && p[0] === "dm" && p[1] && p[2] && p[1] !== p[2] ? [p[1], p[2]] : null;
}

export async function getChat(chatId) {
  const { chats } = await cols();
  return chats.findOne({ _id: chatId });
}

// O usuário participa da conversa?
export async function canAccess(chatId, userId) {
  if (chatId === GENERAL) return true;
  const m = dmMembers(chatId);
  if (m) return m.includes(userId);
  if (isGroupId(chatId)) return Boolean(await (await cols()).chats.findOne({ _id: chatId, members: userId }, { projection: { _id: 1 } }));
  return false;
}

const iso = (d) => (d ? new Date(d).toISOString() : null);
const isoMap = (m) => Object.fromEntries(Object.entries(m ?? {}).map(([k, v]) => [k, iso(v)]));
// dlv/rd (horário de entrega/leitura por pessoa) ficam fora da lista; aparecem em "Dados da mensagem"
const publicMessage = ({ _id, dlv, rd, ...m }) => ({ id: _id.toString(), ...m, createdAt: iso(m.createdAt) });
const preview = (m) => (m.kind === "photo" ? "Foto" : m.kind === "video" ? "Vídeo" : m.kind === "system" ? m.text : m.text.slice(0, 120));

// Marca nas mensagens (dlv/rd) o horário em que chegaram/foram lidas por esta pessoa.
// Só olha as mensagens desde a última marcação (usa o índice chatId + createdAt).
async function stamp(chatId, userId, field, since, now) {
  const { messages } = await cols();
  await messages.updateMany(
    { chatId, createdAt: { $gt: since ?? new Date(0), $lte: now }, "from.id": { $ne: userId }, kind: { $ne: "system" }, [`${field}.${userId}`]: { $exists: false } },
    { $set: { [`${field}.${userId}`]: now } },
  );
}

// O painel do usuário buscou as conversas: as mensagens até agora foram "entregues" a ele
export async function markDelivered(userId) {
  const { chats } = await cols();
  const now = new Date();
  const list = await chats.find({ $or: [{ _id: GENERAL }, { members: userId }] }, { projection: { lastAt: 1, [`delivered.${userId}`]: 1 } }).toArray();
  for (const c of list) {
    const prev = c.delivered?.[userId];
    if (c.lastAt && (!prev || c.lastAt > prev)) {
      await stamp(c._id, userId, "dlv", prev, now);
      await chats.updateOne({ _id: c._id }, { $set: { [`delivered.${userId}`]: now } });
    }
  }
}

// Conversas do usuário: "geral" + diretas + grupos em que participa
export async function listChats(userId) {
  const { chats, messages } = await cols();
  const general = (await chats.findOne({ _id: GENERAL })) ?? { _id: GENERAL, type: "general", lastAt: null, last: null, reads: {}, delivered: {} };
  const mine = await chats.find({ members: userId }).sort({ lastAt: -1 }).limit(300).toArray();
  return Promise.all([general, ...mine].map(async (c) => {
    const since = c.reads?.[userId] ?? new Date(0);
    const unread = c.lastAt && c.lastAt > since
      ? await messages.countDocuments({ chatId: c._id, createdAt: { $gt: since }, "from.id": { $ne: userId }, kind: { $ne: "system" } })
      : 0;
    const type = c._id === GENERAL ? "general" : c.type;
    return {
      id: c._id, type,
      other: type === "direct" ? c.members.find((m) => m !== userId) : null,
      name: c.name ?? null, photo: c.photo?.file ? `/api/chat/file/${c.photo.file}` : null,
      members: type === "general" ? null : c.members, createdBy: c.createdBy ?? null,
      last: c.last ?? null, lastAt: iso(c.lastAt), unread,
      reads: isoMap(c.reads), delivered: isoMap(c.delivered),
    };
  }));
}

// Mensagens: as últimas (inicial), as mais novas que `after` (atualização) ou as anteriores a `before`
export async function listMessages(chatId, { after, before, limit = 80 } = {}) {
  const { messages } = await cols();
  const q = { chatId };
  if (after) q.createdAt = { $gt: new Date(after) };
  else if (before) q.createdAt = { $lt: new Date(before) };
  const docs = await messages.find(q).sort({ createdAt: after ? 1 : -1 }).limit(Math.min(limit, 150)).toArray();
  if (!after) docs.reverse();
  return docs.map(publicMessage);
}

// Mensagem citada numa resposta (precisa ser da mesma conversa)
async function quoteOf(chatId, replyTo) {
  if (!replyTo || !ObjectId.isValid(replyTo)) return null;
  const { messages } = await cols();
  const m = await messages.findOne({ _id: new ObjectId(replyTo), chatId });
  if (!m || m.kind === "system") return null;
  return { id: m._id.toString(), from: m.from?.name ?? "", fromId: m.from?.id ?? null, kind: m.deleted ? "text" : m.kind, text: m.deleted ? "Mensagem apagada" : preview(m) };
}

// Grava a mensagem e atualiza a conversa (cria a conversa direta na primeira mensagem)
export async function addMessage(chatId, from, data) {
  const { chats, messages } = await cols();
  const now = new Date();
  const reply = await quoteOf(chatId, data.replyTo);
  const doc = {
    chatId, from, kind: data.kind, text: data.text ?? "", createdAt: now,
    ...(reply ? { reply } : {}),
    ...(data.forwarded ? { forwarded: true } : {}),
    ...(data.file ? { file: data.file, size: data.size, name: data.name ?? "", width: data.width ?? null, height: data.height ?? null } : {}),
  };
  const { insertedId } = await messages.insertOne(doc);
  const members = dmMembers(chatId);
  await chats.updateOne(
    { _id: chatId },
    {
      $set: {
        lastAt: now, last: { text: preview(doc), kind: doc.kind, from: from.name, fromId: from.id },
        ...(from.id ? { [`reads.${from.id}`]: now, [`delivered.${from.id}`]: now } : {}),
      },
      $setOnInsert: members ? { type: "direct", members, createdAt: now } : chatId === GENERAL ? { type: "general", createdAt: now } : {},
    },
    { upsert: chatId === GENERAL || Boolean(members) },
  );
  return publicMessage({ _id: insertedId, ...doc });
}

// Encaminha uma mensagem para outras conversas (o arquivo é reaproveitado, sem cópia)
export async function getForwardable(messageId) {
  const { messages } = await cols();
  if (!ObjectId.isValid(messageId)) return null;
  const m = await messages.findOne({ _id: new ObjectId(messageId) });
  return !m || m.deleted || m.kind === "system" ? null : m;
}

export async function forwardMessage(m, targetChatId, from) {
  return addMessage(targetChatId, from, {
    kind: m.kind, text: m.text, forwarded: true,
    ...(m.file ? { file: m.file, size: m.size, name: m.name, width: m.width, height: m.height } : {}),
  });
}

export async function markRead(chatId, userId) {
  const { chats } = await cols();
  const now = new Date();
  const c = await chats.findOne({ _id: chatId }, { projection: { [`reads.${userId}`]: 1, [`delivered.${userId}`]: 1 } });
  await stamp(chatId, userId, "dlv", c?.delivered?.[userId], now);
  await stamp(chatId, userId, "rd", c?.reads?.[userId], now);
  await chats.updateOne({ _id: chatId }, { $set: { [`reads.${userId}`]: now, [`delivered.${userId}`]: now } });
}

// "Dados da mensagem": quando chegou e quando foi lida por cada pessoa (só para quem enviou)
export async function messageReceipts(id, userId) {
  const { messages } = await cols();
  if (!ObjectId.isValid(id)) return null;
  const m = await messages.findOne({ _id: new ObjectId(id), "from.id": userId }, { projection: { chatId: 1, dlv: 1, rd: 1, createdAt: 1 } });
  return m ? { chatId: m.chatId, createdAt: iso(m.createdAt), delivered: isoMap(m.dlv), read: isoMap(m.rd) } : null;
}

// Conversas que usam este arquivo (o mesmo arquivo pode estar em mensagens encaminhadas)
export async function chatsOfFile(file) {
  const { messages } = await cols();
  return messages.distinct("chatId", { file });
}

// Foto de grupo: só para quem participa do grupo
export async function groupOfPhoto(file, userId) {
  const { chats } = await cols();
  return Boolean(await chats.findOne({ "photo.file": file, members: userId }, { projection: { _id: 1 } }));
}

// Apaga uma mensagem própria. Devolve o arquivo se nenhuma outra mensagem o usa (para remover do GridFS).
export async function deleteOwnMessage(id, userId) {
  const { messages } = await cols();
  if (!ObjectId.isValid(id)) throw httpError("Mensagem não encontrada.", 404);
  const before = await messages.findOneAndUpdate(
    { _id: new ObjectId(id), "from.id": userId, deleted: { $ne: true }, kind: { $ne: "system" } },
    { $set: { deleted: true, text: "", kind: "text" }, $unset: { file: "", size: "", name: "", width: "", height: "", reply: "", forwarded: "" } },
    { returnDocument: "before" },
  );
  if (!before) throw httpError("Mensagem não encontrada.", 404);
  const stillUsed = before.file ? await messages.countDocuments({ file: before.file }) : 0;
  return { chatId: before.chatId, file: before.file && !stillUsed ? before.file : null };
}

// ---------- Grupos ----------
const system = (text) => ({ kind: "system", text });

export async function createGroup({ name, members, by }) {
  const { chats } = await cols();
  const _id = `g|${new ObjectId().toHexString()}`;
  const now = new Date();
  const all = [...new Set([by.id, ...members])];
  await chats.insertOne({ _id, type: "group", name, members: all, createdBy: by.id, createdAt: now, lastAt: now, reads: {}, delivered: {} });
  await addMessage(_id, { id: null, name: "Sistema", role: null }, system(`${by.name} criou o grupo "${name}"`));
  return _id;
}

export async function updateGroup(chatId, changes, by, names) {
  const { chats } = await cols();
  const g = await chats.findOne({ _id: chatId, type: "group" });
  if (!g) throw httpError("Grupo não encontrado.", 404);
  const set = {};
  const notes = [];
  if (changes.name && changes.name !== g.name) { set.name = changes.name; notes.push(`${by.name} mudou o nome do grupo para "${changes.name}"`); }
  let members = [...g.members];
  for (const id of changes.add ?? []) if (!members.includes(id)) { members.push(id); notes.push(`${by.name} adicionou ${names.get(id) ?? "um participante"}`); }
  for (const id of changes.remove ?? []) if (members.includes(id)) { members = members.filter((m) => m !== id); notes.push(id === by.id ? `${by.name} saiu do grupo` : `${by.name} removeu ${names.get(id) ?? "um participante"}`); }
  if (members.length !== g.members.length || changes.add?.length || changes.remove?.length) set.members = members;
  if (changes.photo !== undefined) { set.photo = changes.photo; notes.push(changes.photo ? `${by.name} mudou a foto do grupo` : `${by.name} removeu a foto do grupo`); }
  if (!Object.keys(set).length) return { previousPhoto: null };
  await chats.updateOne({ _id: chatId }, { $set: set });
  for (const n of notes) await addMessage(chatId, { id: null, name: "Sistema", role: null }, system(n));
  return { previousPhoto: changes.photo !== undefined ? g.photo?.file ?? null : null };
}

// ---------- Presença (online/offline) e "digitando…" ----------
// Cada consulta do painel ao chat renova o "visto por último". Online = sinal nos últimos 45 s.
export const ONLINE_MS = 45_000;
const TYPING_MS = 6_000;

export async function touchPresence(userId) {
  await (await cols()).presence.updateOne({ _id: userId }, { $set: { lastSeen: new Date() } }, { upsert: true });
}

export async function presenceMap(ids) {
  const docs = await (await cols()).presence.find({ _id: { $in: ids } }, { projection: { lastSeen: 1 } }).toArray();
  return new Map(docs.map((d) => [d._id, d.lastSeen.toISOString()]));
}

export async function setTyping(userId, chatId, name) {
  await (await cols()).presence.updateOne({ _id: userId }, { $set: { lastSeen: new Date(), typing: { chatId, at: new Date(), name } } }, { upsert: true });
}

export async function typingIn(chatId, exceptId) {
  const since = new Date(Date.now() - TYPING_MS);
  const docs = await (await cols()).presence.find({ "typing.chatId": chatId, "typing.at": { $gte: since }, _id: { $ne: exceptId } }, { projection: { typing: 1 } }).toArray();
  return docs.map((d) => ({ id: d._id, name: d.typing.name }));
}

export async function clearTyping(userId) {
  await (await cols()).presence.updateOne({ _id: userId }, { $unset: { typing: "" } });
}
