// Gera a entrada de ADMIN_ACCOUNTS para um leiloeiro.
// Uso: npm run hash-senha   (pede CPF e senha; nada fica no histórico do terminal)
// O formato precisa bater com lib/password.js: cpf:salt:hash (base64url).
import { randomBytes, scryptSync } from "node:crypto";
import { createInterface } from "node:readline";
import { stdin as input, stdout as output } from "node:process";

// Iterador de linhas: funciona digitando no terminal e também com entrada redirecionada
const rl = createInterface({ input, terminal: false });
const lines = rl[Symbol.asyncIterator]();
async function ask(question) {
  output.write(question);
  const { value } = await lines.next();
  return value ?? "";
}

const cpf = (await ask("CPF do leiloeiro: ")).replace(/\D/g, "");
const password = await ask("Senha (mínimo 8 caracteres): ");
rl.close();

if (cpf.length !== 11) {
  console.error("CPF precisa ter 11 números.");
  process.exit(1);
}
if (password.length < 8) {
  console.error("Senha muito curta: use pelo menos 8 caracteres.");
  process.exit(1);
}

const salt = randomBytes(16);
const hash = scryptSync(password, salt, 32);
console.log("\nAdicione ao ADMIN_ACCOUNTS no .env.local (separe várias contas por vírgula):\n");
console.log(`${cpf}:${salt.toString("base64url")}:${hash.toString("base64url")}`);
