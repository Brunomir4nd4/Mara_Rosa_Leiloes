// Acesso aos dados no MongoDB (conexão em lib/mongodb.js). Vídeos continuam em disco (data/videos).
//
// Coleções:
//   farms    → fazendas (com dados do titular — nunca vão para o público)
//   entries  → registros do desembarque (gado que chegou de cada fazenda), sem número de lote
//   lots     → lote do quadro (1..totalLots) vinculado a uma fazenda e a registros dela (+ resultado da pista)
//   settings → { _id: "leilao", totalLots } quantidade de lotes do leilão
//
// Os documentos vão para o front com `id` (texto) no lugar de `_id`, como já fazia a API de fazendas.
import path from "node:path";
import { ObjectId } from "mongodb";
import { getDb } from "./mongodb";
import { withId } from "./api";
import { DEFAULT_TOTAL_LOTS, MAX_LOTS } from "./catalog";

export const VIDEO_DIR = path.join(process.cwd(), "data", "videos");

function httpError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

const toObjectId = (id) => (typeof id === "string" && ObjectId.isValid(id) ? new ObjectId(id) : null);

// Índices criados uma vez por processo (o número do lote é único: evita dois vínculos ao mesmo tempo)
let indexes;
async function collections() {
  const db = await getDb();
  const c = {
    farms: db.collection("farms"),
    entries: db.collection("entries"),
    lots: db.collection("lots"),
    settings: db.collection("settings"),
  };
  indexes ??= Promise.all([
    c.lots.createIndex({ lot: 1 }, { unique: true }),
    c.lots.createIndex({ entryIds: 1 }),
    c.entries.createIndex({ farm: 1 }),
  ]).catch((err) => { indexes = undefined; throw err; });
  await indexes;
  return c;
}

// Comparação de nome de fazenda sem diferenciar maiúsculas/acentos
const SAME_NAME = { locale: "pt", strength: 1 };

/* ---------- Fazendas ---------- */

export async function listFarms() {
  const { farms } = await collections();
  return (await farms.find().sort({ createdAt: 1 }).toArray()).map(withId);
}

export async function addFarm(data) {
  const { farms } = await collections();
  const exists = await farms.findOne({ farmName: data.farmName.trim() }, { collation: SAME_NAME });
  if (exists) throw httpError("Já existe uma fazenda com esse nome.", 409);
  const doc = { ...data, createdAt: new Date() };
  const { insertedId } = await farms.insertOne(doc);
  return withId({ _id: insertedId, ...doc });
}

/* ---------- Desembarque ---------- */

export async function listEntries() {
  const { entries } = await collections();
  return (await entries.find().sort({ createdAt: 1 }).toArray()).map(withId);
}

export async function addEntry(data) {
  const { farms, entries } = await collections();
  if (!(await farms.findOne({ farmName: data.farm }))) {
    throw httpError("Fazenda não encontrada. Cadastre a fazenda primeiro.", 400);
  }
  const doc = { ...data, createdAt: new Date() };
  const { insertedId } = await entries.insertOne(doc);
  return withId({ _id: insertedId, ...doc });
}

/* ---------- Lotes ---------- */

export async function getTotalLots() {
  const { settings } = await collections();
  return (await settings.findOne({ _id: "leilao" }))?.totalLots ?? DEFAULT_TOTAL_LOTS;
}

export async function listLots() {
  const { lots } = await collections();
  return (await lots.find().sort({ lot: 1 }).toArray()).map(withId);
}

// Para o catálogo público: sem o resultado da pista (comprador e valores ficam só no painel)
export async function listPublicLots() {
  const { lots } = await collections();
  return (await lots.find({}, { projection: { pista: 0 } }).sort({ lot: 1 }).toArray()).map(withId);
}

export async function getLot(id) {
  const _id = toObjectId(id);
  if (!_id) return null;
  const { lots } = await collections();
  const lot = await lots.findOne({ _id });
  return lot ? withId(lot) : null;
}

