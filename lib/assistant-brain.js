// Cérebro do assistente da Mara Rosa Leilões — funciona sem API.
// Cada assunto tem palavras-chave (com sinônimos) e uma resposta baseada no funcionamento real da plataforma.
import { PLATFORM_GUIDE, QUICK_QUESTIONS } from "./assistant-knowledge";

const norm = (t) => String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const STOP = new Set("a o as os de da do das dos e em no na nos nas um uma uns umas para pra por com como que qual quais quando onde eu meu minha voce vc se ao aos isso esse essa este esta ja tem ter posso pode consigo fazer faco faz sobre me te lhe sim nao ok tipo".split(" "));
const stem = (w) => w.replace(/(coes|soes|oes|aes|ais|eis|ns|s)$/, "").replace(/(ando|endo|indo|ar|er|ir)$/, "").slice(0, 7);
const tokens = (t) => norm(t).replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w)).map(stem);

// ---------- Assuntos ----------
// keys: palavras ou expressões (expressões valem mais). roles: para quem a resposta muda.
const INTENTS = [
  { id: "oi", keys: ["oi", "ola", "bom dia", "boa tarde", "boa noite", "eai", "opa", "hello", "salve"],
    a: (ctx) => `Olá${ctx.first ? `, ${ctx.first}` : ""}! Sou o assistente da **Mara Rosa Leilões**. Posso te guiar em qualquer etapa: cadastro de fazendas, desembarque, lotes, pista, retirada, refugos, usuários e personalização. O que você quer fazer agora?` },
  { id: "obrigado", keys: ["obrigado", "obrigada", "valeu", "agradeco", "show", "perfeito", "otimo", "top"],
    a: () => "Por nada! Se precisar de mais alguma coisa no painel, é só perguntar." },
  { id: "ajuda", keys: ["ajuda", "o que voce faz", "como funciona voce", "assistente", "menu", "opcoes"],
    a: () => "Eu conheço a plataforma inteira. Você pode me perguntar, por exemplo:\n- Como registrar um desembarque ou um refugo\n- Como vincular um lote a uma fazenda\n- Como lançar o resultado na Pista e gerar o relatório\n- Como funciona o saldo da Retirada\n- Como criar usuários e o que cada função vê\n- Como trocar o tema e a foto de perfil" },

  { id: "fluxo", keys: ["passo a passo", "fluxo", "etapas", "comecar", "por onde", "ordem", "processo", "leilao funciona", "como funciona o leilao"],
    a: () => QUICK_QUESTIONS.find((q) => q.id === "fluxo").a },

  { id: "login", keys: ["login", "entrar", "acessar", "acesso painel", "cpf e senha", "nao consigo entrar", "tela de login"],
    a: () => "O acesso ao painel é pela tela de **login**, com **CPF e senha**. Os usuários são criados por TI ou Administrativo em **Admin → Usuários**. Se errar a senha muitas vezes, o acesso fica bloqueado por 15 minutos por segurança. Usuário desativado não consegue entrar." },
  { id: "senha", keys: ["senha", "esqueci", "trocar senha", "mudar senha", "redefinir", "resetar"],
    a: () => "Quem troca a senha é a **TI ou o Administrativo**: em **Admin → Usuários**, clique em **Editar** no usuário e preencha a nova senha duas vezes (mínimo de 8 caracteres, com letras e números). Ao trocar a senha de outra pessoa, as sessões abertas dela são encerradas e ela entra com a senha nova." },
  { id: "sair", keys: ["sair", "logout", "deslogar", "encerrar sessao"],
    a: () => "Para sair, clique no seu nome no topo e em **Sair do painel**, ou use o botão **Sair** do menu. A sessão é encerrada de verdade no servidor." },

  { id: "fazenda", keys: ["fazenda", "cadastrar fazenda", "cadastro da fazenda", "titular", "propriedade", "cnpj", "telefone", "whatsapp", "nome fantasia"],
    a: () => "Na aba **Fazenda**, preencha **CPF do titular**, **nome do titular**, **telefone/WhatsApp** e **nome da fazenda** (não pode repetir). **Nome fantasia** e **CNPJ** são opcionais. Escolha também o **Criador** (usuário do vendedor): todo refugo dessa fazenda já fica vinculado a ele. Clique em **Salvar fazenda**. O Criador pode ser trocado depois na própria lista de fazendas." },
  { id: "criador", keys: ["criador", "vendedor", "produtor", "dono do gado", "dono", "proprietario"],
    a: (ctx) => ctx.role === "CRIADOR"
      ? "Você é um usuário **Criador**: aqui você vê apenas os **refugos** dos seus animais, com motivo, observações, fotos e vídeos. Ninguém além de você e da equipe do recinto vê essas informações."
      : "O **Criador** é o usuário do vendedor. Ele é definido no **cadastro da Fazenda** e a amarração é automática: todo refugo registrado no Desembarque daquela fazenda já fica dele. O Criador entra no painel e vê **só a aba Refugos**, apenas com os seus animais. Para criar um Criador: **Admin → Usuários**, função Criador." },

  { id: "desembarque", keys: ["desembarque", "desembarcar", "registrar gado", "chegada", "chegou", "cadastrar gado", "registrar desembarque", "entrada do gado"],
    a: () => QUICK_QUESTIONS.find((q) => q.id === "desembarque").a },
  { id: "caminhao", keys: ["caminhao", "motorista", "placa", "modelo do caminhao", "mercosul", "transporte", "frete"],
    a: () => "No **Desembarque** há a seção **Caminhão**: **motorista**, **modelo** e **placa** (padrão antigo ABC-1234 ou Mercosul ABC1D23). Esses dados ficam guardados para consulta e se repetem no próximo registro; o atalho **Usar o último** preenche com o caminhão anterior. Na **Retirada**, registra-se o caminhão do comprador da mesma forma." },
  { id: "datahora", keys: ["data", "hora", "horario", "dia do desembarque", "calendario"],
    a: () => "A **data e hora** do desembarque e da retirada já vêm preenchidas com o momento atual (marcadas como *automático*). Para mudar, toque no campo e escolha no calendário. Não é possível usar data futura." },
  { id: "categoria", keys: ["categoria", "bezerro", "garrote", "novilha", "vaca", "boi", "idade", "sexo", "parida", "solteira"],
    a: () => "A **categoria** é calculada sozinha pelo **sexo** e pela **idade em meses**: machos viram bezerros, garrotes ou bois; fêmeas viram bezerras, novilhas, vacas solteiras ou vacas paridas. Basta preencher sexo/tipo e idade no **Desembarque**." },
  { id: "qualidade", keys: ["qualidade", "extra", "regular", "raca", "nelore", "nelorada", "cruzado"],
    a: () => "No **Desembarque** você escolhe a **raça** (Nelore, Nelorada ou Cruzado) e a **qualidade** (Extra, Bom ou Regular). Essas informações aparecem no catálogo público e servem de filtro para os clientes." },

  { id: "refugo", keys: ["refugo", "doente", "doenca", "lesao", "casco", "magreza", "problema", "animal com problema", "sigiloso", "sigilo"],
    a: (ctx) => ctx.role === "CRIADOR"
      ? "Na aba **Refugos** aparecem só os seus animais com problema: motivo, observações, lote e as fotos e vídeos enviados pela equipe. É uma informação sigilosa, ninguém de fora vê."
      : "Refugo é o animal com problema (doença, lesão, casco, magreza…). Para registrar: no **Desembarque**, escolha o tipo **Refugo**, a fazenda, o **motivo** e, se quiser, observações e **fotos/vídeos** para o dono. O **Criador** vem automaticamente do cadastro da fazenda. Refugos **não aparecem no catálogo** e vão para **lotes de refugo**, que não entram na Pista. Todos ficam listados na aba **Refugos**." },
  { id: "anexo", keys: ["foto do animal", "video do animal", "anexo", "anexar", "galeria", "midia"],
    a: () => "Fotos e vídeos são anexados no **refugo**: no Desembarque, na área *Fotos e vídeos para o proprietário*, arraste ou escolha os arquivos (fotos JPG, PNG ou WEBP até 15 MB; vídeos MP4, WEBM ou MOV até 500 MB). Depois, dá para ver e adicionar mais pela galeria do registro. O Criador dono vê esses anexos na aba Refugos." },

  { id: "lote", keys: ["lote", "vincular", "vinculo", "desvincular", "quadro de lotes", "lote disponivel"],
    a: () => QUICK_QUESTIONS.find((q) => q.id === "lote").a },
  { id: "lotes_qtd", keys: ["adicionar lotes", "mais lotes", "remover lotes", "quantidade de lotes", "40 lotes", "aumentar lotes"],
    a: () => "O leilão começa com **40 lotes**. Na aba **Lotes**, use **Adicionar lotes** para aumentar (até 500) ou remover lotes **disponíveis** do final do quadro. Lotes já vinculados não são removidos." },
  { id: "cores", keys: ["cor", "cores", "legenda", "amarelo", "laranja", "significa"],
    a: () => "No quadro de **Lotes**: lote **tracejado** está disponível, **amarelo** está vinculado a uma fazenda e **laranja** é lote de refugo. As letras **M**, **F** e **M+F** indicam machos, fêmeas ou misto." },

  { id: "pista", keys: ["pista", "arrematado", "arremate", "defendido", "nao arrematado", "lance", "proposta", "comprador", "valor", "prazo", "resultado"],
    a: (ctx) => (ctx.role === "CURRAL" ? "A Pista é usada por **TI e Administrativo** (seu usuário Curral não acessa). Funciona assim:\n" : "") +
      "Na aba **Pista**, escolha o lote (filtro, busca ou setas) e a situação: **Arrematado** (valor, comprador e prazo), **Defendido** (proposta recebida e valor que o dono queria) ou **Não arrematado**. Use **Salvar e próximo lote** para seguir a ordem. Lotes de refugo não entram na pista." },
  { id: "preco", keys: ["quanto custa", "preco", "valor do boi", "valor do lote", "cotacao", "arroba", "quanto vale", "custa"],
    a: (ctx) => "O valor de cada lote é definido **na hora do leilão**, pelos lances. Quando o lote é arrematado, o **valor**, o **comprador** e o **prazo** ficam registrados na aba **Pista**" +
      (ctx.role === "CURRAL" || ctx.role === "CRIADOR" ? " (acesso de TI e Administrativo)" : "") +
      ", e o **relatório de pista** mostra o total arrematado e a média por cabeça. O catálogo público não exibe valores." },
  { id: "relatorio", keys: ["relatorio", "pdf", "imprimir", "exportar", "baixar relatorio", "pos leilao"],
    a: (ctx) => (ctx.role === "CURRAL" || ctx.role === "CRIADOR" ? "O relatório é exclusivo de **TI e Administrativo**.\n" : "") +
      "O **relatório de pista** fica na aba **Pista**, no botão de relatório. Ele abre uma página com o resumo do leilão (arrematados, defendidos, valores, compradores) e a logo; dá para **visualizar** e **baixar/imprimir em PDF**." },

  { id: "retirada", keys: ["retirada", "retirar", "saldo", "buscar gado", "comprador buscar", "desfazer retirada", "viagem"],
    a: () => QUICK_QUESTIONS.find((q) => q.id === "retirada").a },

  { id: "usuarios", keys: ["usuario", "criar usuario", "novo usuario", "funcao", "permissao", "ti", "administrativo", "curral", "desativar", "reativar", "quem ve"],
    a: () => "Em **Admin → Usuários** (TI e Administrativo), preencha nome, CPF, a **função** e a senha. O que cada função vê:\n- **TI**: tudo, inclusive criar usuários de TI\n- **Administrativo**: tudo, menos criar ou alterar TI\n- **Curral**: Fazenda, Desembarque, Lotes, Retirada e Refugos\n- **Criador**: só os próprios refugos\nMudanças valem na hora; desativar encerra as sessões da pessoa." },
  { id: "video", keys: ["video do catalogo", "video do lote", "enviar video", "resolucao", "full hd", "4k"],
    a: () => QUICK_QUESTIONS.find((q) => q.id === "video").a },
  { id: "catalogo", keys: ["catalogo", "cliente", "vitrine", "publico", "site do cliente", "filtro do catalogo"],
    a: () => "O **catálogo** (/catalogo) é a vitrine pública para os clientes: mostra os lotes vinculados com categoria, raça, idade, qualidade, vídeo e filtros (sexo, categoria, qualidade, raça e número do lote). Não mostra CPF, valores, compradores nem **refugos**." },

  { id: "tema", keys: ["tema", "escuro", "claro", "automatico", "cor de destaque", "personalizar", "aparencia", "verde", "azul", "roxo"],
    a: () => "Clique em **Tema** (no menu lateral, ou no botão flutuante no login e no catálogo) e escolha **Escuro**, **Claro** ou **Automático**, e a cor de destaque: **Amarelo**, **Verde**, **Azul** ou **Roxo**. A escolha fica salva neste navegador." },
  { id: "foto", keys: ["foto de perfil", "avatar", "minha foto", "trocar foto", "imagem do perfil", "foto"],
    a: () => "Clique no seu nome (ou na sua foto) no topo e em **Adicionar foto de perfil**. Arraste ou escolha a imagem, ajuste o recorte circular e o zoom e clique em **Salvar foto**. Sem foto, aparece a primeira letra do seu nome." },
  { id: "chat", keys: ["chat", "conversa", "mensagem", "conversar", "falar com", "whatsapp", "grupo", "enviar foto", "enviar video"],
    a: () => "Na aba **Chat** você conversa com qualquer usuário cadastrado, no estilo WhatsApp:\n- **Geral**: grupo com toda a equipe\n- **Nova conversa**: escolha a pessoa (aparece o nome, a função e se está online)\n- Envie textos, **fotos** e **vídeos** pelo clipe, veja quem está digitando, a confirmação de leitura (✓✓) e apague as suas mensagens\nConversas individuais são vistas só pelos participantes." },
  { id: "celular", keys: ["celular", "mobile", "telefone celular", "tablet", "app"],
    a: () => "O painel funciona no **celular**: as abas ficam na barra inferior, e seu nome, o tema e o Sair ficam no topo. O catálogo também é adaptado, com os filtros num botão **Filtros**." },
];

