import { NextResponse } from "next/server";
import { getRequestUser } from "./auth";
import { EVERYONE, STAFF } from "./roles";

// ---------- Respostas ----------
export const json = (data, status = 200) => NextResponse.json(data, { status });
export const fail = (error, status) => NextResponse.json({ error }, { status });

export function badRequest(message) {
  return fail(message, 400);
}

export function serverError(err) {
  console.error("Erro ao acessar o MongoDB:", err.message);
  return fail("Não foi possível acessar o banco de dados.", 500);
}

// ---------- Sessão do painel ----------
// Confere sessão e função. Devolve { user } ou { denied } (401 sem sessão, 403 sem permissão).
export async function requireUser(request, roles = EVERYONE) {
  try {
    const user = await getRequestUser(request);
    if (!user) return { denied: fail("Sessão expirada. Entre novamente.", 401) };
    if (!roles.includes(user.role)) return { denied: fail("Seu usuário não tem permissão para esta ação.", 403) };
    return { user };
  } catch (e) {
    return { denied: serverError(e) };
  }
}

// Atalho para as rotas do painel: por padrão só a equipe (TI, Administrativo, Curral).
// Devolve a resposta de erro (ou null se pode seguir).
export async function requireAdmin(request, roles = STAFF) {
  return (await requireUser(request, roles)).denied ?? null;
}

// ---------- Entrada ----------
export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

// Converte o _id do MongoDB em `id` (texto) para o front-end
export function withId({ _id, ...rest }) {
  return { id: _id.toString(), ...rest };
}
