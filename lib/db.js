// Acesso aos dados no MongoDB (conexão em lib/mongodb.js). Arquivos (fotos/vídeos) ficam no GridFS (lib/files.js).
//
// Coleções:
//   farms    → fazendas (com dados do titular — nunca vão para o público). Nome único (sem diferenciar maiúsculas/acentos).
//   entries  → registros do desembarque (gado que chegou de cada fazenda).
//              kind NORMAL ou REFUGO (com motivo, observação e anexos). `lotId` marca em qual lote o registro está.
//   lots     → lote do quadro (1..totalLots) vinculado a uma fazenda e a registros dela (+ resultado da pista)
//   settings → { _id: "leilao", totalLots } quantidade de lotes do leilão
//
// Os documentos vão para o front com `id` (texto) no lugar de `_id`, como já fazia a API de fazendas.
import { ObjectId } from "mongodb";
import { getDb } from "./mongodb";
import { withId } from "./api";
import { DEFAULT_TOTAL_LOTS, MAX_LOTS } from "./catalog";

function httpError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

const toObjectId = (id) => (typeof id === "string" && ObjectId.isValid(id) ? new ObjectId(id) : null);

// Comparação de nome de fazenda sem diferenciar maiúsculas/acentos
const SAME_NAME = { locale: "pt", strength: 1 };

// Índices e ajustes feitos uma vez por processo
let setup;
async function collections() {
  const db = await getDb();
  const c = {
    farms: db.collection("farms"),
    entries: db.collection("entries"),
    lots: db.collection("lots"),
    settings: db.collection("settings"),
  };
  setup ??= (async () => {
    await Promise.all([
      c.lots.createIndex({ lot: 1 }, { unique: true }),
      c.entries.createIndex({ farm: 1 }),
      c.entries.createIndex({ lotId: 1 }),
      // nome de fazenda único; se já existirem duplicados antigos, segue sem o índice (a checagem no código continua)
      c.farms.createIndex({ farmName: 1 }, { unique: true, collation: SAME_NAME, name: "farmName_unico" })
        .catch((err) => console.error("Índice de nome de fazenda não criado (há nomes repetidos?):", err.message)),
    ]);
    // dados de antes do `lotId`: marca os registros que já estão em lotes
    for (const lot of await c.lots.find({}, { projection: { entryIds: 1 } }).toArray()) {
      const ids = (lot.entryIds ?? []).map(toObjectId).filter(Boolean);
      if (ids.length) await c.entries.updateMany({ _id: { $in: ids }, lotId: { $exists: false } }, { $set: { lotId: lot._id } });
    }
  })().catch((err) => { setup = undefined; throw err; });
  await setup;
  return c;
}

/* ---------- Fazendas ---------- */

export async function listFarms() {
  const { farms } = await collections();
  return (await farms.find().sort({ createdAt: 1 }).toArray()).map(withId);
}

