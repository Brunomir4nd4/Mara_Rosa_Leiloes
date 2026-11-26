"use client";

import { useState } from "react";
import FarmForm from "./FarmForm";
import CattleForm from "./CattleForm";
import UnloadingForm from "./UnloadingForm";

const SECTIONS = [
  { id: "farm", label: "Fazenda", title: "Cadastro da fazenda", sub: "Dados do titular e da propriedade." },
  { id: "cattle", label: "Gado / Lotes", title: "Cadastro de lotes", sub: "Registre os lotes de gado para o leilão." },
  { id: "unloading", label: "Desembarque", title: "Horário de desembarque", sub: "Registre e edite data e horário de desembarque." },
];

export default function PainelPage() {
  const [active, setActive] = useState("farm");
  // TODO: carregar estes registros da API/MongoDB (hoje ficam só na sessão do navegador)
  const [farms, setFarms] = useState([]);
  const [lots, setLots] = useState([]);
  const [unloadings, setUnloadings] = useState([]);

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
        {active === "cattle" && <CattleForm records={lots} farms={farms}onAdd={(r) => setLots((l) => [...l, r])} />}
        {active === "unloading" && (
          <UnloadingForm
            records={unloadings}
            lots={lots}
            onAdd={(r) => setUnloadings((l) => [...l, r])}
            onUpdate={(id, data) => setUnloadings((l) => l.map((r) => (r.id === id ? { ...r, ...data } : r)))}
          />
        )}
      </main>
    </div>
  );
}
