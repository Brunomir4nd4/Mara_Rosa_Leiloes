// Armazenamento simples em arquivo JSON (data/db.json) + vídeos em data/videos.
// SIMPLIFICAÇÃO: serve para um único servidor. Para produção com várias instâncias,
// trocar estas funções por MongoDB (mesma assinatura) e os vídeos por um storage (S3, R2…).
//
// Modelo:
//   farms   → fazendas (com dados do titular — nunca vão para o público)
//   entries → registros do desembarque (gado que chegou de cada fazenda), sem número de lote
//   lots    → lote do quadro (1..settings.totalLots) vinculado a uma fazenda e a registros dela
//   settings→ { totalLots } quantidade de lotes do leilão
import { promises as fs, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DEFAULT_TOTAL_LOTS, MAX_LOTS } from "./catalog";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
export const VIDEO_DIR = path.join(DATA_DIR, "videos");

function httpError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// Converte o formato antigo (dados do desembarque gravados direto no lote) para o novo.
// Grava na hora para que os ids gerados fiquem estáveis.
function migrate(db) {
  db.farms ??= [];
  db.entries ??= [];
  db.lots ??= [];
  if (!db.lots.some((l) => l.sexType)) return db;
  db.lots = db.lots.map((l) => {
    if (!l.sexType) return l;
    const entry = {
      id: randomUUID(), farm: l.farm, quantity: Number(l.quantity), sexType: l.sexType,
      ageMonths: Number(l.ageMonths), breed: l.breed, quality: l.quality ?? null, createdAt: l.createdAt,
    };
    db.entries.push(entry);
    return { id: l.id, lot: l.lot, farm: l.farm, entryIds: [entry.id], video: l.video ?? null, createdAt: l.createdAt };
  });
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  return db;
}

// Leitura síncrona de propósito: em modo dev o React serializa no HTML os valores de I/O
// aguardados (await) para as ferramentas de debug — e isso expunha o banco inteiro (com CPFs).
function read() {
  try {
    return migrate(JSON.parse(readFileSync(DB_FILE, "utf8")));
  } catch (e) {
    if (e.code === "ENOENT") return { farms: [], entries: [], lots: [] };
    throw e;
  }
}

async function write(db) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${DB_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2));
  await fs.rename(tmp, DB_FILE); // troca atômica: nunca deixa o arquivo pela metade
}

// Fila de escrita: evita que duas requisições simultâneas sobrescrevam uma à outra
let queue = Promise.resolve();
function mutate(fn) {
  const run = queue.then(async () => {
    const db = read();
    const result = await fn(db);
    await write(db);
    return result;
  });
  queue = run.catch(() => {});
  return run;
}

/* ---------- Fazendas ---------- */

export function listFarms() {
  return read().farms;
}

export function addFarm(data) {
  return mutate((db) => {
    const name = data.farmName.trim().toLowerCase();
    if (db.farms.some((f) => f.farmName.trim().toLowerCase() === name)) {
      throw httpError("Já existe uma fazenda com esse nome.", 409);
    }
    const farm = { id: randomUUID(), ...data, createdAt: new Date().toISOString() };
    db.farms.push(farm);
    return farm;
  });
}

/* ---------- Desembarque ---------- */

export function listEntries() {
  return read().entries;
}

export function addEntry(data) {
  return mutate((db) => {
    if (!db.farms.some((f) => f.farmName === data.farm)) {
      throw httpError("Fazenda não encontrada. Cadastre a fazenda primeiro.", 400);
    }
    const entry = { id: randomUUID(), ...data, createdAt: new Date().toISOString() };
    db.entries.push(entry);
    return entry;
  });
}

/* ---------- Lotes ---------- */

const totalOf = (db) => db.settings?.totalLots ?? DEFAULT_TOTAL_LOTS;

export function getTotalLots() {
  return totalOf(read());
}

