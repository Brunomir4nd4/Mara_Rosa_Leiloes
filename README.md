# Mara_Rosa_Leiloes

Catálogo público de lotes + painel do leiloeiro com login por CPF e senha (Next.js + React + MongoDB, JavaScript).

```bash
cp .env.example .env.local   # preencha AUTH_SECRET, ADMIN_ACCOUNTS e MONGODB_URI
npm install
npm run dev
```

Para conferir a conexão com o banco: `GET /api/health`.

> Atenção: variáveis definidas no sistema operacional têm prioridade sobre o `.env.local`.
> Se a sua máquina já tiver uma `MONGODB_URI` global (de outro projeto), o Next.js vai usá-la.

## Contas do painel

Cada leiloeiro entra com CPF + senha. A senha nunca fica em texto puro: guardamos só o hash (scrypt).

- A sessão fica registrada no banco (coleção `sessions`): **Sair** encerra de verdade, e tirar um CPF de `ADMIN_ACCOUNTS` corta o acesso na hora.
- A sessão dura 8 horas sem uso: enquanto a pessoa usa o painel, ela é renovada sozinha. Trocar a própria senha encerra as outras sessões dela.
- Limite de tentativas de login, guardado no banco (`login_attempts`): 8 falhas a cada 15 min bloqueiam o par **CPF + IP**. Muitas falhas no mesmo CPF (de qualquer lugar) ou no mesmo IP não bloqueiam — só deixam a resposta mais lenta (até alguns segundos), para ninguém travar a conta de outra pessoa nem o Wi-Fi do leilão. O IP só é confiável atrás da Vercel.

```bash
npm run hash-senha   # pede CPF e senha e imprime a linha para o ADMIN_ACCOUNTS
```

Cole a linha em `ADMIN_ACCOUNTS` no `.env.local` (várias contas separadas por vírgula) e reinicie o servidor.
Essas são as **contas do sistema** (função TI): garantem acesso mesmo com o banco vazio. Os demais usuários são criados no painel.

### Usuários e funções (aba Admin)

| Função | Abas | Observações |
| --- | --- | --- |
| **TI** | Todas, inclusive Admin | Cria e altera qualquer usuário |
| **Administrativo** | Todas, inclusive Admin | Não cria nem altera usuários de TI |
| **Curral** | Fazenda, Desembarque, Lotes, Retirada e Refugos | Sem Pista, relatório, Admin e valores do leilão |
| **Criador** | Só Refugos | Vendedor/produtor: vê apenas os refugos vinculados a ele (fotos e vídeos inclusive) |

- A função é conferida no servidor a cada requisição: mudar a função ou desativar alguém vale na hora (desativar e trocar a senha de outra pessoa encerra as sessões dela).
- Ninguém desativa o próprio usuário nem muda a própria função, e sempre fica pelo menos um TI ativo.
- **Refugos são sigilosos**: nunca aparecem no catálogo. Cada refugo sai vinculado ao Criador cadastrado na fazenda (aba Fazenda; o Desembarque só mostra quem é), e a equipe pode trocar o Criador de um refugo pelo select do cartão na aba Refugos; cada Criador vê só os seus, e os anexos de outros ficam bloqueados para ele.
- Os vídeos do catálogo são enviados por lote em **Admin → Vídeos do catálogo** (MP4/WEBM/MOV, até 1 GB, sem recompressão).

### Chat interno

Aba **Chat** para todos os usuários (inclusive Criador), no estilo WhatsApp e em tela cheia:
- Grupo **Geral** com toda a equipe, **grupos** e conversas individuais com qualquer usuário ativo (nome e função aparecem nas mensagens).
- **Grupos**: só TI e Administrativo criam e editam (nome, foto, adicionar/remover participantes). Qualquer participante pode sair. As mudanças aparecem como mensagens do sistema ("Ana criou o grupo…").
- Texto, fotos (reduzidas no navegador para até 1920 px) e vídeos (até 100 MB; na Vercel cada envio aceita ~4,5 MB).
- **Responder** (citação da mensagem; clicar leva até a original), **encaminhar** para até 5 conversas (marca "Encaminhada"), copiar e apagar a própria mensagem. Menu pela setinha, botão direito ou toque longo no celular.
- **Status no padrão WhatsApp**: ✓ enviada, ✓✓ cinza entregue a todos, ✓✓ azul lida por todos. Em **Dados da mensagem** o autor vê quem leu e quem recebeu, com horário.
- Online/offline e "visto por último", "digitando…", não lidas no menu, no título da aba e numa bolinha vermelha no ícone da aba (favicon).
- **Notificações do navegador** (botão "Ativar notificações" no chat) e um som curto quando chega mensagem nova com o painel aberto em outra aba ou seção. Clicar na notificação abre a conversa. Exige HTTPS (ou localhost).
- Conversas e seus arquivos são vistos só pelos participantes (`/api/chat/file` confere o acesso, inclusive em mensagens encaminhadas e na foto do grupo; a rota de mídia administrativa não entrega arquivos do chat).
- Atualização por consulta periódica (lista a cada 6 s, conversa aberta a cada 2,5 s). Coleções: `chats`, `messages` (entrega/leitura por pessoa em `dlv`/`rd`), `chat_presence`.

