// Validação dos dados de grupo
import { listContacts } from "../../../../lib/users";

export const cleanName = (v) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, 60) : "");

// Mapa id -> nome dos usuários ativos (valida participantes e escreve as mensagens de sistema)
export async function activeNames() {
  return new Map((await listContacts()).map((c) => [c.id, c.name]));
}

export const idList = (v, names) => (Array.isArray(v) ? [...new Set(v.filter((id) => typeof id === "string" && names.has(id)))] : []);
