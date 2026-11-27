import { NextResponse } from "next/server";

// Proteção provisória do painel e da API com usuário e senha (HTTP Basic Auth).
// TODO: trocar pelo login com sessão (branch feat/login).
export function middleware(request) {
  const user = process.env.PAINEL_USER;
  const password = process.env.PAINEL_PASSWORD;

  // Sem usuário e senha configurados, bloqueia tudo em vez de deixar aberto
  if (!user || !password) {
    return plainText("Acesso bloqueado: defina PAINEL_USER e PAINEL_PASSWORD nas variáveis de ambiente.", 503);
  }

  const [scheme, encoded] = (request.headers.get("authorization") || "").split(" ");
  if (scheme === "Basic" && encoded) {
    try {
      const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
      const [givenUser, ...rest] = new TextDecoder().decode(bytes).split(":");
      if (givenUser === user && rest.join(":") === password) return NextResponse.next();
    } catch {
      // Cabeçalho mal formado: cai no 401 abaixo
    }
  }

  return plainText("Autenticação necessária.", 401, {
    "WWW-Authenticate": 'Basic realm="Painel Mara Rosa", charset="UTF-8"',
  });
}

function plainText(message, status, headers = {}) {
  return new NextResponse(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8", ...headers } });
}

export const config = {
  matcher: ["/painel/:path*", "/api/farms/:path*"],
};