### Assistente Mara Rosa Leilões

O botão do emblema no canto do painel abre o assistente: perguntas prontas e perguntas livres sobre a plataforma.
- Responde com base no conhecimento da própria plataforma (`lib/assistant-brain.js` e `lib/assistant-knowledge.js`), sem API externa e sem enviar dados para fora.
- Considera a função de quem pergunta (ex.: explica que o Curral não acessa a Pista). Assuntos fora da plataforma recebem uma mensagem padrão que orienta o que ele sabe fazer.
- Para ensinar algo novo, acrescente um assunto em `INTENTS` (palavras-chave + resposta).

## Rotas

| Rota | Acesso | O que faz |
| --- | --- | --- |
| `/` | público | Leva ao login (ou ao painel, se já houver sessão) |
| `/catalogo` | público | Catálogo de lotes com filtros (sexo, categoria, qualidade, raça) |
| `/login` | público | Login por CPF + senha (contas em `ADMIN_ACCOUNTS`) |
| `/painel` | logado | Fazenda, Desembarque, Lotes, Pista, Retirada e Admin, conforme a função (tema claro/escuro e cor de destaque no menu) |
| `/painel/relatorio` | TI e Administrativo | Relatório de pista pós-leilão (visualizar / baixar PDF) |
| `/api/admin/*` | logado | API do painel (fazendas, desembarques, lotes, pista, quantidade de lotes) |
| `/api/health` | público | Verifica a conexão com o MongoDB |

## Fluxo do painel

1. **Fazenda** – cadastra a fazenda e o titular.
2. **Desembarque** – registra o gado que chegou de cada fazenda (sem número de lote). A categoria (bezerros, garrotes, novilhas…) é calculada pelo sexo + idade.
3. **Lotes** – quadro de lotes (40 por padrão, ajustável no painel até 500). Clique em um lote disponível, escolha a fazenda e marque os registros do desembarque dela. Só lotes vinculados aparecem no catálogo público.
4. **Pista** – durante o leilão, registra o resultado de cada lote (arrematado, defendido, não arrematado) com valor, comprador, prazo, proposta e valor pretendido. Lotes de refugo não entram na pista.
5. **Retirada** – o comprador busca o gado arrematado (pode ser em várias viagens). Saldo do lote = cabeças do desembarque − retiradas; nunca fica negativo. Registra data/hora e o caminhão de saída.

O desembarque guarda também o caminhão que trouxe o gado (motorista, modelo e placa).

## Dados (MongoDB)

Coleções: `farms`, `entries` (desembarque), `lots` (com o resultado da pista), `settings` (quantidade de lotes), `users` (usuários do painel), `pickups` (retiradas), `sessions`, `login_attempts` e o bucket GridFS `media` (fotos e vídeos).

- O catálogo nunca recebe CPF, CNPJ, titular, comprador ou valores: só os dados do lote e o nome da fazenda.
- Fotos e vídeos ficam no próprio MongoDB (GridFS), não no disco do servidor. Anexos do desembarque são privados (só com login).
- Quem usava a versão antiga (arquivo `data/db.json`) pode importar os dados uma vez: `npm run importar-dados-locais`.
- Arquivos que ficaram no disco (`data/media`, `data/videos`) vão para o banco com: `npm run migrar-arquivos`.

> **Vercel:** cada requisição tem limite de ~4,5 MB. Fotos comuns passam; vídeos maiores precisam de envio direto
> do navegador para um storage (Vercel Blob ou S3) — isso exige criar o storage e o token na conta da Vercel.
