import { NextResponse } from "next/server";

// Converte o _id do MongoDB em `id` (texto) para o front-end
export function withId({ _id, ...rest }) {
  return { id: _id.toString(), ...rest };
}

export function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function badRequest(message) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function serverError(err) {
  console.error("Erro ao acessar o MongoDB:", err.message);
  return NextResponse.json({ error: "Não foi possível acessar o banco de dados." }, { status: 500 });
}
