"use client";

import ThemePicker, { useTheme } from "../painel/ThemePicker";

// Botão flutuante de tema para as telas fora do painel (login e catálogo)
// placement: "inline" (no fluxo da página, sem cobrir conteúdo), "top" ou "bottom" (flutuante)
export default function PageTheme({ placement = "inline" }) {
  const theme = useTheme({ global: true });
  return (
    <div className={`theme-fab${placement === "top" ? " top" : placement === "inline" ? " inline" : ""}`}>
      <ThemePicker theme={theme} />
    </div>
  );
}
