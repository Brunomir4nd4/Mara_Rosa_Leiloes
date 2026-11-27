// Data e hora do desembarque (usado no formulário e na API)

const pad = (n) => String(n).padStart(2, "0");

// Date -> "AAAA-MM-DDTHH:mm" no horário local (formato do campo datetime-local)
export function toLocalInput(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// "27/11/2026 às 14:30"
export function formatDateTime(value) {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return "—";
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} às ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const TOLERANCE_MS = 5 * 60 * 1000; // relógios um pouco diferentes entre celular e servidor

// Devolve mensagem de erro ou "" (data válida, não no futuro, não antes de 2000)
export function arrivalError(value, now = new Date()) {
  if (!value) return "Informe a data e a hora do desembarque.";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Data ou hora inválida.";
  if (d.getTime() > now.getTime() + TOLERANCE_MS) return "A data não pode estar no futuro.";
  if (d.getFullYear() < 2000) return "Data muito antiga. Confira o ano.";
  return "";
}
