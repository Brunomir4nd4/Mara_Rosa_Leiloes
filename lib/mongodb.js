import { MongoClient } from "mongodb";

const DEFAULT_DB = "mara-rosa-leilao";

// Uma única conexão por processo. Fica no globalThis para sobreviver às recargas do `next dev`.
let clientPromise = globalThis._mongoClientPromise;

export async function getDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Defina MONGODB_URI no arquivo .env.local");

  if (!clientPromise) {
    clientPromise = new MongoClient(uri).connect().catch((err) => {
      // Se a conexão falhar, não guarda a falha: a próxima chamada tenta de novo
      clientPromise = globalThis._mongoClientPromise = undefined;
      throw err;
    });
    globalThis._mongoClientPromise = clientPromise;
  }

  const client = await clientPromise;
  return client.db(process.env.MONGODB_DB || DEFAULT_DB);
}
