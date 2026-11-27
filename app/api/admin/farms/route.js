import { addFarm, listFarms } from "../../../../lib/db";
import { isValidCpf, maskCpf } from "../../../../lib/cpf";
import { isValidCnpj, maskCnpj } from "../../../../lib/cnpj";
import { fail, json, readJson, requireAdmin, serverError } from "../../../../lib/api";

export const dynamic = "force-dynamic";

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
  const str = (v) => String(v ?? "").trim();
  const data = {
    cpf: maskCpf(str(b?.cpf)),
    ownerName: str(b?.ownerName),
    farmName: str(b?.farmName),
    tradeName: str(b?.tradeName),
    cnpj: str(b?.cnpj) ? maskCnpj(str(b.cnpj)) : "",
  };
  if (!isValidCpf(data.cpf)) return fail("CPF do titular inválido.", 400);
  if (!data.ownerName || !data.farmName) return fail("Preencha o nome do titular e o nome da fazenda.", 400);
  if (data.cnpj && !isValidCnpj(data.cnpj)) return fail("CNPJ inválido.", 400);
  if ([data.ownerName, data.farmName, data.tradeName].some((v) => v.length > 120)) {
    return fail("Os nomes podem ter no máximo 120 caracteres.", 400);
  }

  try {
    return json(await addFarm(data), 201);
  } catch (e) {
    if (e.status) return fail(e.message, e.status);
    return serverError(e);
  }
}
