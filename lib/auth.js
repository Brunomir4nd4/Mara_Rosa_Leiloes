// Sessões do painel e limite de tentativas de login, guardados no MongoDB.
// - Sair apaga a sessão no banco: um cookie copiado deixa de valer na hora.
// - Tirar um CPF de ADMIN_ACCOUNTS também corta o acesso das sessões dele.
// - O limite de tentativas conta só as falhas. Só CPF+IP bloqueia; CPF e IP sozinhos só atrasam a resposta.
// - A sessão vale 8h sem uso: enquanto a pessoa usa o painel, ela é renovada (veja renewIfNeeded).
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getDb } from "./mongodb";
import { findLoginUser } from "./users";
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS, SESSION_MAX_AGE, createSessionToken, verifySessionToken } from "./session";

const WINDOW_MS = 15 * 60 * 1000;

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

// IP do cliente. ATENÇÃO: x-real-ip e x-forwarded-for só são confiáveis atrás da Vercel,
// que sobrescreve esses cabeçalhos. Fora dela qualquer um pode inventar o IP — por isso o IP
// nunca bloqueia sozinho e o CPF continua tendo o atraso progressivo (que não depende do IP).
export function clientIp(request) {
  return request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
}

// Limite de tentativas: conta SÓ as falhas (logins certos não gastam o limite).
// - CPF + IP: 8 falhas em 15 min bloqueiam só aquela combinação (um atacante não trava o CPF de todo mundo)
// - CPF em qualquer lugar: não bloqueia; depois de 10 falhas cada tentativa espera um pouco mais (ataque distribuído)
// - IP: não bloqueia (no leilão todos usam o mesmo Wi-Fi); depois de 30 falhas a resposta também atrasa
// Tentativa recusada pelo limite NÃO é registrada: insistir não estende o bloqueio.
const MAX_PER_IP_CPF = 8;
const SLOWDOWN = {
  cpf: { after: 10, stepMs: 300 },
  ip: { after: 30, stepMs: 100 },
};
const MAX_DELAY_MS = 4000;
const keysFor = (ip, cpf) => ({ ipcpf: `ipcpf:${ip}:${cpf}`, cpf: `cpf:${cpf}`, ip: `ip:${ip}` });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// atraso que cresce com as falhas acima do limite suave, com teto de alguns segundos
function slowdownMs(count, { after, stepMs }) {
  return count > after ? Math.min(MAX_DELAY_MS, (count - after) * stepMs) : 0;
}

// Reserva a tentativa ANTES de conferir a senha (requisições em paralelo também contam:
// cada uma grava a reserva e depois conta, então ninguém passa do limite disparando várias juntas).
// Devolve { ok, rid }: ok=false se o CPF+IP passou do limite (a reserva é apagada, nada fica registrado).
// No login certo, a reserva é apagada (clearLoginAttempts); na falha, ela fica valendo como falha.
// Se o CPF ou o IP acumulam muitas falhas, espera um pouco antes de devolver (atraso progressivo).
export async function allowLoginAttempt(ip, cpf) {
  const { attempts } = await cols();
  const rid = randomBytes(9).toString("base64url");
  const at = new Date();
  const keys = keysFor(ip, cpf);
  await attempts.insertMany(Object.values(keys).map((key) => ({ key, at, rid })));
  const since = new Date(Date.now() - WINDOW_MS);
  const count = (key) => attempts.countDocuments({ key, at: { $gte: since } });
  const [nIpCpf, nCpf, nIp] = await Promise.all([count(keys.ipcpf), count(keys.cpf), count(keys.ip)]);
  if (nIpCpf > MAX_PER_IP_CPF) {
    await attempts.deleteMany({ rid }); // recusada: não conta como falha nem renova a janela
    return { ok: false, rid: null };
  }
  const delay = Math.max(slowdownMs(nCpf, SLOWDOWN.cpf), slowdownMs(nIp, SLOWDOWN.ip));
  if (delay) await sleep(delay);
  return { ok: true, rid };
}

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

// Encerra todas as sessões de um CPF (ex.: usuário desativado ou senha trocada).
// `exceptToken`: mantém a sessão deste cookie (quem trocou a própria senha continua logado aqui).
export async function destroyUserSessions(cpf, exceptToken) {
  const { sessions } = await cols();
  const keep = exceptToken ? (await verifySessionToken(exceptToken))?.sid : null;
  await sessions.deleteMany(keep ? { cpf, _id: { $ne: keep } } : { cpf });
}

// Renovação deslizante: se a sessão está em uso e já passou da metade da validade (pelo token),
// estende no banco e devolve um token novo (mesma sessão, validade cheia) para regravar o cookie.
async function renewIfNeeded(sessions, data) {
  if (data.exp * 1000 - Date.now() > (SESSION_MAX_AGE * 1000) / 2) return null;
  await sessions.updateOne({ _id: data.sid }, { $set: { expiresAt: new Date(Date.now() + SESSION_MAX_AGE * 1000) } });
  return createSessionToken(data.sid);
}

// Confere o token e devolve { user, renewed } (renewed = token novo quando a sessão foi renovada)
async function loadSession(token) {
  const data = await verifySessionToken(token);
  if (!data?.sid) return { user: null };
  const { sessions } = await cols();
  const s = await sessions.findOne({ _id: data.sid, expiresAt: { $gt: new Date() } });
  if (!s) return { user: null };
  const u = await findLoginUser(s.cpf);
  if (!u) return { user: null };
  const user = { id: u.id, cpf: u.cpf, name: u.name, role: u.role, system: Boolean(u.system) };
  return { user, renewed: await renewIfNeeded(sessions, data) };
}

// Usuário da sessão = assinatura ok + sessão existe e não venceu + usuário ainda ativo.
// A função (TI, Administrativo, Curral) é lida do cadastro a cada requisição: mudanças valem na hora.
// Aqui (páginas do servidor) a renovação vale só no banco: página não pode gravar cookie.
// O cookie é regravado na próxima chamada de API (o painel chama a API o tempo todo).
export async function getSessionUser(token) {
  return (await loadSession(token)).user;
}

export async function isValidSessionToken(token) {
  return Boolean(await getSessionUser(token));
}

// Nas rotas da API: além de renovar no banco, regrava o cookie com o token novo
// (o cookies() do Next junta o Set-Cookie à resposta que a rota devolver).
export async function getRequestUser(request) {
  const { user, renewed } = await loadSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (renewed) {
    try {
      (await cookies()).set(SESSION_COOKIE, renewed, SESSION_COOKIE_OPTIONS);
    } catch (e) {
      console.error("Não foi possível renovar o cookie da sessão:", e.message);
    }
  }
  return user;
}
