// Validação compartilhada do cadastro de usuários
import { isValidCpf } from "../../../../lib/cpf";
import { ROLES } from "../../../../lib/roles";

export function nameError(name) {
  if (name.length < 3) return "Digite o nome completo (mínimo de 3 letras).";
  if (name.length > 80) return "Nome muito longo (máximo de 80 caracteres).";
  return null;
}

export function passwordError(password) {
  if (password.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
  if (password.length > 200) return "Senha muito longa.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Use letras e números na senha.";
  return null;
}

export function roleError(role) {
  return ROLES.includes(role) ? null : "Escolha a função: TI, Administrativo ou Curral.";
}

export function cpfError(cpf) {
  return isValidCpf(cpf) ? null : "CPF inválido. Confira os 11 números.";
}