// Mensagem padrão para assuntos fora da plataforma (sem dizer "não sei")
const DEFAULT = "Sou o assistente da **Mara Rosa Leilões** e estou aqui para te ajudar com a plataforma. Posso explicar como cadastrar fazendas e criadores, registrar o desembarque e os refugos, montar os lotes, lançar os resultados da Pista, controlar a Retirada, criar usuários e personalizar o painel. Sobre o que você quer saber?";

const scored = INTENTS.map((it) => ({
  it,
  phrases: it.keys.filter((k) => k.includes(" ")).map((k) => tokens(k).join(" ")),
  words: new Set(it.keys.filter((k) => !k.includes(" ")).flatMap(tokens)),
}));

// Escolhe o assunto mais provável
export function answer(question, ctx = {}) {
  const t = tokens(question);
  const joined = " " + t.join(" ") + " ";
  let best = null;
  for (const s of scored) {
    let score = 0;
    for (const p of s.phrases) if (p && joined.includes(" " + p + " ")) score += 3;
    for (const w of t) if (s.words.has(w)) score += 1;
    if (score > (best?.score ?? 0)) best = { s, score };
  }
  if (!best || best.score === 0) return guideLookup(t) ?? DEFAULT;
  return best.s.it.a(ctx);
}

// Último recurso: procura no guia completo a seção mais parecida
function guideLookup(t) {
  if (!t.length) return null;
  const sections = PLATFORM_GUIDE.split(/\n(?=## )/).map((b) => {
    const [first, ...rest] = b.split("\n");
    return { title: first.replace(/^#+\s*/, ""), lines: rest.map((l) => l.trim()).filter(Boolean) };
  });
  let best = null;
  for (const s of sections) {
    const lines = s.lines.map((l) => ({ l, n: tokens(l).filter((w) => t.includes(w)).length }));
    const total = lines.reduce((a, x) => a + x.n, 0) + tokens(s.title).filter((w) => t.includes(w)).length * 2;
    if (!best || total > best.total) best = { s, total, lines };
  }
  if (!best || best.total < 2) return null;
  const top = best.lines.filter((x) => x.n).sort((a, b) => b.n - a.n).slice(0, 4).map((x) => (x.l.startsWith("-") ? x.l : `- ${x.l}`));
  return `Sobre **${best.s.title}**:\n${top.join("\n")}`;
}
