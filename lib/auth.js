// Sessões do painel e limite de tentativas de login, guardados no MongoDB.
// - Sair apaga a sessão no banco: um cookie copiado deixa de valer na hora.
// - Tirar um CPF de ADMIN_ACCOUNTS também corta o acesso das sessões dele.
// - O limite de tentativas conta só as falhas: por CPF+IP, por CPF e por IP.
import { randomBytes } from "node:crypto";
import { getDb } from "./mongodb";
import { findLoginUser } from "./users";
import { SESSION_COOKIE, SESSION_MAX_AGE, createSessionToken, verifySessionToken } from "./session";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_CPF = 8;
const MAX_PER_IP = 100;

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

// Limite de tentativas: conta SÓ as falhas (logins certos não gastam o limite).
// - CPF + IP: 8 falhas bloqueiam aquela combinação (um atacante não trava o CPF de todo mundo)
// - CPF em qualquer lugar: 30 falhas (contém ataque distribuído)
// - IP: 100 falhas (no leilão todos usam o mesmo Wi-Fi; logins corretos não contam)
const keysFor = (ip, cpf) => [`ipcpf:${ip}:${cpf}`, `cpf:${cpf}`, `ip:${ip}`];
const LIMITS = [MAX_PER_CPF, 30, MAX_PER_IP];

// Reserva a tentativa ANTES de conferir a senha (requisições em paralelo também contam).
// Devolve { ok, rid }: ok=false se passou do limite. No login certo, a reserva é apagada
// (logins corretos não gastam o limite); na falha, ela fica valendo como falha.
export async function allowLoginAttempt(ip, cpf) {
  const { attempts } = await cols();
  const rid = randomBytes(9).toString("base64url");
  const at = new Date();
  await attempts.insertMany(keysFor(ip, cpf).map((key) => ({ key, at, rid })));
  const since = new Date(Date.now() - WINDOW_MS);
  const counts = await Promise.all(keysFor(ip, cpf).map((key) => attempts.countDocuments({ key, at: { $gte: since } })));
  return { ok: counts.every((n, i) => n <= LIMITS[i]), rid };
}

// a falha já ficou registrada pela reserva (mantida só por compatibilidade)
export async function recordLoginFailure() {}

// login certo: apaga a reserva desta tentativa e as falhas anteriores deste CPF
export async function clearLoginAttempts(cpf, ip, rid) {
  const { attempts } = await cols();
  await attempts.deleteMany({ $or: [
    ...(rid ? [{ rid }] : []),
    { key: { $in: [`cpf:${cpf}`, ...(ip ? [`ipcpf:${ip}:${cpf}`] : [])] } },
  ] });
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

// Encerra todas as sessões de um CPF (ex.: usuário desativado ou senha trocada)
export async function destroyUserSessions(cpf) {
  const { sessions } = await cols();
  await sessions.deleteMany({ cpf });
}

// Usuário da sessão = assinatura ok + sessão existe e não venceu + usuário ainda ativo.
// A função (TI, Administrativo, Curral) é lida do cadastro a cada requisição: mudanças valem na hora.
export async function getSessionUser(token) {
  const data = await verifySessionToken(token);
  if (!data?.sid) return null;
  const { sessions } = await cols();
  const s = await sessions.findOne({ _id: data.sid, expiresAt: { $gt: new Date() } });
  if (!s) return null;
  const u = await findLoginUser(s.cpf);
  return u ? { id: u.id, cpf: u.cpf, name: u.name, role: u.role, system: Boolean(u.system) } : null;
}

export async function isValidSessionToken(token) {
  return Boolean(await getSessionUser(token));
}

export async function getRequestUser(request) {
  return getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
}
