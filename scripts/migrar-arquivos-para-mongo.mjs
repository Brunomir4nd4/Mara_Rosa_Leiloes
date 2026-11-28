// Copia fotos e vídeos que estavam no disco (data/media e data/videos) para o MongoDB (GridFS),
// mantendo o mesmo nome de arquivo (as referências nos registros continuam valendo).
// Uso: npm run migrar-arquivos   — pode rodar mais de uma vez: pula o que já foi copiado.
import { createReadStream, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { GridFSBucket, MongoClient } from "mongodb";
import { loadEnv } from "./env.mjs";

loadEnv(".env.local");
const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("Defina MONGODB_URI no .env.local antes de migrar.");
  process.exit(1);
}

const MIME = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime" };
const client = await new MongoClient(uri).connect();
const bucket = new GridFSBucket(client.db(process.env.MONGODB_DB || "mara-rosa-leilao"), { bucketName: "media" });

let copied = 0, skipped = 0;
try {
  for (const dir of ["data/media", "data/videos"]) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      const ext = name.split(".").pop();
      if (!MIME[ext]) continue;
      if (await bucket.find({ filename: name }).limit(1).hasNext()) { skipped++; continue; }
      await pipeline(createReadStream(path.join(dir, name)), bucket.openUploadStream(name, { metadata: { contentType: MIME[ext] } }));
      copied++;
    }
  }
  console.log(`Arquivos copiados para o MongoDB: ${copied} (já existentes: ${skipped}).`);
} finally {
  await client.close();
}
