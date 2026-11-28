// Funções dos usuários do painel e o que cada uma acessa (usado na tela e no servidor).

export const ROLES = ["TI", "ADMINISTRATIVO", "CURRAL", "CRIADOR"];

export const ROLE_INFO = {
  TI: {
    label: "TI",
    desc: "Acesso total, inclusive Administração (usuários e vídeos do catálogo).",
    tabs: ["farm", "cattle", "lots", "pista", "pickup", "refugos", "admin"],
  },
  ADMINISTRATIVO: {
    label: "Administrativo",
    desc: "Todas as abas, inclusive Pista, relatório e Administração. Não cria nem altera usuários de TI.",
    tabs: ["farm", "cattle", "lots", "pista", "pickup", "refugos", "admin"],
  },
  CURRAL: {
    label: "Curral",
    desc: "Fazenda, Desembarque, Lotes, Retirada e Refugos. Sem Pista, relatório e Administração.",
    tabs: ["farm", "cattle", "lots", "pickup", "refugos"],
  },
  CRIADOR: {
    label: "Criador",
    desc: "Vendedor/produtor. Vê apenas os refugos vinculados a ele, com fotos e vídeos. Não acessa as outras abas.",
    tabs: ["refugos"],
  },
};

// Grupos usados para proteger rotas da API
export const OFFICE = ["TI", "ADMINISTRATIVO"]; // pista, relatório, administração, vídeos
export const STAFF = ["TI", "ADMINISTRATIVO", "CURRAL"]; // equipe: tudo do recinto e todos os refugos
export const EVERYONE = ROLES;

export const canSeeTab = (role, tab) => Boolean(ROLE_INFO[role]?.tabs.includes(tab));

// Quem pode criar/alterar um usuário com determinada função
export const canManageRole = (actorRole, targetRole) =>
  actorRole === "TI" || (actorRole === "ADMINISTRATIVO" && targetRole !== "TI");
