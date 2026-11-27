// Telefone brasileiro: (DD) 9XXXX-XXXX (celular) ou (DD) XXXX-XXXX (fixo)
export function maskPhone(value) {
  const d = String(value ?? "").replace(/\D/g, "").slice(0, 11);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function isValidPhone(value) {
  const d = String(value ?? "").replace(/\D/g, "");
  if (!/^\d{10,11}$/.test(d)) return false;
  // DDD de 11 a 99, sem zero (não existem DDDs como 20, 30, 01…)
  if (d[0] === "0" || d[1] === "0") return false;
  // celular: 11 dígitos começando com 9 depois do DDD; fixo: 10 dígitos começando de 2 a 5
  if (d.length === 11) return d[2] === "9";
  return /[2-5]/.test(d[2]);
}
