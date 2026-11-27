// Sessões do painel e limite de tentativas de login, guardados no MongoDB.
// - Sair apaga a sessão no banco: um cookie copiado deixa de valer na hora.
// - Tirar um CPF de ADMIN_ACCOUNTS também corta o acesso das sessões dele.
// - O limite de tentativas vale por CPF (não dá para contornar trocando o IP) e por IP.
import { randomBytes } from "node:crypto";
import { getDb } from "./mongodb";
import { loadAccounts } from "./password";
import { SESSION_COOKIE, SESSION_MAX_AGE, createSessionToken, verifySessionToken } from "./session";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_CPF = 8;
const MAX_PER_IP = 30;

let setup;
async function cols() {
  const db = await getDb();
  const c = { sessions: db.collection("sessions"), attempts: db.collection("login_attempts") };
  // o próprio MongoDB apaga sessões vencidas e tentativas antigas (índices TTL)
  setup ??= Promise.all([
    c.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    c.sessions.createIndex({ cpf: 1 }),
    c.attempts.createIndex({ at: 1 }, { expireAfterSeconds: WINDOW_MS / 1000 }),
    c.attempts.createIndex({ key: 1, at: 1 }),
  ]).catch((err) => { setup = undefined; throw err; });
  await setup;
  return c;
}

// IP do cliente: na Vercel o x-real-ip é definido pela própria plataforma.
// Fora dela o cabeçalho pode ser inventado — por isso o limite principal é por CPF.
export function clientIp(request) {
  return request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
}

// true se ainda pode tentar; conta a tentativa
export async function allowLoginAttempt(ip, cpf) {
  const { attempts } = await cols();
  const since = new Date(Date.now() - WINDOW_MS);
  const [byCpf, byIp] = await Promise.all([
    cpf ? attempts.countDocuments({ key: `cpf:${cpf}`, at: { $gte: since } }) : 0,
    attempts.countDocuments({ key: `ip:${ip}`, at: { $gte: since } }),
  ]);
  if (byCpf >= MAX_PER_CPF || byIp >= MAX_PER_IP) return false;
  const now = new Date();
  await attempts.insertMany([{ key: `ip:${ip}`, at: now }, ...(cpf ? [{ key: `cpf:${cpf}`, at: now }] : [])]);
  return true;
}

export async function clearLoginAttempts(cpf) {
  const { attempts } = await cols();
  await attempts.deleteMany({ key: `cpf:${cpf}` });
}

// Cria a sessão no banco e devolve o token do cookie
export async function createSession(cpf) {
  const { sessions } = await cols();
  const sid = randomBytes(24).toString("base64url");
  await sessions.insertOne({ _id: sid, cpf, createdAt: new Date(), expiresAt: new Date(Date.now() + SESSION_MAX_AGE * 1000) });
  return createSessionToken(sid);
}

export async function destroySession(token) {
  const data = await verifySessionToken(token);
  if (!data?.sid) return;
  const { sessions } = await cols();
  await sessions.deleteOne({ _id: data.sid });
}

// Sessão válida = assinatura ok + existe no banco + não venceu + CPF ainda tem conta
export async function isValidSessionToken(token) {
  const data = await verifySessionToken(token);
  if (!data?.sid) return false;
  const { sessions } = await cols();
  const s = await sessions.findOne({ _id: data.sid, expiresAt: { $gt: new Date() } });
  return Boolean(s && loadAccounts().has(s.cpf));
}

export async function isAdminRequest(request) {
  return isValidSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
}
