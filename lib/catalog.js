// Constantes e helpers compartilhados entre painel, API e catálogo (sem dependências de Node).
export const SEX_TYPES = ["MACHO", "FEMEA / SOLTEIRA", "FEMEA / PARIDA"];
export const BREEDS = ["NELORE", "NELORADA", "CRUZADO"];
// Escala de qualidade do lote (da melhor para a mais simples). Ajuste aqui se o leilão usar outra.
export const QUALITIES = ["EXTRA", "BOM", "REGULAR"];

// Tipo do gado no desembarque. Refugo = animal com algum problema (doença, lesão etc.)
export const ENTRY_KINDS = ["NORMAL", "REFUGO"];
export const REFUGO_REASONS = ["DOENCA", "LESAO", "CASCO", "MAGREZA", "VISAO", "APARELHO_REPRODUTOR", "OUTRO"];
export const isRefugo = (entry) => entry?.kind === "REFUGO";
// Nome curto do motivo (para etiquetas pequenas, como a placa do lote)
export const REFUGO_SHORT = { DOENCA: "Doença", LESAO: "Lesão", CASCO: "Casco", MAGREZA: "Magreza", VISAO: "Visão", APARELHO_REPRODUTOR: "Reprodutivo", OUTRO: "Outro" };

// Categoria comercial, como aparece nos catálogos de leilão.
// Calculada a partir do Sexo/Tipo + Idade registrados no desembarque (não é digitada).
// Faixas de idade: até 12 meses = bezerro(a); 13 a 24 = garrote / novilha; acima de 24 = boi / vaca.
export const AGE_LIMITS = { calf: 12, young: 24 };
export const CATEGORIES = ["BEZERROS", "GARROTES", "BOIS", "BEZERRAS", "NOVILHAS", "VACAS SOLTEIRAS", "VACAS PARIDAS"];

export function categoryOf(sexType, ageMonths) {
  const age = Number(ageMonths);
  if (sexType === "FEMEA / PARIDA") return "VACAS PARIDAS";
  const female = isFemale(sexType);
  if (age <= AGE_LIMITS.calf) return female ? "BEZERRAS" : "BEZERROS";
  if (age <= AGE_LIMITS.young) return female ? "NOVILHAS" : "GARROTES";
  return female ? "VACAS SOLTEIRAS" : "BOIS";
}

const LABELS = {
  MACHO: "Macho",
  "FEMEA / SOLTEIRA": "Fêmea solteira",
  "FEMEA / PARIDA": "Fêmea parida",
  NELORE: "Nelore",
  NELORADA: "Nelorada",
  CRUZADO: "Cruzado",
  EXTRA: "Extra",
  BOM: "Bom",
  REGULAR: "Regular",
  NORMAL: "Gado normal",
  REFUGO: "Refugo",
  DOENCA: "Doença",
  LESAO: "Lesão / machucado",
  CASCO: "Problema de casco",
  MAGREZA: "Magreza / baixo peso",
  VISAO: "Problema de visão",
  APARELHO_REPRODUTOR: "Problema reprodutivo",
  OUTRO: "Outro problema",
  BEZERROS: "Bezerros",
  GARROTES: "Garrotes",
  BOIS: "Bois",
  BEZERRAS: "Bezerras",
  NOVILHAS: "Novilhas",
  "VACAS SOLTEIRAS": "Vacas solteiras",
  "VACAS PARIDAS": "Vacas paridas",
};

// Singular para lotes de 1 cabeça ("1 Garrote")
const SINGULAR = {
  BEZERROS: "Bezerro", GARROTES: "Garrote", BOIS: "Boi", BEZERRAS: "Bezerra",
  NOVILHAS: "Novilha", "VACAS SOLTEIRAS": "Vaca solteira", "VACAS PARIDAS": "Vaca parida",
};

export const label = (value) => LABELS[value] ?? value;
export const categoryLabel = (category, quantity) => (Number(quantity) === 1 ? SINGULAR[category] : label(category));

export const isFemale = (sexType) => String(sexType).startsWith("FEMEA");

