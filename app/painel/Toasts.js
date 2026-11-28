"use client";

import { useCallback, useRef, useState } from "react";
import Icon from "../_ui/Icon";

// Notificações do painel (sucesso / erro / info), somem sozinhas em alguns segundos
export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const seq = useRef(0);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback((toast) => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-3), { id, type: "success", ...toast }]);
    setTimeout(() => dismiss(id), toast.type === "error" ? 7000 : 4500);
  }, [dismiss]);

  return { toasts, push, dismiss };
}

const ICON = { success: <Icon name="check" size={16} />, error: <Icon name="alert" size={16} />, info: <Icon name="info" size={16} /> };

export function Toasts({ toasts, dismiss }) {
  return (
    <div className="toasts" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`} role={t.type === "error" ? "alert" : "status"}>
          <span className="toast-ico" aria-hidden="true">{ICON[t.type]}</span>
          <div className="toast-body">
            <strong>{t.title}</strong>
            {t.message && <p>{t.message}</p>}
          </div>
          <button type="button" className="toast-x" onClick={() => dismiss(t.id)} aria-label="Fechar aviso"><Icon name="x" size={16} /></button>
          <span className="toast-bar" aria-hidden="true" />
        </div>
      ))}
    </div>
  );
}
