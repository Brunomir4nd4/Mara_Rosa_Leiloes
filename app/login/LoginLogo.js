"use client";

import { useEffect, useRef, useState } from "react";
import BrandLogo from "../_ui/BrandLogo";

// Logo do login "marcada a ferro": entra com impacto, fica em brasa e esfria.
// Depois, brilho metálico de tempos em tempos e inclinação 3D com o mouse.
export default function LoginLogo() {
  const stage = useRef(null);
  const [ready, setReady] = useState(false);

  // começa quando a logo recolorível estiver pronta (ou em até 1,5 s, com a imagem original)
  useEffect(() => {
    const started = Date.now();
    const iv = setInterval(() => {
      if (stage.current?.querySelector(".bl-art") || Date.now() - started > 1500) { clearInterval(iv); setReady(true); }
    }, 40);
    return () => clearInterval(iv);
  }, []);

  // inclinação 3D seguindo o mouse (apenas em cima da logo)
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = stage.current;
    const move = (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty("--tx", `${(-y * 10).toFixed(2)}deg`);
      el.style.setProperty("--ty", `${(x * 12).toFixed(2)}deg`);
    };
    const leave = () => { el.style.setProperty("--tx", "0deg"); el.style.setProperty("--ty", "0deg"); };
    // só reage quando o mouse está sobre a logo
    el.addEventListener("pointermove", move, { passive: true });
    el.addEventListener("pointerleave", leave);
    return () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerleave", leave); };
  }, []);

  return (
    <div className={`lg-stage${ready ? " go" : ""}`} ref={stage}>
      <span className="lg-shock" aria-hidden="true" />
      <span className="lg-shock s2" aria-hidden="true" />
      <div className="lg-tilt">
        <BrandLogo className="logo" fx />
      </div>
    </div>
  );
}
