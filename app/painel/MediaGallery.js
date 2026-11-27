"use client";

import { useEffect, useRef, useState } from "react";

export const ACCEPT_MEDIA = "image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime";
const MAX_PHOTO = 15 * 1024 * 1024;
const MAX_VIDEO = 500 * 1024 * 1024;

export const mediaUrl = (m) => `/api/admin/media/${encodeURIComponent(m.file)}`;
const fmtSize = (b) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

// Confere tipo e tamanho antes de enviar. Devolve mensagem de erro ou "".
export function checkFile(file) {
  if (!ACCEPT_MEDIA.split(",").includes(file.type)) return `${file.name}: formato não aceito (use JPG, PNG, WEBP, MP4, WEBM ou MOV).`;
  const isPhoto = file.type.startsWith("image/");
  if (isPhoto && file.size > MAX_PHOTO) return `${file.name}: foto acima de 15 MB.`;
  if (!isPhoto && file.size > MAX_VIDEO) return `${file.name}: vídeo acima de 500 MB.`;
  return "";
}

// Envia um arquivo (XHR para ter progresso). Devolve o registro atualizado.
export function uploadMedia(entryId, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/admin/entries/${entryId}/media`);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch {}
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data.error || "Falha no envio. Tente de novo."));
    };
    xhr.onerror = () => reject(new Error("Sem conexão. Verifique a internet e tente de novo."));
    xhr.send(file);
  });
}

function Lightbox({ items, index, onClose, onIndex }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (index != null && d && !d.open) d.showModal();
    if (index == null && d?.open) d.close();
  }, [index]);
  const m = index != null ? items[index] : null;
  return (
    <dialog ref={ref} className="lightbox" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" && index < items.length - 1) onIndex(index + 1);
        if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
      }}>
      {m && (
        <div className="lb-box">
          <button type="button" className="lb-x" onClick={onClose} aria-label="Fechar">✕</button>
          {m.kind === "photo"
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={mediaUrl(m)} alt={m.name || "Foto do animal"} />
            : <video key={m.id} src={mediaUrl(m)} controls autoPlay playsInline />}
          <div className="lb-bar">
            <button type="button" onClick={() => onIndex(index - 1)} disabled={index === 0} aria-label="Anterior">‹</button>
            <span>{m.name || (m.kind === "photo" ? "Foto" : "Vídeo")} · {index + 1} de {items.length}</span>
            <button type="button" onClick={() => onIndex(index + 1)} disabled={index === items.length - 1} aria-label="Próximo">›</button>
          </div>
        </div>
      )}
    </dialog>
  );
}

// Galeria de anexos de um registro do desembarque. `editable` permite anexar e remover.
export default function MediaGallery({ entry, onChange, editable = false, compact = false }) {
  const media = entry.media ?? [];
  const input = useRef(null);
  const [open, setOpen] = useState(null);
  const [queue, setQueue] = useState([]); // { name, progress, error }
  const [error, setError] = useState("");

  async function addFiles(files) {
    setError("");
    const list = [...files];
    const problems = list.map(checkFile).filter(Boolean);
    if (problems.length) { setError(problems.join(" ")); return; }
    setQueue(list.map((f) => ({ name: f.name, progress: 0 })));
    let current = entry;
    for (const [i, f] of list.entries()) {
      try {
        current = await uploadMedia(entry.id, f, (p) => setQueue((q) => q.map((x, j) => (j === i ? { ...x, progress: p } : x))));
        onChange?.(current);
      } catch (err) {
        setQueue((q) => q.map((x, j) => (j === i ? { ...x, error: err.message } : x)));
        setError(err.message);
      }
    }
    setTimeout(() => setQueue([]), 800);
  }

  async function remove(m) {
    if (!window.confirm(`Remover ${m.kind === "photo" ? "esta foto" : "este vídeo"}? Não dá para desfazer.`)) return;
    const res = await fetch(`/api/admin/entries/${entry.id}/media/${m.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) onChange?.(data);
    else setError(data.error || "Não foi possível remover.");
  }

  return (
    <div className={`gallery${compact ? " compact" : ""}`}>
      {media.length === 0 && !editable && <p className="g-empty">Sem fotos ou vídeos.</p>}
      <ul className="g-grid">
        {media.map((m, i) => (
          <li key={m.id} className={`g-item ${m.kind}`}>
            <button type="button" className="g-thumb" onClick={() => setOpen(i)} aria-label={`Abrir ${m.kind === "photo" ? "foto" : "vídeo"} ${i + 1}`}>
              {m.kind === "photo"
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={mediaUrl(m)} alt="" loading="lazy" />
                : <video src={`${mediaUrl(m)}#t=0.1`} muted preload="metadata" tabIndex={-1} />}
              {m.kind === "video" && <span className="g-play" aria-hidden="true" />}
              <span className="g-kind">{m.kind === "photo" ? "Foto" : "Vídeo"} · {fmtSize(m.size)}</span>
            </button>
            {editable && (
              <button type="button" className="g-del" onClick={() => remove(m)} aria-label="Remover anexo">✕</button>
            )}
          </li>
        ))}
        {queue.map((q, i) => (
          <li key={`q${i}`} className={`g-item up${q.error ? " fail" : ""}`}>
            <div className="g-up">
              <span className="g-up-name">{q.name}</span>
              <span className="g-up-bar"><span style={{ width: `${q.progress}%` }} /></span>
              <span className="g-up-pct">{q.error ? "Falhou" : `${q.progress}%`}</span>
            </div>
          </li>
        ))}
        {editable && (
          <li className="g-item">
            <button type="button" className="g-add" onClick={() => input.current?.click()}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5h2v14h-2zM5 11h14v2H5z" /></svg>
              Anexar foto ou vídeo
            </button>
            <input ref={input} type="file" multiple accept={ACCEPT_MEDIA} hidden
              onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          </li>
        )}
      </ul>
      {error && <p className="ferr" role="alert">{error}</p>}
      <Lightbox items={media} index={open} onClose={() => setOpen(null)} onIndex={setOpen} />
    </div>
  );
}
