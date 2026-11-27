"use client";

import { useEffect } from "react";

// Barra do relatório (não sai na impressão). Com ?pdf=1 já abre a janela de impressão / salvar PDF.
export default function ReportActions() {
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("pdf") === "1") {
      // espera fontes e logo carregarem para o PDF sair completo
      Promise.all([document.fonts?.ready, new Promise((r) => setTimeout(r, 400))]).then(() => window.print());
    }
  }, []);

  // O relatório abre em outra aba a partir da Pista: voltar = fechar esta aba e continuar de onde parou.
  // Se o navegador não deixar fechar (aba aberta direto pelo endereço), vai para a Pista no último lote aberto.
  function back(e) {
    e.preventDefault();
    // só fecha se esta aba foi aberta apenas para o relatório (sem páginas anteriores)
    if (window.history.length <= 1) {
      window.close();
      setTimeout(() => { if (!window.closed) window.location.href = "/painel?aba=pista"; }, 150);
    } else {
      window.location.href = "/painel?aba=pista";
    }
  }

  return (
    <div className="rp-bar">
      <a href="/painel?aba=pista" className="rp-back" onClick={back}>
        <span className="rp-back-ico" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M15.4 5.4 14 4l-8 8 8 8 1.4-1.4L8.8 12z" /></svg>
        </span>
        <span className="rp-back-txt">
          <small>Voltar para</small>
          Pista
        </span>
      </a>
      <div className="rp-bar-txt">
        <strong>Relatório de pista</strong>
        <span>Para gerar o PDF, clique em “Baixar PDF” e escolha <b>Salvar como PDF</b> no destino.</span>
      </div>
      <div className="rp-bar-btns">
        <button type="button" className="rp-btn" onClick={() => window.location.reload()}>Atualizar dados</button>
        <button type="button" className="rp-btn primary" onClick={() => window.print()}>Baixar PDF / Imprimir</button>
      </div>
    </div>
  );
}
