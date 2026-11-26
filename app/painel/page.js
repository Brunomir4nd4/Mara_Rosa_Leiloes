"use client";

import { useState } from "react";
import FarmForm from "./FarmForm";
import CattleForm from "./CattleForm";

const SECTIONS = [
  { id: "farm", label: "Fazenda", title: "Cadastro da fazenda", sub: "Dados do titular e da propriedade." },
  { id: "cattle", label: "Desembarque", title: "Desembarque", sub: "Registre os lotes de gado para o leilão." },
];

export default function PainelPage() {
  const [active, setActive] = useState("farm");
  // TODO: carregar estes registros da API/MongoDB (hoje ficam só na sessão do navegador)
  const [farms, setFarms] = useState([]);
  const [lots, setLots] = useState([]);

  const section = SECTIONS.find((s) => s.id === active);

  return (
    <div className="dash">
      <aside className="side">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="dlogo" src="/logo.jpg" alt="Mara Rosa Leilões – A vitrine do boi" width={886} height={861} />
        <nav aria-label="Navegação do painel">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={s.id === active ? "on" : ""}
              aria-current={s.id === active ? "page" : undefined}
              onClick={() => setActive(s.id)}
            >
              {s.label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="content">
        <h1>{section.title}</h1>
        <p className="dsub">{section.sub}</p>
        {active === "farm" && <FarmForm records={farms} onAdd={(r) => setFarms((l) => [...l, r])} />}
        {active === "cattle" && <CattleForm records={lots} farms={farms} onAdd={(r) => setLots((l) => [...l, r])} />}
      </main>
    </div>
  );
}
