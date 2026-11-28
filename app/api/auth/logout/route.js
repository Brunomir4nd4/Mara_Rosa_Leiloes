import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "../../../../lib/session";
import { destroySession, isValidSessionToken } from "../../../../lib/auth";

export const runtime = "nodejs";

// Sair: apaga a sessão no banco (o cookie deixa de valer mesmo se tiver sido copiado) e limpa o cookie
export async function POST(request) {
  try {
    await destroySession(request.cookies.get(SESSION_COOKIE)?.value);
  } catch (e) {
    console.error("Falha ao encerrar a sessão:", e.message);
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}

// GET: usado quando uma página descobre que a sessão já não vale — só limpa o cookie e manda para o login.
// Não apaga sessão no banco (sair de verdade é só pelo POST): um link externo não derruba quem está logado.
export async function GET(request) {
  const next = new URL(request.url).searchParams.get("next") || "";
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  let valid = false;
  try { valid = Boolean(token) && (await isValidSessionToken(token)); } catch {}
  if (valid) return NextResponse.redirect(new URL(next.startsWith("/painel") ? next : "/painel", request.url));
  const url = new URL("/login", request.url);
  if (next.startsWith("/painel")) url.searchParams.set("next", next);
  const res = NextResponse.redirect(url);
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}
