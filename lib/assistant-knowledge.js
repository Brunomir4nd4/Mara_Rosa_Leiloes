// Base de conhecimento do assistente do painel (usada no servidor e na tela).
// Sem dados pessoais: só como a plataforma funciona.

export const PLATFORM_GUIDE = `
# Mara Rosa Leilões — guia do painel

Sistema de leilão de gado. Fluxo: Fazenda → Desembarque → Lotes → Pista → Retirada. O catálogo público (/catalogo) mostra os lotes vinculados para os clientes, sem dados pessoais nem valores.

## Acesso e funções
- Login por CPF e senha. Usuários são criados na aba Admin.
- TI: todas as abas e Admin; cria e altera qualquer usuário.
- Administrativo: todas as abas e Admin; não cria nem altera usuários de TI.
- Curral: Fazenda, Desembarque, Lotes, Retirada e Refugos. Não vê Pista, relatório, Admin nem valores do leilão.
- Criador: usuário do vendedor/produtor. Vê apenas a aba Refugos, só com os refugos vinculados a ele (fotos, vídeos, motivo e observações). Não vê refugos de outros criadores nem as demais abas.
- Mudar a função ou desativar alguém vale na hora. Desativar (ou trocar a senha de outra pessoa) encerra as sessões dela.
- Ninguém desativa o próprio usuário nem muda a própria função; sempre fica pelo menos um TI ativo.
- Contas do sistema (definidas no servidor, .env) aparecem com cadeado e não são editadas no painel.

## Fazenda
Cadastro do titular e da propriedade: CPF do titular, nome do titular, telefone/WhatsApp, nome da fazenda (único), nome fantasia e CNPJ (opcionais) e o Criador (usuário do vendedor, opcional). Com o Criador definido, todo refugo dessa fazenda já sai vinculado a ele; na lista de fazendas dá para trocar o Criador, e os refugos da fazenda ainda sem dono passam a ser dele. Os números do topo mostram fazendas, com telefone, com desembarque e cabeças.

## Desembarque
Registra o gado que chegou de cada fazenda (sem número de lote).
- Tipo: Gado normal ou Refugo (animal com problema ou doença). No refugo dá para anexar fotos e vídeos para o proprietário.
- Campos: fazenda, data e hora (preenchidas automaticamente, podem ser alteradas), quantidade de cabeças, sexo/tipo, idade em meses, raça e qualidade (Extra, Bom, Regular...). A categoria (bezerros, garrotes, novilhas, vacas, bois...) é calculada pelo sexo e pela idade.
- Caminhão: motorista, modelo e placa (ABC-1234 ou Mercosul ABC1D23), guardados só para consulta. "Usar o último" repete o caminhão anterior.
- Depois de registrar, o gado fica "Sem lote" até ser vinculado na aba Lotes.

## Refugos (informação sigilosa)
- Refugos (animais com problema) nunca aparecem no catálogo público.
- A equipe (TI, Administrativo e Curral) vê todos os refugos na aba Refugos e escolhe, no select "Criador que pode ver", a qual Criador cada refugo pertence. Também dá para escolher o criador já no Desembarque, ao registrar um refugo.
- Cada Criador vê somente os refugos vinculados a ele; fotos e vídeos de outros refugos ficam bloqueados para ele.
- Para criar um Criador: Admin → Usuários, função Criador.

## Lotes
Quadro de lotes do leilão (40 por padrão, ajustável até 500 em "Adicionar lotes").
- Clique num lote disponível, escolha a fazenda e marque os registros do desembarque dela para vincular.
- Lotes de refugo recebem apenas registros de refugo e não vão para a Pista.
- Desvincular devolve o gado para "Sem lote". Só lotes vinculados aparecem no catálogo.
- Filtros: Todos, Disponíveis, Vinculados, Refugo e busca por número ou fazenda.

## Pista (TI e Administrativo)
Durante o leilão, registra o resultado de cada lote; os dados do desembarque já vêm preenchidos.
- Situações: Aguardando pista, Arrematado (valor, comprador e prazo), Defendido (proposta recebida e valor que o dono queria) e Não arrematado.
- "Salvar e próximo lote" avança na ordem; há filtro e busca de lotes e a listagem completa.
- Lote com retirada registrada não pode sair de Arrematado.
- Relatório de pista pós-leilão: abrir pelo botão de relatório; dá para visualizar e baixar/imprimir em PDF.

## Retirada
O comprador busca o gado arrematado, podendo ser em várias viagens.
- Saldo do lote = cabeças do desembarque − retiradas; nunca fica negativo.
- Registro: data e hora, quantidade (até o saldo, botão "Todo o saldo"), caminhão do comprador (motorista, modelo, placa) e observações.
- Números do topo: desembarcadas, arrematadas, retiradas, saldo a retirar e no recinto agora. "Desfazer" devolve a quantidade ao saldo.

## Admin (TI e Administrativo)
- Usuários: criar (nome, CPF, função, senha com confirmação — mínimo 8 caracteres com letras e números), editar, trocar senha, desativar/reativar, filtrar por função.
- Vídeos do catálogo: enviar, trocar ou remover o vídeo de cada lote (MP4 recomendado, também WEBM e MOV, até 1 GB, sem perder qualidade; a resolução — HD, Full HD, 4K — é detectada). Na Vercel cada envio aceita ~4,5 MB; vídeos maiores precisam de storage externo.

## Personalização
- Tema: botão "Tema" no menu (e botão flutuante no login e no catálogo): Escuro, Claro ou Automático, e cor de destaque Amarelo, Verde, Azul ou Roxo. Fica salvo no navegador.
- Foto de perfil: clique no seu nome no topo → "Adicionar foto de perfil". Arraste ou escolha a imagem, ajuste o recorte circular e o zoom e salve. Sem foto, aparece a primeira letra do nome.
- Sair: menu do usuário no topo ou botão Sair no menu lateral.
`.trim();

