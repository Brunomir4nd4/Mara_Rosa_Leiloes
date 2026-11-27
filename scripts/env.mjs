import { existsSync, readFileSync } from "node:fs";

// Lê um arquivo .env simples para os scripts (o Next.js faz isso sozinho no app).
// Aceita valores com ou sem aspas e ignora comentários. Variáveis já definidas no sistema têm prioridade.
export function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trimStart().startsWith("#")) continue;
    let value = m[2];
    const quoted = /^(['"])(.*)\1$/.exec(value);
    if (quoted) value = quoted[2];
    else value = value.replace(/\s+#.*$/, ""); // comentário no fim da linha (só sem aspas)
    if (!(m[1] in process.env)) process.env[m[1]] = value;
  }
}
