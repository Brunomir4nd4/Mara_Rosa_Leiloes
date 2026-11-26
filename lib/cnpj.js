// Aceita o CNPJ numérico e o alfanumérico (Receita Federal, a partir de jul/2026):
// as 12 primeiras posições podem ter letras e números; os 2 dígitos verificadores são sempre números.
function clean(value) {
  const chars = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 14);
  return chars.slice(0, 12) + chars.slice(12).replace(/\D/g, "");
}

export function maskCnpj(value) {
  const s = clean(value);
  let out = s.slice(0, 2);
  if (s.length > 2) out += "." + s.slice(2, 5);
  if (s.length > 5) out += "." + s.slice(5, 8);
  if (s.length > 8) out += "/" + s.slice(8, 12);
  if (s.length > 12) out += "-" + s.slice(12, 14);
  return out;
}

function checkDigit(base) {
  // Valor de cada caractere = código ASCII - 48 (números valem 0–9, letras A=17, B=18...)
  let sum = 0;
  let weight = 2;
  for (let i = base.length - 1; i >= 0; i--) {
    sum += (base.charCodeAt(i) - 48) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

export function isValidCnpj(value) {
  const s = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!/^[A-Z0-9]{12}\d{2}$/.test(s) || /^(.)\1+$/.test(s)) return false;
  const d1 = checkDigit(s.slice(0, 12));
  const d2 = checkDigit(s.slice(0, 12) + d1);
  return s.slice(12) === `${d1}${d2}`;
}
