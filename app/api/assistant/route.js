import { fail, readJson, requireUser } from "../../../lib/api";
import { answer } from "../../../lib/assistant-brain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Assistente da Mara Rosa Leilões: responde com base no conhecimento da própria plataforma
// (lib/assistant-brain.js). Não usa API externa nem envia dados para fora.
const MAX_CHARS = 2000;

// Limite simples por usuário (por instância do servidor): 30 perguntas por minuto
const WINDOW_MS = 60_000;
const hits = new Map();
let lastPrune = 0;

// tira do Map quem não pergunta há mais de 1 minuto (no máximo uma varredura por minuto)
function prune(now) {
  if (now - lastPrune < WINDOW_MS) return;
  lastPrune = now;
  for (const [id, list] of hits) if (!list.length || now - list[list.length - 1] >= WINDOW_MS) hits.delete(id);
}

function allow(id) {
  const now = Date.now();
  prune(now);
  const list = (hits.get(id) || []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= 30) return false;
  list.push(now);
  hits.set(id, list);
  return true;
}

export async function POST(request) {
  const { user, denied } = await requireUser(request);
  if (denied) return denied;
  if (!allow(user.id)) return fail("Muitas perguntas em sequência. Aguarde um minuto.", 429);

  const body = await readJson(request);
  const list = Array.isArray(body?.messages) ? body.messages : [];
  const last = [...list].reverse().find((m) => m?.role === "user" && typeof m.content === "string" && m.content.trim());
  if (!last) return fail("Envie uma pergunta.", 400);

  const text = answer(last.content.slice(0, MAX_CHARS), {
    role: user.role,
    first: user.system ? "" : String(user.name || "").split(" ")[0],
  });

  // entrega em pedaços, como se estivesse digitando
  const encoder = new TextEncoder();
  const parts = text.match(/\S+\s*/g) ?? [text];
  const stream = new ReadableStream({
    async start(controller) {
      await new Promise((r) => setTimeout(r, 450)); // "pensando"
      for (let i = 0; i < parts.length; i += 2) {
        controller.enqueue(encoder.encode(parts.slice(i, i + 2).join("")));
        await new Promise((r) => setTimeout(r, 18));
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
