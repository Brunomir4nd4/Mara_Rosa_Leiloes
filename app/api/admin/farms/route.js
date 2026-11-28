import { addFarm, listFarms } from "../../../../lib/db";
import { isValidCpf, formatCpf } from "../../../../lib/cpf";
import { isValidCnpj, maskCnpj } from "../../../../lib/cnpj";
import { isValidPhone, maskPhone } from "../../../../lib/phone";
import { fail, json, readJson, requireAdmin, serverError } from "../../../../lib/api";
import { getUser } from "../../../../lib/users";

export const dynamic = "force-dynamic";

const MAX_NAME = 120;
const FIELDS = ["cpf", "ownerName", "phone", "farmName", "tradeName", "cnpj"];

export async function GET(request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    return json(await listFarms());
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const b = await readJson(request);
  if (!b || typeof b !== "object" || Array.isArray(b)) return fail("Dados inválidos.", 400);
  // todos os campos precisam ser texto (um objeto não pode virar "[object Object]")
  if (FIELDS.some((k) => b[k] != null && typeof b[k] !== "string")) return fail("Dados inválidos: os campos devem ser texto.", 400);

  const raw = Object.fromEntries(FIELDS.map((k) => [k, (b[k] ?? "").trim()]));

  // Valida o valor como chegou, ANTES da máscara (a máscara corta caracteres a mais)
  if (!/^[\d.\-\s]*$/.test(raw.cpf) || !isValidCpf(raw.cpf)) return fail("CPF do titular inválido.", 400);
  if (!raw.ownerName || !raw.farmName) return fail("Preencha o nome do titular e o nome da fazenda.", 400);
  if (!/^[\d()\-\s+]*$/.test(raw.phone) || !isValidPhone(raw.phone)) {
    return fail("Telefone inválido. Use DDD + número, ex.: (62) 99999-9999.", 400);
  }
  if (raw.cnpj && (!/^[\dA-Za-z.\-/\s]*$/.test(raw.cnpj) || !isValidCnpj(raw.cnpj))) return fail("CNPJ inválido.", 400);
  if ([raw.ownerName, raw.farmName, raw.tradeName].some((v) => v.length > MAX_NAME)) {
    return fail(`Os nomes podem ter no máximo ${MAX_NAME} caracteres.`, 400);
  }

  const data = {
    cpf: formatCpf(raw.cpf),
    ownerName: raw.ownerName,
    phone: maskPhone(raw.phone),
    farmName: raw.farmName,
    tradeName: raw.tradeName,
    cnpj: raw.cnpj ? maskCnpj(raw.cnpj) : "",
    criadorId: null,
    criadorName: null,
  };
  // Criador (usuário do vendedor) dono desta fazenda — os refugos dela já saem vinculados a ele
  if (b.criadorId) {
    const u = typeof b.criadorId === "string" ? await getUser(b.criadorId).catch(() => null) : null;
    if (!u || u.role !== "CRIADOR" || !u.active) return fail("Criador não encontrado ou inativo.", 400);
    data.criadorId = u._id.toString();
    data.criadorName = u.name;
  }

  try {
    return json(await addFarm(data), 201);
  } catch (e) {
    if (e.status) return fail(e.message, e.status);
    return serverError(e);
  }
}
