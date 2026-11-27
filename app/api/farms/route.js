import { NextResponse } from "next/server";
import { getDb } from "../../../lib/mongodb";
import { withId, text, badRequest, serverError } from "../../../lib/api";
import { maskCpf, isValidCpf } from "../../../lib/cpf";
import { maskCnpj, isValidCnpj } from "../../../lib/cnpj";

// GET /api/farms: lista as fazendas na ordem de cadastro
export async function GET() {
  try {
    const db = await getDb();
    const farms = await db.collection("farms").find().sort({ createdAt: 1 }).toArray();
    return NextResponse.json(farms.map(withId));
  } catch (err) {
    return serverError(err);
  }
}

// POST /api/farms: cadastra uma fazenda (mesmas validações do formulário)
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const farm = {
    cpf: maskCpf(text(body.cpf)),
    ownerName: text(body.ownerName),
    farmName: text(body.farmName),
    tradeName: text(body.tradeName),
    cnpj: maskCnpj(text(body.cnpj)),
  };

  if (!isValidCpf(farm.cpf)) return badRequest("CPF inválido. Confira os 11 números e tente de novo.");
  if (!farm.ownerName) return badRequest("Informe o nome do titular.");
  if (!farm.farmName) return badRequest("Informe o nome da fazenda.");
  if (farm.cnpj && !isValidCnpj(farm.cnpj)) return badRequest("CNPJ inválido. Confira os 14 caracteres e tente de novo.");

  try {
    const db = await getDb();
    const doc = { ...farm, createdAt: new Date() };
    const { insertedId } = await db.collection("farms").insertOne(doc);
    return NextResponse.json(withId({ _id: insertedId, ...doc }), { status: 201 });
  } catch (err) {
    return serverError(err);
  }
}