export async function addFarm(data) {
  const { farms } = await collections();
  const exists = await farms.findOne({ farmName: data.farmName }, { collation: SAME_NAME });
  if (exists) throw httpError("Já existe uma fazenda com esse nome.", 409);
  const doc = { ...data, createdAt: new Date() };
  try {
    const { insertedId } = await farms.insertOne(doc);
    return withId({ _id: insertedId, ...doc });
  } catch (err) {
    // índice único: outra pessoa cadastrou o mesmo nome no mesmo instante
    if (err.code === 11000) throw httpError("Já existe uma fazenda com esse nome.", 409);
    throw err;
  }
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

// Um registro do desembarque (com anexos)
export async function getEntry(id) {
  const _id = toObjectId(id);
  if (!_id) return null;
  const { entries } = await collections();
  const entry = await entries.findOne({ _id });
  return entry ? withId(entry) : null;
}

export async function addEntryMedia(id, media) {
  const _id = toObjectId(id);
  const { entries } = await collections();
  const updated = _id && (await entries.findOneAndUpdate({ _id }, { $push: { media } }, { returnDocument: "after" }));
  if (!updated) throw httpError("Registro do desembarque não encontrado.", 404);
  return withId(updated);
}

export async function removeEntryMedia(id, mediaId) {
  const _id = toObjectId(id);
  const { entries } = await collections();
  // remove e devolve o anexo numa operação só
  const before = _id && (await entries.findOneAndUpdate(
    { _id, "media.id": mediaId },
    { $pull: { media: { id: mediaId } } },
    { returnDocument: "before" }
  ));
  const removed = before?.media?.find((m) => m.id === mediaId);
  if (!removed) throw httpError("Anexo não encontrado.", 404);
  return { entry: withId({ ...before, media: before.media.filter((m) => m.id !== mediaId) }), removed };
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

const highestLot = async (lots) => (await lots.find().sort({ lot: -1 }).limit(1).toArray())[0]?.lot ?? 0;

// Adiciona (delta > 0) ou remove (delta < 0) lotes do final do quadro.
// Só remove lotes disponíveis: um lote vinculado no final bloqueia a remoção.
export async function changeTotalLots(delta) {
  const { lots, settings } = await collections();
  const total = await getTotalLots();
  if (!Number.isInteger(delta) || delta === 0) throw httpError("Informe uma quantidade válida.", 400);
  const next = total + delta;
  if (next > MAX_LOTS) throw httpError(`O leilão pode ter no máximo ${MAX_LOTS} lotes (hoje são ${total}).`, 400);
  if (next < 1) throw httpError("O leilão precisa ter pelo menos 1 lote.", 400);
  if (delta < 0 && (await highestLot(lots)) > next) {
    throw httpError(`O lote ${await highestLot(lots)} está vinculado. Desvincule antes de remover.`, 409);
  }
  await settings.updateOne({ _id: "leilao" }, { $set: { totalLots: next } }, { upsert: true });
  // se alguém vinculou um lote do final no mesmo instante, volta o total para não esconder esse lote
  if (delta < 0) {
    const top = await highestLot(lots);
    if (top > next) {
      await settings.updateOne({ _id: "leilao" }, { $max: { totalLots: top } });
      throw httpError(`O lote ${top} acabou de ser vinculado. A quantidade foi mantida em ${top}.`, 409);
    }
  }
  return { total: next };
}

// Vincula um lote disponível a uma fazenda e a registros do desembarque dessa fazenda.
// Cada registro é "reservado" com um update condicional (lotId vazio): se outra pessoa reservar
// algum ao mesmo tempo, a operação é desfeita e ninguém conta o mesmo gado em dois lotes.
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
  // lote de refugo só com refugo; lote normal só com gado normal
  const kinds = new Set(found.map((e) => (e.kind === "REFUGO" ? "REFUGO" : "NORMAL")));
  if (kinds.size > 1) throw httpError("Não misture refugo com gado normal no mesmo lote.", 400);
  const kind = [...kinds][0];
  const used = found.find((e) => e.lotId);
  if (used) {
    const other = await lots.findOne({ _id: used.lotId });
    throw httpError(`Um dos registros já está no lote ${other?.lot ?? "outro"}.`, 409);
  }

  const lotId = new ObjectId();
  const release = () => entries.updateMany({ lotId }, { $unset: { lotId: "" } });

  // 1) reserva os registros (só os que ainda estão sem lote)
  const claim = await entries.updateMany({ _id: { $in: objectIds }, lotId: { $exists: false } }, { $set: { lotId } });
  if (claim.modifiedCount !== ids.length) {
    await release();
    throw httpError("Um dos registros acabou de ser vinculado em outro lote. Atualize a página.", 409);
  }

  // 2) grava o lote (o índice único do número impede dois vínculos no mesmo lote)
  const doc = { _id: lotId, lot, farm, kind, entryIds: ids, video: null, createdAt: new Date() };
  try {
    await lots.insertOne(doc);
  } catch (err) {
    await release();
    if (err.code === 11000) throw httpError(`O lote ${lot} acabou de ser vinculado por outra pessoa. Atualize a página.`, 409);
    throw err;
  }

  // 3) se a quantidade de lotes foi reduzida no mesmo instante, desfaz para o lote não sumir do quadro
  if (lot > (await getTotalLots())) {
    await lots.deleteOne({ _id: lotId });
    await release();
    throw httpError(`A quantidade de lotes acabou de mudar e o lote ${lot} não existe mais. Atualize a página.`, 409);
  }
  return withId(doc);
}

// Desvincula (apaga) o lote. Os registros do desembarque voltam a ficar sem lote.
// A condição de status vai no próprio delete: um resultado gravado no mesmo instante nunca é apagado.
export async function unlinkLot(id) {
  const _id = toObjectId(id);
  const { lots, entries } = await collections();
  if (!_id) throw httpError("Lote não encontrado.", 404);
  const removed = await lots.findOneAndDelete({
    _id,
    $or: [{ "pista.status": { $exists: false } }, { "pista.status": "AGUARDANDO" }],
  });
  if (!removed) {
    if (await lots.findOne({ _id }, { projection: { _id: 1 } })) {
      throw httpError("Este lote já tem resultado na pista. Volte a situação para “Aguardando pista” antes de desvincular.", 409);
    }
    throw httpError("Lote não encontrado.", 404);
  }
  await entries.updateMany({ lotId: _id }, { $unset: { lotId: "" } });
  return withId(removed);
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
