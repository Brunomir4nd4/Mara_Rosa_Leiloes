import { NextResponse } from "next/server";
import { getDb } from "../../../lib/mongodb";
import { withId, text, badRequest, serverError } from "../../../lib/api";
import { maskCpf, isValidCpf } from "../../../lib/cpf";
import { maskCnpj, isValidCnpj } from "../../../lib/cnpj";

const MAX_NAME_LENGTH = 120;

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
  // `?? {}` cobre o body "null", que é JSON válido mas não é objeto
  const body = (await request.json().catch(() => null)) ?? {};
  const cpf = text(body.cpf);
  const cnpj = text(body.cnpj);
  const ownerName = text(body.ownerName);
  const farmName = text(body.farmName);
  const tradeName = text(body.tradeName);

  // Valida o valor recebido antes de aplicar a máscara (a máscara corta caracteres a mais)
  if (!isValidCpf(cpf)) return badRequest("CPF inválido. Confira os 11 números e tente de novo.");
  if (!ownerName) return badRequest("Informe o nome do titular.");
  if (!farmName) return badRequest("Informe o nome da fazenda.");
  if (cnpj && !isValidCnpj(cnpj)) return badRequest("CNPJ inválido. Confira os 14 caracteres e tente de novo.");
  if ([ownerName, farmName, tradeName].some((v) => v.length > MAX_NAME_LENGTH)) {
    return badRequest(`Os nomes podem ter no máximo ${MAX_NAME_LENGTH} caracteres.`);
  }

  try {
    const db = await getDb();
    const doc = { cpf: maskCpf(cpf), ownerName, farmName, tradeName, cnpj: maskCnpj(cnpj), createdAt: new Date() };
    const { insertedId } = await db.collection("farms").insertOne(doc);
    return NextResponse.json(withId({ _id: insertedId, ...doc }), { status: 201 });
  } catch (err) {
    return serverError(err);
  }
}
