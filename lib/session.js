// Sessão do painel: token assinado com HMAC-SHA256 guardado em cookie httpOnly.
// Usa só Web Crypto, então funciona tanto no middleware (edge) quanto nas rotas (Node).
export const SESSION_COOKIE = "mr_session";
export const SESSION_MAX_AGE = 60 * 60 * 8; // 8 horas

const enc = new TextEncoder();

function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(str) {
  const s = atob(str.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

async function hmacKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET ausente ou curto (mínimo 32 caracteres). Configure no .env.local.");
  }
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

// O token não carrega o CPF (LGPD): só o papel e a validade.
export async function createSessionToken() {
  const payload = b64url(enc.encode(JSON.stringify({ role: "admin", exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE })));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(), enc.encode(payload)));
  return `${payload}.${b64url(sig)}`;
}

export async function verifySessionToken(token) {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(), fromB64url(sig), enc.encode(payload));
    if (!ok) return null;
    const data = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
    if (!data.exp || data.exp < Date.now() / 1000) return null;
    return data;
  } catch {
    return null;
  }
}

export async function isAdminRequest(request) {
  return Boolean(await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value));
}
