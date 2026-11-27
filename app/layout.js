import { Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";

const barlow = Barlow({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-body" });
const condensed = Barlow_Condensed({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-display" });

export const metadata = { title: "Mara Rosa Leilão", description: "Catálogo de lotes de gado da Mara Rosa Leilões." };

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={`${barlow.variable} ${condensed.variable}`}>
      <body>{children}</body>
    </html>
  );
}
