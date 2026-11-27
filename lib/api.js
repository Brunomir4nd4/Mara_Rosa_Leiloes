import { NextResponse } from "next/server";
import { isAdminRequest } from "./session";

export const json = (data, status = 200) => NextResponse.json(data, { status });
export const fail = (error, status) => NextResponse.json({ error }, { status });

// Devolve uma resposta 401 se a requisição não tiver sessão válida; senão null.
export async function requireAdmin(request) {
  return (await isAdminRequest(request)) ? null : fail("Sessão expirada. Entre novamente.", 401);
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
