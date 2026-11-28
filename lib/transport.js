// Transporte (caminhão): motorista, modelo e placa. Usado no desembarque e na retirada.

// Placa: padrão antigo (ABC-1234) ou Mercosul (ABC1D23). Guarda em maiúsculas.
export function maskPlate(value) {
  const s = String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
  // padrão antigo com 4 números no fim ganha o hífen (ABC-1234); Mercosul fica sem hífen
  return /^[A-Z]{3}\d{4}$/.test(s) ? `${s.slice(0, 3)}-${s.slice(3)}` : s;
}

export function isValidPlate(value) {
  const s = String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(s);
}

export const TRANSPORT_EMPTY = { driver: "", truckModel: "", plate: "" };

// Devolve { campo: mensagem } — vazio quando está tudo certo
export function transportErrors(t) {
  const e = {};
  const driver = String(t.driver ?? "").trim();
  const model = String(t.truckModel ?? "").trim();
  if (driver.length < 3) e.driver = "Informe o nome do motorista.";
  else if (driver.length > 80) e.driver = "Nome muito longo (máx. 80 caracteres).";
  if (model.length < 2) e.truckModel = "Informe o modelo do caminhão.";
  else if (model.length > 60) e.truckModel = "Modelo muito longo (máx. 60 caracteres).";
  if (!t.plate) e.plate = "Informe a placa do caminhão.";
  else if (!isValidPlate(t.plate)) e.plate = "Placa inválida. Ex.: ABC-1234 ou ABC1D23.";
  return e;
}

export function normalizeTransport(t) {
  return { driver: String(t.driver).trim(), truckModel: String(t.truckModel).trim(), plate: maskPlate(t.plate) };
}
