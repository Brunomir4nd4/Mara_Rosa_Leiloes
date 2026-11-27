import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "../../../../lib/session";
import { destroySession } from "../../../../lib/auth";

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

// GET: usado quando uma página descobre que a sessão foi encerrada — limpa o cookie e manda para o login
export async function GET(request) {
  try { await destroySession(request.cookies.get(SESSION_COOKIE)?.value); } catch {}
  const next = new URL(request.url).searchParams.get("next") || "";
  const url = new URL("/login", request.url);
  if (next.startsWith("/painel")) url.searchParams.set("next", next);
  const res = NextResponse.redirect(url);
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}
