"use client";

import { useEffect, useState } from "react";

// Logo que acompanha a cor de destaque do tema.
// O arquivo /logo.jpg é desenho escuro sobre fundo amarelo. Geramos (uma vez, no navegador) uma máscara
// só com o desenho; ele é pintado por cima do bloco na cor de destaque — o fundo amarelo some.
let maskPromise;
function buildMask() {
  maskPromise ??= new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const g = c.getContext("2d");
      g.drawImage(img, 0, 0);
      const data = g.getImageData(0, 0, c.width, c.height);
      const p = data.data;
      for (let i = 0; i < p.length; i += 4) {
        const l = (0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2]) / 255;
        // escuro (desenho) = opaco; amarelo do fundo = transparente; tons do meio ficam suaves
        const a = Math.max(0, Math.min(1, (0.6 - l) / 0.22)); // rampa curta: borda nítida, sem o esfumado do fundo
        p[i] = p[i + 1] = p[i + 2] = 0;
        p[i + 3] = Math.round(a * 255);
      }
      g.putImageData(data, 0, 0);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = "/logo.jpg";
  }).catch((e) => { maskPromise = undefined; throw e; });
  return maskPromise;
}

// fx: camadas extras com a mesma máscara (ferro em brasa e brilho) para o efeito do login
export default function BrandLogo({ className = "", fx = false }) {
  const [mask, setMask] = useState(null);
  useEffect(() => {
    let alive = true;
    buildMask().then((m) => alive && setMask(m)).catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!mask) {
    // enquanto a máscara não fica pronta (ou se falhar), mostra o arquivo original
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={className} src="/logo.jpg" alt="Mara Rosa Leilões – A vitrine do boi" width={886} height={861} />;
  }
  return (
    <span className={`${className} brand-logo`} role="img" aria-label="Mara Rosa Leilões – A vitrine do boi">
      <span className="bl-art" style={{ WebkitMaskImage: `url(${mask})`, maskImage: `url(${mask})` }} />
      {fx && <span className="bl-hot" style={{ WebkitMaskImage: `url(${mask})`, maskImage: `url(${mask})` }} />}
      {fx && <span className="bl-shine" style={{ WebkitMaskImage: `url(${mask})`, maskImage: `url(${mask})` }} />}
    </span>
  );
}
