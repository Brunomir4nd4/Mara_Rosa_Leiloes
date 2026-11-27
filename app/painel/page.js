"use client";

import { useEffect, useState } from "react";
import FarmForm from "./FarmForm";
import { getJson } from "../../lib/http";

const SECTIONS = [
  { id: "farm", label: "Fazenda", title: "Cadastro da fazenda", sub: "Dados do titular e da propriedade." },
];

export default function PainelPage() {
  const [active, setActive] = useState("farm");
  const [farms, setFarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    getJson("/api/farms")
      .then(setFarms)
      .catch((err) => setLoadError(`Não foi possível carregar os dados. ${err.message}`))
      .finally(() => setLoading(false));
  }, []);

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
        <div className="err" role="alert">{loadError}</div>
        {loading ? (
          <p className="empty">Carregando…</p>
        ) : (
          active === "farm" && <FarmForm records={farms} onAdd={(r) => setFarms((l) => [...l, r])} />
        )}
      </main>
    </div>
  );
}