export function videoUrl(file) {
  return `/api/videos/${encodeURIComponent(file)}`;
}

// Rótulo de resolução a partir das dimensões originais do vídeo enviado
export function resolutionLabel(width, height) {
  const p = Math.min(Number(width) || 0, Number(height) || 0);
  if (!p) return null;
  if (p >= 2160) return "4K";
  if (p >= 1440) return "2K";
  if (p >= 1080) return "Full HD";
  if (p >= 720) return "HD";
  return `${p}p`;
}

/* ---------- Lotes (mapa de currais) ---------- */

// Quantidade de lotes do leilão: começa em DEFAULT_TOTAL_LOTS e pode ser ajustada no painel (até MAX_LOTS)
export const DEFAULT_TOTAL_LOTS = 40;
export const MAX_LOTS = 500;

// Validações do desembarque (usadas no formulário e na API)
export const LIMITS = { quantity: 9999, ageMonths: 360 };

const ordered = (values, order) => order.filter((v) => values.includes(v));

// Junta os registros do desembarque de um lote num resumo único
export function summarize(entries) {
  const males = entries.filter((e) => !isFemale(e.sexType)).reduce((s, e) => s + Number(e.quantity), 0);
  const females = entries.filter((e) => isFemale(e.sexType)).reduce((s, e) => s + Number(e.quantity), 0);
  const ages = entries.map((e) => Number(e.ageMonths));
  return {
    quantity: males + females,
    males,
    females,
    sex: males && females ? "MISTO" : females ? "FEMEA" : "MACHO",
    categories: ordered(entries.map((e) => categoryOf(e.sexType, e.ageMonths)), CATEGORIES),
    breeds: ordered(entries.map((e) => e.breed), BREEDS),
    qualities: ordered(entries.map((e) => e.quality), QUALITIES),
    ageMin: ages.length ? Math.min(...ages) : 0,
    ageMax: ages.length ? Math.max(...ages) : 0,
    refugo: entries.some(isRefugo),
    reasons: ordered(entries.filter(isRefugo).map((e) => e.reason), REFUGO_REASONS),
    mediaCount: entries.reduce((n, e) => n + (e.media?.length ?? 0), 0),
  };
}

export const sexLabel = (sex) => ({ MACHO: "Machos", FEMEA: "Fêmeas", MISTO: "Machos e fêmeas" })[sex] ?? sex;

export function ageLabel(min, max) {
  const unit = (n) => (n === 1 ? "mês" : "meses");
  return min === max ? `${min} ${unit(min)}` : `${min} a ${max} meses`;
}

// Título no padrão dos catálogos: "12 Garrotes" ou, se misturar categorias, "32 cabeças"
export function lotTitle(summary) {
  const n = summary.quantity.toLocaleString("pt-BR");
  return summary.categories.length === 1
    ? `${n} ${categoryLabel(summary.categories[0], summary.quantity)}`
    : `${n} ${summary.quantity === 1 ? "cabeça" : "cabeças"}`;
}

// Só os campos que podem ir para o público (nada de CPF, CNPJ ou titular).
export function toPublicLot(lot, entriesById) {
  const entries = (lot.entryIds ?? []).map((id) => entriesById.get(id)).filter(Boolean);
  const s = summarize(entries);
  return {
    id: lot.id,
    lot: lot.lot,
    farm: lot.farm,
    ...s,
    sexes: [s.males && "MACHO", s.females && "FEMEA"].filter(Boolean),
    entries: entries.map((e) => ({
      quantity: Number(e.quantity),
      category: categoryOf(e.sexType, e.ageMonths),
      sexType: e.sexType,
      ageMonths: Number(e.ageMonths),
      breed: e.breed,
      quality: e.quality ?? null,
      refugo: isRefugo(e),
      reason: isRefugo(e) ? e.reason ?? null : null,
    })),
    video: lot.video
      ? { url: videoUrl(lot.video.file), width: lot.video.width ?? null, height: lot.video.height ?? null }
      : null,
  };
}