// Perguntas prontas (aparecem como atalhos no chat). A resposta local é usada se a IA estiver indisponível.
export const QUICK_QUESTIONS = [
  {
    id: "fluxo",
    q: "Qual é o passo a passo de um leilão aqui?",
    a: "O fluxo é: 1) **Fazenda**: cadastre o titular e a propriedade. 2) **Desembarque**: registre o gado que chegou (quantidade, sexo, idade, raça, qualidade e caminhão). 3) **Lotes**: clique num lote disponível e vincule a fazenda com os registros do desembarque. 4) **Pista**: durante o leilão, marque cada lote como Arrematado, Defendido ou Não arrematado. 5) **Retirada**: registre o comprador buscando o gado até zerar o saldo.",
  },
  {
    id: "desembarque",
    q: "Como registro um desembarque?",
    a: "Na aba **Desembarque**, escolha *Gado normal* ou *Refugo*, selecione a fazenda, confira a data e hora (já vêm preenchidas), informe quantidade, sexo/tipo, idade, raça e qualidade, e preencha o caminhão (motorista, modelo e placa). Clique em **Registrar desembarque**. Depois vincule o gado na aba Lotes.",
  },
  {
    id: "lote",
    q: "Como vinculo um lote a uma fazenda?",
    a: "Na aba **Lotes**, clique num lote marcado como disponível, escolha a fazenda e marque os registros do desembarque que vão nesse lote. Confirme com **Vincular**. Lotes de refugo recebem só registros de refugo. Para desfazer, abra o lote e use **Desvincular**.",
  },
  {
    id: "pista",
    q: "Como registro o resultado na Pista?",
    a: "Na aba **Pista** (TI e Administrativo), selecione o lote, escolha a situação: *Arrematado* (valor, comprador e prazo), *Defendido* (proposta e valor que o dono queria) ou *Não arrematado*. Use **Salvar e próximo lote** para seguir a ordem. O relatório em PDF fica no botão de relatório.",
  },
  {
    id: "retirada",
    q: "Como funciona o saldo da Retirada?",
    a: "O saldo de cada lote arrematado é *cabeças do desembarque − retiradas*. Na aba **Retirada**, abra o lote, informe data e hora, quantidade (ou **Todo o saldo**) e o caminhão do comprador. O saldo nunca fica negativo, e **Desfazer** devolve as cabeças.",
  },
  {
    id: "usuarios",
    q: "Como crio um usuário e escolho a função?",
    a: "Na aba **Admin → Usuários**, preencha nome, CPF, escolha a função (TI, Administrativo ou Curral) e defina a senha (mínimo 8 caracteres, com letras e números). O Curral vê Fazenda, Desembarque, Lotes e Retirada; TI e Administrativo veem tudo. O Administrativo não cria usuários de TI.",
  },
  {
    id: "refugos",
    q: "Como funciona a aba Refugos e o usuário Criador?",
    a: "Refugos são sigilosos e **não aparecem no catálogo**. A equipe (TI, Administrativo e Curral) vê todos na aba **Refugos**. Defina o **Criador** no cadastro da **Fazenda**: os refugos dela já saem vinculados a ele (no Desembarque aparece quem é). Para corrigir um refugo específico, troque o dono no select *Criador que pode ver* do cartão, na aba **Refugos**. O usuário **Criador** (o vendedor) entra no painel e vê só os refugos vinculados a ele, com fotos e vídeos. Crie o Criador em **Admin → Usuários**.",
  },
  {
    id: "video",
    q: "Como coloco o vídeo de um lote no catálogo?",
    a: "Na aba **Admin → Vídeos do catálogo**, encontre o lote e clique em **Enviar vídeo** (MP4 recomendado, até 1 GB). O arquivo é guardado sem perder qualidade e a resolução aparece no cartão. Na Vercel, cada envio aceita ~4,5 MB.",
  },
  {
    id: "tema",
    q: "Como mudo o tema e minha foto?",
    a: "**Tema**: botão *Tema* no menu lateral — escolha Escuro, Claro ou Automático e a cor de destaque. **Foto**: clique no seu nome no topo → *Adicionar foto de perfil*, ajuste o recorte e salve.",
  },
];

