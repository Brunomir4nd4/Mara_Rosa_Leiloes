import { fail, json, readJson, requireUser, serverError, text } from "../../../../lib/api";
import { OFFICE, canManageRole } from "../../../../lib/roles";
import { createUser, listUsers } from "../../../../lib/users";
import { cpfError, nameError, passwordError, roleError } from "./validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const { denied } = await requireUser(request, OFFICE);
  if (denied) return denied;
  try {
    return json(await listUsers());
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(request) {
  const { user, denied } = await requireUser(request, OFFICE);
  if (denied) return denied;

  const b = await readJson(request);
  const name = text(b?.name).replace(/\s+/g, " ");
  const cpf = text(b?.cpf).replace(/\D/g, "");
  const role = text(b?.role);
  const password = typeof b?.password === "string" ? b.password : "";

  const fields = {};
  const set = (k, msg) => msg && (fields[k] = msg);
  set("name", nameError(name));
  set("cpf", cpfError(cpf));
  set("role", roleError(role));
  set("password", passwordError(password));
  if (Object.keys(fields).length) return json({ error: Object.values(fields)[0], fields }, 400);
  if (!canManageRole(user.role, role)) return fail("Só a TI pode criar usuários de TI.", 403);

  try {
    return json(await createUser({ name, cpf, role, password }), 201);
  } catch (e) {
    if (e.status) return json({ error: e.message, fields: e.status === 409 ? { cpf: e.message } : {} }, e.status);
    return serverError(e);
  }
}
