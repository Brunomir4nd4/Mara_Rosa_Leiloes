import { addEntry, listEntries } from "../../../../lib/db";
import { BREEDS, ENTRY_KINDS, LIMITS, QUALITIES, REFUGO_REASONS, SEX_TYPES } from "../../../../lib/catalog";
import { fail, json, readJson, requireAdmin, serverError } from "../../../../lib/api";

export const dynamic = "force-dynamic";

// Registros do desembarque (gado que chegou de cada fazenda)
export async function GET(request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    return json(await listEntries());
  } catch (e) {
    return serverError(e);
  }
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
    kind: ENTRY_KINDS.includes(b?.kind) ? b.kind : "NORMAL",
    reason: null,
    notes: "",
    media: [],
  };
  // Refugo: motivo obrigatório, observação opcional (anexos são enviados depois, um por vez)
  if (data.kind === "REFUGO") {
    if (!REFUGO_REASONS.includes(b?.reason)) return fail("Informe o motivo do refugo.", 400);
    data.reason = b.reason;
    data.notes = String(b?.notes ?? "").trim();
    if (data.reason === "OUTRO" && data.notes.length < 3) return fail("Descreva o problema em Observações.", 400);
    if (data.notes.length > 500) return fail("Observações com no máximo 500 caracteres.", 400);
  }
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
    return serverError(e);
  }
}
