import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "./lib/session";

// Protege as páginas do painel. As rotas /api/admin checam a sessão por conta própria
// (o middleware não roda nelas para não limitar o tamanho do upload de vídeo).
export async function middleware(request) {
  const { pathname, search } = request.nextUrl;
  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname.startsWith("/painel") && !session) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  if (pathname === "/login" && session) {
    return NextResponse.redirect(new URL("/painel", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/painel/:path*", "/login"] };
