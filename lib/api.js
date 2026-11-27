import { NextResponse } from "next/server";
import { isAdminRequest } from "./auth";

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
// Devolve uma resposta 401 se a requisição não tiver sessão válida; senão null.
export async function requireAdmin(request) {
  try {
    return (await isAdminRequest(request)) ? null : fail("Sessão expirada. Entre novamente.", 401);
  } catch (e) {
    return serverError(e);
  }
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
