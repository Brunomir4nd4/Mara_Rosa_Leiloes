import { Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";

const barlow = Barlow({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-body" });
const condensed = Barlow_Condensed({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-display" });

export const metadata = { title: "Mara Rosa Leilão", description: "Catálogo de lotes de gado da Mara Rosa Leilões." };

const THEME_BOOT = `try{var p=JSON.parse(localStorage.getItem("mr-tema")||"null")||{};var m=p.mode||"dark";var d=m==="auto"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):m;document.documentElement.dataset.theme=d;document.documentElement.dataset.accent=p.accent||"yellow"}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={`${barlow.variable} ${condensed.variable}`} suppressHydrationWarning>
      <head>
        {/* aplica o tema salvo antes de pintar (todas as páginas), sem piscar ao trocar de tela */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
