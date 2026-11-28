import { addPickup, listPickups } from "../../../../lib/db";
import { arrivalError } from "../../../../lib/datetime";
import { normalizeTransport, transportErrors } from "../../../../lib/transport";
import { fail, json, readJson, requireAdmin, serverError } from "../../../../lib/api";

export const dynamic = "force-dynamic";

// Retiradas do gado arrematado (comprador busca no recinto)
export async function GET(request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    return json(await listPickups());
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const b = await readJson(request);
  if (!b || typeof b !== "object" || Array.isArray(b)) return fail("Dados inválidos.", 400);
  if (["lotId", "pickedAt", "driver", "truckModel", "plate", "notes"].some((k) => b[k] != null && typeof b[k] !== "string")) {
    return fail("Dados inválidos: os campos devem ser texto.", 400);
  }
  const quantity = Number(b.quantity);
  if (!b.lotId) return fail("Escolha o lote.", 400);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 9999) return fail("Quantidade deve ser um número inteiro maior que zero.", 400);

  const picked = b.pickedAt ? new Date(b.pickedAt) : new Date();
  const dateError = arrivalError(picked, new Date(), "da retirada");
  if (dateError) return fail(dateError, 400);

  const tErr = Object.values(transportErrors(b))[0];
  if (tErr) return fail(tErr, 400);
  const notes = (b.notes ?? "").trim();
  if (notes.length > 300) return fail("Observações com no máximo 300 caracteres.", 400);

  try {
    return json(await addPickup({ lotId: b.lotId, quantity, pickedAt: picked.toISOString(), ...normalizeTransport(b), notes }), 201);
  } catch (e) {
    if (e.status) return fail(e.message, e.status);
    return serverError(e);
  }
}