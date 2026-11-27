import { NextResponse } from "next/server";
import { isValidCpf } from "../../../../lib/cpf";
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "../../../../lib/session";
import { fail, readJson } from "../../../../lib/api";
import { DUMMY_HASH, loadAccounts, verifyPassword } from "../../../../lib/password";

export const runtime = "nodejs";

// Limite simples de tentativas por IP (em memória; zera ao reiniciar o servidor)
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attempts = new Map();

function tooManyAttempts(ip) {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || entry.reset < now) {
    attempts.set(ip, { count: 1, reset: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

export async function POST(request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (tooManyAttempts(ip)) return fail("Muitas tentativas. Aguarde 15 minutos e tente de novo.", 429);

  const body = await readJson(request);
  const cpf = String(body?.cpf ?? "").replace(/\D/g, "");
  const password = String(body?.password ?? "");
  if (!isValidCpf(cpf)) return fail("CPF inválido. Confira os 11 números e tente de novo.", 400);
  if (!password) return fail("Digite sua senha.", 400);
  if (password.length > 200) return fail("CPF ou senha incorretos.", 401);

  // Mesma mensagem e mesmo tempo de resposta para CPF sem conta e senha errada:
  // assim não dá para descobrir quais CPFs têm acesso.
  const stored = loadAccounts().get(cpf);
  const ok = await verifyPassword(password, stored ?? DUMMY_HASH);
  if (!stored || !ok) return fail("CPF ou senha incorretos.", 401);

  let token;
  try {
    token = await createSessionToken();
  } catch (e) {
    console.error(e);
    return fail("Login indisponível: servidor sem configuração de sessão.", 500);
  }

  attempts.delete(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
