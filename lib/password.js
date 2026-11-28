// Senhas do painel: hash scrypt com salt aleatório. Só roda no servidor (Node).
// Formato guardado: "<salt>:<hash>" em base64url (sem "$", que o .env tentaria expandir).
// O script scripts/hash-senha.mjs gera exatamente este formato.
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const KEYLEN = 32;

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, KEYLEN);
  return `${salt.toString("base64url")}:${hash.toString("base64url")}`;
}

export async function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await scryptAsync(password, Buffer.from(salt, "base64url"), expected.length || KEYLEN);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// ADMIN_ACCOUNTS="cpf:salt:hash,cpf:salt:hash" → Map(cpf → "salt:hash")
export function loadAccounts() {
  const map = new Map();
  for (const entry of (process.env.ADMIN_ACCOUNTS || "").split(",")) {
    const [cpf, salt, hash] = entry.trim().split(":");
    if (cpf && salt && hash) map.set(cpf.replace(/\D/g, ""), `${salt}:${hash}`);
  }
  return map;
}

// Hash fixo usado quando o CPF não existe, para a resposta levar o mesmo tempo
// (não revela quais CPFs têm conta).
export const DUMMY_HASH = "AAAAAAAAAAAAAAAAAAAAAA:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
