// Avisos de mensagens novas do chat: notificação do navegador + som curto.
// Funciona com a aba aberta (em segundo plano ou em outra seção do painel). Exige HTTPS (ou localhost).
export const OPEN_CHAT_EVENT = "mr-open-chat";

export const notifySupported = () => typeof window !== "undefined" && "Notification" in window;
export const notifyPermission = () => (notifySupported() ? Notification.permission : "unsupported");

export async function askNotifyPermission() {
  if (!notifySupported()) return "unsupported";
  try { return await Notification.requestPermission(); } catch { return Notification.permission; }
}

let audio;
function ding() {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    const t = audio.currentTime;
    for (const [i, f] of [[0, 880], [0.12, 1320]]) {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + i);
      g.gain.exponentialRampToValueAtTime(0.18, t + i + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i + 0.22);
      o.connect(g).connect(audio.destination);
      o.start(t + i); o.stop(t + i + 0.25);
    }
  } catch {}
}

// Compara a lista anterior com a nova e avisa das conversas com mensagem nova de outra pessoa.
// title(chat) dá o nome da conversa. Não avisa da conversa aberta enquanto a pessoa está olhando.
export function notifyNew(prev, next, meId, { activeId = null, title }) {
  if (!prev || !next) return;
  const before = new Map(prev.map((c) => [c.id, c]));
  const fresh = next.filter((c) => {
    const p = before.get(c.id);
    return c.unread > 0 && c.last?.fromId && c.last.fromId !== meId && c.lastAt && (!p || !p.lastAt || c.lastAt > p.lastAt);
  });
  const watching = (c) => c.id === activeId && document.visibilityState === "visible";
  const toShow = fresh.filter((c) => !watching(c));
  if (!toShow.length) return;
  ding();
  if (notifyPermission() !== "granted") return;
  for (const c of toShow.slice(0, 3)) {
    const name = title(c);
    const direct = c.type === "direct";
    try {
      const n = new Notification(direct ? c.last.from : name, {
        body: `${direct ? "" : `${c.last.from}: `}${c.last.kind === "photo" ? "📷 Foto" : c.last.kind === "video" ? "🎥 Vídeo" : c.last.text}`,
        icon: "/logo.jpg", badge: "/logo.jpg", tag: `chat-${c.id}`, renotify: true,
      });
      n.onclick = () => {
        window.focus();
        window.dispatchEvent(new CustomEvent(OPEN_CHAT_EVENT, { detail: c.id }));
        n.close();
      };
    } catch {}
  }
}
