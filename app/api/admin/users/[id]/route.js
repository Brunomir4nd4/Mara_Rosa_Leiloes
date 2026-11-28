import { fail, json, readJson, requireUser, serverError, text } from "../../../../../lib/api";
import { destroyUserSessions } from "../../../../../lib/auth";
import { OFFICE, canManageRole } from "../../../../../lib/roles";
import { countActiveTI, getUser, updateUser } from "../../../../../lib/users";
import { nameError, passwordError, roleError } from "../validate";

export const runtime = "nodejs";

// Altera nome, função, situação (ativo/inativo) ou senha de um usuário
export async function PATCH(request, { params }) {
  const { user: actor, denied } = await requireUser(request, OFFICE);
  if (denied) return denied;
  const { id } = await params;
  if (String(id).startsWith("env:")) return fail("Contas do sistema são definidas no servidor (.env) e não podem ser alteradas aqui.", 400);

  const b = await readJson(request);
  if (!b || typeof b !== "object") return fail("Dados inválidos.", 400);
  const changes = {};
  if (b.name !== undefined) {
    changes.name = text(b.name).replace(/\s+/g, " ");
    const err = nameError(changes.name);
    if (err) return json({ error: err, fields: { name: err } }, 400);
  }
  if (b.role !== undefined) {
    changes.role = text(b.role);
    const err = roleError(changes.role);
    if (err) return json({ error: err, fields: { role: err } }, 400);
  }
  if (b.active !== undefined) {
    if (typeof b.active !== "boolean") return fail("Situação inválida.", 400);
    changes.active = b.active;
  }
  if (b.password !== undefined && b.password !== "") {
    if (typeof b.password !== "string") return fail("Senha inválida.", 400);
    const err = passwordError(b.password);
    if (err) return json({ error: err, fields: { password: err } }, 400);
    changes.password = b.password;
  }
  if (!Object.keys(changes).length) return fail("Nada para alterar.", 400);

  try {
    const target = await getUser(id);
    if (!target) return fail("Usuário não encontrado.", 404);
    const self = actor.id === target._id.toString();

    // Administrativo não mexe em TI nem promove alguém a TI
    if (!canManageRole(actor.role, target.role) || (changes.role && !canManageRole(actor.role, changes.role))) {
      return fail("Só a TI pode alterar usuários de TI.", 403);
    }
    if (self && changes.active === false) return fail("Você não pode desativar o próprio usuário.", 400);
    if (self && changes.role && changes.role !== target.role) return fail("Você não pode mudar a própria função.", 400);

    // nunca deixar o sistema sem nenhum TI ativo
    const losesTI = target.role === "TI" && target.active && (changes.active === false || (changes.role && changes.role !== "TI"));
    if (losesTI && (await countActiveTI(id)) < 1) return fail("É preciso manter pelo menos um usuário de TI ativo.", 409);

    const { user } = await updateUser(id, changes);
    // desativado ou senha trocada por outra pessoa: derruba as sessões abertas dele
    if (changes.active === false || (changes.password && !self)) await destroyUserSessions(target.cpf);
    return json(user);
  } catch (e) {
    if (e.status) return fail(e.message, e.status);
    return serverError(e);
  }
}
