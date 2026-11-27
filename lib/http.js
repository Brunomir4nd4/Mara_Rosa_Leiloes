// Chamadas do navegador para a API do painel. Sempre lançam erro com mensagem em português.
async function request(url, options) {
  let res;
  try {
    res = await fetch(url, options);
  } catch {
    throw new Error("Sem conexão com o servidor. Tente de novo.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Não foi possível concluir a operação.");
  return data;
}

export function getJson(url) {
  return request(url);
}

export function postJson(url, body) {
  return request(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
