"use client";

import ThemePicker, { useTheme } from "../painel/ThemePicker";

// Botão flutuante de tema para as telas fora do painel (login e catálogo)
export default function PageTheme() {
  const theme = useTheme({ global: true });
  return (
    <div className="theme-fab">
      <ThemePicker theme={theme} />
    </div>
  );
}
