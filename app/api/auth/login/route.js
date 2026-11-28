import { NextResponse } from "next/server";
import { isValidCpf } from "../../../../lib/cpf";
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "../../../../lib/session";
import { fail, readJson, serverError } from "../../../../lib/api";
import { DUMMY_HASH, verifyPassword } from "../../../../lib/password";
import { findLoginUser } from "../../../../lib/users";
import { allowLoginAttempt, clearLoginAttempts, clientIp, createSession } from "../../../../lib/auth";

export const runtime = "nodejs";

export async function POST(request) {
  const body = await readJson(request);
  const cpf = typeof body?.cpf === "string" ? body.cpf.replace(/\D/g, "") : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!isValidCpf(cpf)) return fail("CPF inválido. Confira os 11 números e tente de novo.", 400);
  if (!password) return fail("Digite sua senha.", 400);

  try {
    // limite de tentativas guardado no banco (vale entre servidores e reinícios): bloqueia por CPF+IP, atrasa por CPF e por IP
    const ip = clientIp(request);
    const attempt = await allowLoginAttempt(ip, cpf);
    if (!attempt.ok) {
      return fail("Muitas tentativas. Aguarde 15 minutos e tente de novo.", 429);
    }
    if (password.length > 200) return fail("CPF ou senha incorretos.", 401); // a reserva já conta como falha

    // Mesma mensagem e mesmo tempo de resposta para CPF sem conta e senha errada:
    // assim não dá para descobrir quais CPFs têm acesso.
    // usuário desativado conta como "sem conta"
    const user = await findLoginUser(cpf);
    const stored = user?.passwordHash;
    const ok = await verifyPassword(password, stored ?? DUMMY_HASH);
    if (!stored || !ok) return fail("CPF ou senha incorretos.", 401); // a reserva já conta como falha

    const token = await createSession(cpf);
    await clearLoginAttempts(cpf, ip, attempt.rid);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
    return res;
  } catch (e) {
    if (/AUTH_SECRET/.test(e.message)) {
      console.error(e);
      return fail("Login indisponível: servidor sem configuração de sessão.", 500);
    }
    return serverError(e);
  }
}
