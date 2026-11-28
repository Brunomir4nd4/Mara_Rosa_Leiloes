// Importa os dados da versão antiga (arquivo data/db.json) para o MongoDB.
// Uso: npm run importar-dados-locais
// - Só importa desembarques e lotes se essas coleções estiverem vazias (não duplica nada).
// - Fazendas com o mesmo nome que já existam no banco são reaproveitadas.
// Lê MONGODB_URI / MONGODB_DB do .env.local.
import { readFileSync, existsSync } from "node:fs";
import { MongoClient } from "mongodb";
import { loadEnv } from "./env.mjs";

loadEnv(".env.local"); // aceita valores entre aspas

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("Defina MONGODB_URI no .env.local antes de importar.");
  process.exit(1);
}
if (!existsSync("data/db.json")) {
  console.log("Nada para importar: data/db.json não existe.");
  process.exit(0);
}

const old = JSON.parse(readFileSync("data/db.json", "utf8"));
const client = await new MongoClient(uri).connect();
const db = client.db(process.env.MONGODB_DB || "mara-rosa-leilao");
const farms = db.collection("farms");
const entries = db.collection("entries");
const lots = db.collection("lots");
const settings = db.collection("settings");

try {
  if ((await entries.countDocuments()) || (await lots.countDocuments())) {
    console.log("O banco já tem desembarques ou lotes. Importação cancelada para não duplicar dados.");
    process.exit(0);
  }

  // fazendas
  let farmCount = 0;
  for (const f of old.farms ?? []) {
    const exists = await farms.findOne({ farmName: f.farmName }, { collation: { locale: "pt", strength: 1 } });
    if (exists) continue;
    const { id, ...rest } = f;
    await farms.insertOne({ ...rest, createdAt: new Date(f.createdAt ?? Date.now()) });
    farmCount++;
  }

  // desembarques (guarda o mapa id antigo -> id novo para refazer os vínculos)
  const idMap = new Map();
  for (const e of old.entries ?? []) {
    const { id, ...rest } = e;
    const { insertedId } = await entries.insertOne({ ...rest, createdAt: new Date(e.createdAt ?? Date.now()) });
    idMap.set(id, insertedId.toString());
  }

  // lotes (+ resultado da pista)
  let lotCount = 0;
  for (const l of old.lots ?? []) {
    const { id, entryIds = [], ...rest } = l;
    await lots.insertOne({
      ...rest,
      entryIds: entryIds.map((x) => idMap.get(x)).filter(Boolean),
      createdAt: new Date(l.createdAt ?? Date.now()),
    });
    lotCount++;
  }
  await lots.createIndex({ lot: 1 }, { unique: true });

  // a quantidade de lotes nunca pode ficar menor que o maior lote importado (senão ele some do quadro)
  const highest = Math.max(0, ...(old.lots ?? []).map((l) => Number(l.lot) || 0));
  const total = Math.max(old.settings?.totalLots ?? 0, highest);
  if (total) await settings.updateOne({ _id: "leilao" }, { $max: { totalLots: Math.max(total, 40) } }, { upsert: true });

  console.log(`Importado: ${farmCount} fazendas, ${idMap.size} desembarques, ${lotCount} lotes.`);
} finally {
  await client.close();
}