// Resposta local aproximada (sem IA): procura a pergunta pronta mais parecida
const norm = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const KEYS = {
  fluxo: ["passo", "fluxo", "comeco", "funciona o leilao", "etapas"],
  desembarque: ["desembarque", "chegou", "caminhao", "refugo", "registrar gado"],
  lote: ["lote", "vincular", "vinculo", "desvincular", "quadro"],
  pista: ["pista", "arremat", "defendido", "relatorio", "lance", "comprador"],
  retirada: ["retirada", "saldo", "buscar", "retirar"],
  usuarios: ["usuario", "funcao", "senha", "curral", "administrativo", "acesso", "permiss"],
  refugos: ["refugo", "criador", "vendedor", "doenca", "sigilo", "dono"],
  video: ["video", "catalogo", "resolucao"],
  tema: ["tema", "cor", "escuro", "claro", "foto", "perfil", "avatar"],
};
export function localAnswer(question) {
  const t = norm(question);
  let best = null;
  let score = 0;
  for (const item of QUICK_QUESTIONS) {
    const s = (KEYS[item.id] || []).filter((k) => t.includes(k)).length;
    if (s > score) { score = s; best = item; }
  }
  return best;
}

// ---------- Resposta sem IA: busca no guia da plataforma ----------
const STOP = new Set("a o as os de da do das dos e em no na nos nas um uma uns umas para por com como que qual quais quando onde eu meu minha voce se ao aos the e o é ser fazer faço faz tem ter posso pode consigo isso esse essa este esta".split(" "));
const words = (t) => norm(t).replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
const stem = (w) => w.replace(/(oes|aes|ais|eis|ns|s|es)$/, "").slice(0, 7);

// seções do guia: título (## ...) + linhas
const SECTIONS = PLATFORM_GUIDE.split(/\n(?=## )/).map((block) => {
  const [first, ...rest] = block.split("\n");
  const title = first.replace(/^#+\s*/, "").trim();
  return { title, lines: rest.map((l) => l.trim()).filter(Boolean) };
}).filter((s) => s.lines.length);

export function smartAnswer(question) {
  const q = words(question).map(stem);
  if (!q.length) return null;
  const quick = localAnswer(question);
  let best = null;
  for (const s of SECTIONS) {
    const titleHits = words(s.title).map(stem).filter((w) => q.includes(w)).length * 3;
    const scored = s.lines.map((l) => ({ l, n: words(l).map(stem).filter((w) => q.includes(w)).length }));
    const total = titleHits + scored.reduce((t, x) => t + x.n, 0);
    if (!best || total > best.total) best = { s, total, scored };
  }
  if (quick && (!best || best.total < 4)) return quick.a;
  if (!best || best.total < 2) return quick?.a ?? null; // pouco relacionado ao guia: não força resposta
  const lines = best.scored.filter((x) => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 5).map((x) => x.l);
  const body = (lines.length ? lines : best.s.lines.slice(0, 5))
    .map((l) => (l.startsWith("-") ? l : `- ${l}`)).join("\n")
    .replace(/(Fazenda|Desembarque|Lotes|Pista|Retirada|Refugos|Admin)(?=[\s,.;:)])/g, "**$1**");
  return `Sobre **${best.s.title}**:\n${body}`;
}