// Adiciona (delta > 0) ou remove (delta < 0) lotes do final do quadro.
// Só remove lotes disponíveis: um lote vinculado no final bloqueia a remoção.
export function changeTotalLots(delta) {
  return mutate((db) => {
    const total = totalOf(db);
    if (!Number.isInteger(delta) || delta === 0) throw httpError("Informe uma quantidade válida.", 400);
    const next = total + delta;
    if (next > MAX_LOTS) throw httpError(`O leilão pode ter no máximo ${MAX_LOTS} lotes (hoje são ${total}).`, 400);
    if (next < 1) throw httpError("O leilão precisa ter pelo menos 1 lote.", 400);
    if (delta < 0) {
      const blocking = db.lots.filter((l) => l.lot > next).map((l) => l.lot).sort((a, b) => b - a);
      if (blocking.length) throw httpError(`O lote ${blocking[0]} está vinculado. Desvincule antes de remover.`, 409);
    }
    db.settings = { ...(db.settings ?? {}), totalLots: next };
    return { total: next };
  });
}

export function listLots() {
  return read().lots.sort((a, b) => a.lot - b.lot);
}

export function getLot(id) {
  return read().lots.find((l) => l.id === id) ?? null;
}

// Vincula um lote livre a uma fazenda e a registros do desembarque dessa fazenda
export function linkLot({ lot, farm, entryIds }) {
  return mutate((db) => {
    const total = totalOf(db);
    if (!Number.isInteger(lot) || lot < 1 || lot > total) throw httpError(`Lote inválido. Use de 1 a ${total}.`, 400);
    const taken = db.lots.find((l) => l.lot === lot);
    if (taken) throw httpError(`O lote ${lot} já está vinculado à ${taken.farm}.`, 409);
    if (!db.farms.some((f) => f.farmName === farm)) throw httpError("Fazenda não encontrada.", 400);
    if (!entryIds.length) throw httpError("Selecione ao menos um registro do desembarque.", 400);

    const used = new Map(db.lots.flatMap((l) => l.entryIds.map((id) => [id, l.lot])));
    for (const id of entryIds) {
      const entry = db.entries.find((e) => e.id === id);
      if (!entry) throw httpError("Um dos registros selecionados não existe mais. Atualize a página.", 400);
      if (entry.farm !== farm) throw httpError("Todos os registros precisam ser da fazenda escolhida.", 400);
      if (used.has(id)) throw httpError(`Um dos registros já está no lote ${used.get(id)}.`, 409);
    }

    const record = { id: randomUUID(), lot, farm, entryIds: [...new Set(entryIds)], video: null, createdAt: new Date().toISOString() };
    db.lots.push(record);
    return record;
  });
}

// Desvincula (apaga) o lote. Os registros do desembarque voltam a ficar sem lote.
export function unlinkLot(id) {
  return mutate((db) => {
    const index = db.lots.findIndex((l) => l.id === id);
    if (index < 0) throw httpError("Lote não encontrado.", 404);
    const status = db.lots[index].pista?.status;
    if (status && status !== "AGUARDANDO") {
      throw httpError("Este lote já tem resultado na pista. Volte a situação para “Aguardando pista” antes de desvincular.", 409);
    }
    const [removed] = db.lots.splice(index, 1);
    return removed;
  });
}

// Grava o resultado da pista do lote (já validado e normalizado pela API)
export function setLotPista(id, pista) {
  return mutate((db) => {
    const lot = db.lots.find((l) => l.id === id);
    if (!lot) throw httpError("Lote não encontrado. Ele pode ter sido desvinculado.", 404);
    lot.pista = { ...pista, updatedAt: new Date().toISOString() };
    return lot;
  });
}

// Troca (ou remove, com video = null) o vídeo do lote. Devolve o vídeo anterior para apagar o arquivo.
// (Usado pelo futuro admin de vídeos; a rota continua disponível.)
export function setLotVideo(id, video) {
  return mutate((db) => {
    const lot = db.lots.find((l) => l.id === id);
    if (!lot) throw httpError("Lote não encontrado.", 404);
    const previous = lot.video;
    lot.video = video;
    return { lot, previous };
  });
}
