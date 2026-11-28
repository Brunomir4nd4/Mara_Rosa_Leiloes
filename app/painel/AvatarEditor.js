"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "../_ui/Icon";

const OUT = 512; // tamanho final da foto (px)
const VIEW = 280; // tamanho da área de recorte na tela (px)
const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IN = 15 * 1024 * 1024;

// Sem foto: mostra a primeira letra do nome
export const initials = (name) => (name.trim()[0] || "?").toUpperCase();

// Foto do usuário ou, sem foto, as iniciais
export function Avatar({ name, src, className = "", ring = true, dot = false }) {
  return (
    <span className={`um-av${ring ? "" : " no-ring"} ${className}`} aria-hidden="true">
      {src
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={src} alt="" draggable={false} />
        : <span>{initials(name)}</span>}
      {dot && <i className="um-dot" />}
    </span>
  );
}

// Recorte circular: arrastar para posicionar, controle (ou roda do mouse) para zoom
export default function AvatarEditor({ me, onClose, onSaved, onRemoved }) {
  const ref = useRef(null);
  const input = useRef(null);
  const [img, setImg] = useState(null); // HTMLImageElement
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [dragging, setDragging] = useState(false);
  const drag = useRef(null);

  useEffect(() => { ref.current?.showModal(); }, []);

  // escala para a imagem cobrir o círculo com zoom 1
  const base = img ? VIEW / Math.min(img.naturalWidth, img.naturalHeight) : 1;
  const scale = base * zoom;
  const w = img ? img.naturalWidth * scale : 0;
  const h = img ? img.naturalHeight * scale : 0;
  const clamp = (p, s = scale) => {
    if (!img) return p;
    const mx = Math.max(0, (img.naturalWidth * s - VIEW) / 2);
    const my = Math.max(0, (img.naturalHeight * s - VIEW) / 2);
    return { x: Math.max(-mx, Math.min(mx, p.x)), y: Math.max(-my, Math.min(my, p.y)) };
  };

  function load(file) {
    setError("");
    if (!file) return;
    if (!TYPES.includes(file.type)) return setError("Use uma imagem JPG, PNG ou WEBP.");
    if (file.size > MAX_IN) return setError("Imagem acima de 15 MB.");
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => { setImg(im); setZoom(1); setPos({ x: 0, y: 0 }); };
    im.onerror = () => setError("Não foi possível abrir esta imagem.");
    im.src = url;
  }

  function changeZoom(z) {
    const nz = Math.max(1, Math.min(4, z));
    setZoom(nz);
    setPos((p) => clamp(p, base * nz));
  }

  function onPointerDown(e) {
    if (!img) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, start: pos };
    setDragging(true);
  }
  function onPointerMove(e) {
    const d = drag.current;
    if (!d) return;
    setPos(clamp({ x: d.start.x + e.clientX - d.x, y: d.start.y + e.clientY - d.y }));
  }
  const onPointerUp = () => { drag.current = null; setDragging(false); };

  function onKey(e) {
    if (!img) return;
    const step = e.shiftKey ? 20 : 6;
    const moves = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (moves[e.key]) { e.preventDefault(); setPos((p) => clamp({ x: p.x + moves[e.key][0], y: p.y + moves[e.key][1] })); }
    if (e.key === "+" || e.key === "=") changeZoom(zoom + 0.1);
    if (e.key === "-") changeZoom(zoom - 0.1);
  }

  async function save() {
    if (!img) return;
    setBusy(true);
    setError("");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = OUT;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      // área visível (em px da imagem original)
      const size = VIEW / scale;
      const sx = img.naturalWidth / 2 - pos.x / scale - size / 2;
      const sy = img.naturalHeight / 2 - pos.y / scale - size / 2;
      ctx.drawImage(img, sx, sy, size, size, 0, 0, OUT, OUT);
      const blob = await new Promise((r) => canvas.toBlob(r, "image/webp", 0.9))
        || await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.9));
      if (!blob) throw new Error("Não foi possível preparar a foto. Tente outra imagem.");
      let res;
      try {
        res = await fetch("/api/auth/me/avatar", { method: "POST", headers: { "Content-Type": blob.type }, body: blob });
      } catch {
        throw new Error("Sem conexão com o servidor. Verifique a internet e tente de novo.");
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não foi possível salvar a foto.");
      onSaved(data.avatar);
      ref.current?.close();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm("Remover sua foto? Volta a mostrar as iniciais.")) return;
    setBusy(true);
    const res = await fetch("/api/auth/me/avatar", { method: "DELETE" }).catch(() => null);
    if (res?.ok) { onRemoved(); ref.current?.close(); } else { setError("Não foi possível remover a foto."); setBusy(false); }
  }

  return (
    <dialog ref={ref} className="av-dlg" onClose={onClose} onClick={(e) => e.target === ref.current && ref.current.close()}>
      <div className="av-box">
        <div className="av-head">
          <div>
            <h3>Foto de perfil</h3>
            <p>Aparece no seu cartão e na lista de usuários.</p>
          </div>
          <button type="button" className="av-x" onClick={() => ref.current?.close()} aria-label="Fechar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
        </div>

        <div
          className={`av-stage${img ? " has" : ""}${over ? " over" : ""}`}
          style={{ "--view": `${VIEW}px` }}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); load(e.dataTransfer.files?.[0]); }}
        >
          {img ? (
            <div className={`av-crop${dragging ? " dragging" : ""}`} tabIndex={0} role="application" aria-label="Área de recorte: arraste ou use as setas para posicionar"
              onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
              onWheel={(e) => changeZoom(zoom - e.deltaY * 0.0015)} onKeyDown={onKey}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.src} alt="" draggable={false}
                style={{ width: w, height: h, transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))` }} />
              <span className="av-mask" aria-hidden="true" />
              <span className="av-grid" aria-hidden="true" />
            </div>
          ) : (
            <div className="av-empty">
              <button type="button" className="av-pick" onClick={() => input.current?.click()} aria-label={me.avatar ? "Trocar foto" : "Escolher foto"}>
                <span className="av-orbit" aria-hidden="true" />
                <span className="av-big">
                  {me.avatar
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={me.avatar} alt="" />
                    : <span>{initials(me.name)}</span>}
                </span>
                <span className="av-badge" aria-hidden="true"><Icon name="camera" size={18} /></span>
              </button>
              <strong className="av-title">{me.avatar ? "Sua foto atual" : "Você ainda não tem foto"}</strong>
              <p className="av-sub">Arraste uma imagem para cá ou escolha um arquivo do computador ou celular.</p>
              <button type="button" className="av-btn pri av-choose" onClick={() => input.current?.click()}>
                <Icon name="camera" size={16} /> {me.avatar ? "Escolher nova foto" : "Escolher foto"}
              </button>
              <ul className="av-specs" aria-label="Requisitos">
                <li>JPG, PNG ou WEBP</li><li>Até 15 MB</li><li>Recorte circular</li>
              </ul>
            </div>
          )}
        </div>
        <input ref={input} type="file" accept={TYPES.join(",")} hidden onChange={(e) => { load(e.target.files?.[0]); e.target.value = ""; }} />

        {img && (
          <div className="av-prev" aria-hidden="true">
            {[72, 44, 30].map((p) => {
              const k = p / VIEW;
              return (
                <span key={p} className="av-prev-c" style={{ width: p, height: p }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.src} alt="" style={{ width: w * k, height: h * k, transform: `translate(calc(-50% + ${pos.x * k}px), calc(-50% + ${pos.y * k}px))` }} />
                </span>
              );
            })}
            <p>Assim sua foto aparece no painel</p>
          </div>
        )}
        {img && (
          <div className="av-zoom">
            <button type="button" onClick={() => changeZoom(zoom - 0.2)} aria-label="Diminuir zoom"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12" /></svg></button>
            <input type="range" min="1" max="4" step="0.01" value={zoom} onChange={(e) => changeZoom(Number(e.target.value))} aria-label="Zoom"
              style={{ "--p": `${((zoom - 1) / 3) * 100}%` }} />
            <button type="button" onClick={() => changeZoom(zoom + 0.2)} aria-label="Aumentar zoom"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12" /></svg></button>
          </div>
        )}
        {img && <p className="av-hint">Arraste a foto para centralizar o rosto. Use a roda do mouse ou o controle para dar zoom.</p>}
        {error && <p className="av-err" role="alert">{error}</p>}

        <div className="av-foot">
          {me.avatar && !img && <button type="button" className="av-btn danger" onClick={remove} disabled={busy}>Remover foto</button>}
          {img && <button type="button" className="av-btn" onClick={() => input.current?.click()} disabled={busy}>Outra imagem</button>}
          <span className="av-sp" />
          <button type="button" className="av-btn" onClick={() => ref.current?.close()} disabled={busy}>Cancelar</button>
          <button type="button" className="av-btn pri" onClick={save} disabled={!img || busy}>{busy ? "Salvando…" : "Salvar foto"}</button>
        </div>
      </div>
    </dialog>
  );
}
