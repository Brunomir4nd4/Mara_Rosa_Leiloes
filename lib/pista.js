// Regras da Pista (resultado do lote no leilão). Usado no painel e na API — sem dependências de Node.
// Valores em centavos (inteiros) para não ter erro de arredondamento.

export const PISTA_STATUS = ["AGUARDANDO", "ARREMATADO", "DEFENDIDO", "NAO_ARREMATADO"];

export const STATUS_INFO = {
  AGUARDANDO: { label: "Aguardando pista", short: "Aguardando", hint: "O lote ainda não entrou na pista." },
  ARREMATADO: { label: "Arrematado", short: "Arrematado", hint: "Vendido: informe valor, comprador e prazo." },
  DEFENDIDO: { label: "Defendido", short: "Defendido", hint: "O dono não aceitou a proposta e manteve o lote." },
  NAO_ARREMATADO: { label: "Não arrematado", short: "Não arrematado", hint: "Saiu da pista sem venda (sem lance suficiente)." },
};

// Prazos de pagamento mais usados em leilão de gado (o campo também aceita texto livre)
export const TERMS = ["À vista", "30 dias", "30/60", "30/60/90", "2+2", "2+2+2", "10 parcelas"];

export const MAX_CENTS = 100_000_000_00; // R$ 100 milhões

export const EMPTY_PISTA = { status: "AGUARDANDO", value: null, buyer: "", term: "", proposal: null, ownerAsk: null };

export function brl(cents) {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const isMoney = (v) => Number.isInteger(v) && v > 0 && v <= MAX_CENTS;

// Devolve { campo: mensagem } — vazio quando está tudo certo
export function validatePista(p) {
  const e = {};
  if (!PISTA_STATUS.includes(p.status)) e.status = "Escolha a situação do lote.";
  const money = (key, required, msg) => {
    const v = p[key];
    if (v == null || v === 0) { if (required) e[key] = msg; return; }
    if (!isMoney(v)) e[key] = "Valor inválido.";
  };

  if (p.status === "ARREMATADO") {
    money("value", true, "Informe o valor do lote arrematado.");
    if ((p.buyer ?? "").trim().length < 3) e.buyer = "Informe o nome do comprador.";
    if (!(p.term ?? "").trim()) e.term = "Informe o prazo de pagamento.";
    money("ownerAsk", false);
  } else if (p.status === "DEFENDIDO") {
    money("proposal", true, "Informe a maior proposta recebida.");
    money("ownerAsk", true, "Informe o valor que o dono queria.");
    if (!e.proposal && !e.ownerAsk && p.proposal >= p.ownerAsk) {
      e.proposal = "A proposta atingiu o valor pretendido. Se o dono aceitou, marque como Arrematado.";
    }
  } else if (p.status === "NAO_ARREMATADO") {
    money("proposal", false);
    money("ownerAsk", false);
  } else {
    money("ownerAsk", false);
  }
  if ((p.buyer ?? "").length > 120) e.buyer = "Nome muito longo (máx. 120 caracteres).";
  if ((p.term ?? "").length > 60) e.term = "Prazo muito longo (máx. 60 caracteres).";
  return e;
}

// Guarda só os campos que fazem sentido para a situação escolhida
export function normalizePista(p) {
  const cents = (v) => (Number.isInteger(v) && v > 0 ? v : null);
  const base = { status: p.status, value: null, buyer: "", term: "", proposal: null, ownerAsk: cents(p.ownerAsk) };
  if (p.status === "ARREMATADO") return { ...base, value: cents(p.value), buyer: p.buyer.trim(), term: p.term.trim() };
  if (p.status === "DEFENDIDO" || p.status === "NAO_ARREMATADO") return { ...base, proposal: cents(p.proposal) };
  return base;
}
