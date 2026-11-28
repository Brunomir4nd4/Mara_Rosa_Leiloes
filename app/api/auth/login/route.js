import { NextResponse } from "next/server";
import { isValidCpf } from "../../../../lib/cpf";
import { SESSION_COOKIE, SESSION_MAX_AGE } from "../../../../lib/session";
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
    // limite por CPF e por IP, guardado no banco (vale entre servidores e reinícios)
    if (!(await allowLoginAttempt(clientIp(request), cpf))) {
      return fail("Muitas tentativas. Aguarde 15 minutos e tente de novo.", 429);
    }
    if (password.length > 200) return fail("CPF ou senha incorretos.", 401);

    // Mesma mensagem e mesmo tempo de resposta para CPF sem conta e senha errada:
    // assim não dá para descobrir quais CPFs têm acesso.
    // usuário desativado conta como "sem conta"
    const user = await findLoginUser(cpf);
    const stored = user?.passwordHash;
    const ok = await verifyPassword(password, stored ?? DUMMY_HASH);
    if (!stored || !ok) return fail("CPF ou senha incorretos.", 401);

    const token = await createSession(cpf);
    await clearLoginAttempts(cpf);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    return res;
  } catch (e) {
    if (/AUTH_SECRET/.test(e.message)) {
      console.error(e);
      return fail("Login indisponível: servidor sem configuração de sessão.", 500);
    }
    return serverError(e);
  }
}