// Adiciona (delta > 0) ou remove (delta < 0) lotes do final do quadro.
// Só remove lotes disponíveis: um lote vinculado no final bloqueia a remoção.
export async function changeTotalLots(delta) {
  const { lots, settings } = await collections();
  const total = await getTotalLots();
  if (!Number.isInteger(delta) || delta === 0) throw httpError("Informe uma quantidade válida.", 400);
  const next = total + delta;
  if (next > MAX_LOTS) throw httpError(`O leilão pode ter no máximo ${MAX_LOTS} lotes (hoje são ${total}).`, 400);
  if (next < 1) throw httpError("O leilão precisa ter pelo menos 1 lote.", 400);
  if (delta < 0) {
    const blocking = await lots.find({ lot: { $gt: next } }).sort({ lot: -1 }).limit(1).toArray();
    if (blocking.length) throw httpError(`O lote ${blocking[0].lot} está vinculado. Desvincule antes de remover.`, 409);
  }
  await settings.updateOne({ _id: "leilao" }, { $set: { totalLots: next } }, { upsert: true });
  return { total: next };
}

// Vincula um lote disponível a uma fazenda e a registros do desembarque dessa fazenda
export async function linkLot({ lot, farm, entryIds }) {
  const { farms, entries, lots } = await collections();
  const total = await getTotalLots();
  if (!Number.isInteger(lot) || lot < 1 || lot > total) throw httpError(`Lote inválido. Use de 1 a ${total}.`, 400);
  const taken = await lots.findOne({ lot });
  if (taken) throw httpError(`O lote ${lot} já está vinculado à ${taken.farm}.`, 409);
  if (!(await farms.findOne({ farmName: farm }))) throw httpError("Fazenda não encontrada.", 400);

  const ids = [...new Set(entryIds)];
  if (!ids.length) throw httpError("Selecione ao menos um registro do desembarque.", 400);
  const objectIds = ids.map(toObjectId);
  if (objectIds.some((x) => !x)) throw httpError("Um dos registros selecionados é inválido. Atualize a página.", 400);

  const found = await entries.find({ _id: { $in: objectIds } }).toArray();
  if (found.length !== ids.length) throw httpError("Um dos registros selecionados não existe mais. Atualize a página.", 400);
  if (found.some((e) => e.farm !== farm)) throw httpError("Todos os registros precisam ser da fazenda escolhida.", 400);
  const used = await lots.findOne({ entryIds: { $in: ids } });
  if (used) throw httpError(`Um dos registros já está no lote ${used.lot}.`, 409);

  const doc = { lot, farm, entryIds: ids, video: null, createdAt: new Date() };
  try {
    const { insertedId } = await lots.insertOne(doc);
    return withId({ _id: insertedId, ...doc });
  } catch (err) {
    // índice único: outra pessoa vinculou o mesmo lote no mesmo instante
    if (err.code === 11000) throw httpError(`O lote ${lot} acabou de ser vinculado por outra pessoa. Atualize a página.`, 409);
    throw err;
  }
}

// Desvincula (apaga) o lote. Os registros do desembarque voltam a ficar sem lote.
export async function unlinkLot(id) {
  const _id = toObjectId(id);
  const { lots } = await collections();
  const lot = _id && (await lots.findOne({ _id }));
  if (!lot) throw httpError("Lote não encontrado.", 404);
  const status = lot.pista?.status;
  if (status && status !== "AGUARDANDO") {
    throw httpError("Este lote já tem resultado na pista. Volte a situação para “Aguardando pista” antes de desvincular.", 409);
  }
  await lots.deleteOne({ _id });
  return withId(lot);
}

// Grava o resultado da pista do lote (já validado e normalizado pela API)
export async function setLotPista(id, pista) {
  const _id = toObjectId(id);
  const { lots } = await collections();
  const updated = _id && (await lots.findOneAndUpdate(
    { _id },
    { $set: { pista: { ...pista, updatedAt: new Date().toISOString() } } },
    { returnDocument: "after" }
  ));
  if (!updated) throw httpError("Lote não encontrado. Ele pode ter sido desvinculado.", 404);
  return withId(updated);
}

// Troca (ou remove, com video = null) o vídeo do lote. Devolve o vídeo anterior para apagar o arquivo.
// (Usado pelo futuro admin de vídeos; a rota continua disponível.)
export async function setLotVideo(id, video) {
  const _id = toObjectId(id);
  const { lots } = await collections();
  const before = _id && (await lots.findOneAndUpdate({ _id }, { $set: { video } }, { returnDocument: "before" }));
  if (!before) throw httpError("Lote não encontrado.", 404);
  return { lot: withId({ ...before, video }), previous: before.video ?? null };
}
