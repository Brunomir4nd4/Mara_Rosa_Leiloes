import { addEntry, listEntries } from "../../../../lib/db";
import { BREEDS, LIMITS, QUALITIES, SEX_TYPES } from "../../../../lib/catalog";
import { fail, json, readJson, requireAdmin } from "../../../../lib/api";

export const dynamic = "force-dynamic";

// Registros do desembarque (gado que chegou de cada fazenda)
export async function GET(request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  return json(listEntries());
}

const intIn = (v, max) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n <= max ? n : null;
};

export async function POST(request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const b = await readJson(request);
  const data = {
    farm: String(b?.farm ?? "").trim(),
    quantity: intIn(b?.quantity, LIMITS.quantity),
    sexType: b?.sexType,
    ageMonths: intIn(b?.ageMonths, LIMITS.ageMonths),
    breed: b?.breed,
    quality: b?.quality,
  };
  if (!data.farm) return fail("Selecione a fazenda.", 400);
  if (!data.quantity) return fail(`Quantidade deve ser um número inteiro entre 1 e ${LIMITS.quantity}.`, 400);
  if (!data.ageMonths) return fail(`Idade deve ser um número inteiro entre 1 e ${LIMITS.ageMonths} meses.`, 400);
  if (!SEX_TYPES.includes(data.sexType)) return fail("Sexo / tipo inválido.", 400);
  if (!BREEDS.includes(data.breed)) return fail("Raça inválida.", 400);
  if (!QUALITIES.includes(data.quality)) return fail("Qualidade inválida.", 400);

  try {
    return json(await addEntry(data), 201);
  } catch (e) {
    if (e.status) return fail(e.message, e.status);
    throw e;
  }
}
