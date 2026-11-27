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
- O limite de tentativas de login vale **por CPF** (8 a cada 15 min) e por IP, guardado no banco (`login_attempts`).

```bash
npm run hash-senha   # pede CPF e senha e imprime a linha para o ADMIN_ACCOUNTS
```

Cole a linha em `ADMIN_ACCOUNTS` no `.env.local` (várias contas separadas por vírgula) e reinicie o servidor.

## Rotas

| Rota | Acesso | O que faz |
| --- | --- | --- |
| `/` | público | Catálogo de lotes com filtros (sexo, categoria, qualidade, raça) |
| `/login` | público | Login por CPF + senha (contas em `ADMIN_ACCOUNTS`) |
| `/painel` | logado | Fazenda, Desembarque, Lotes e Pista |
| `/painel/relatorio` | logado | Relatório de pista pós-leilão (visualizar / baixar PDF) |
| `/api/admin/*` | logado | API do painel (fazendas, desembarques, lotes, pista, quantidade de lotes) |
| `/api/health` | público | Verifica a conexão com o MongoDB |

## Fluxo do painel

1. **Fazenda** – cadastra a fazenda e o titular.
2. **Desembarque** – registra o gado que chegou de cada fazenda (sem número de lote). A categoria (bezerros, garrotes, novilhas…) é calculada pelo sexo + idade.
3. **Lotes** – quadro de lotes (40 por padrão, ajustável no painel até 500). Clique em um lote disponível, escolha a fazenda e marque os registros do desembarque dela. Só lotes vinculados aparecem no catálogo público.
4. **Pista** – durante o leilão, registra o resultado de cada lote (arrematado, defendido, não arrematado) com valor, comprador, prazo, proposta e valor pretendido.

## Dados (MongoDB)

Coleções: `farms`, `entries` (desembarque), `lots` (com o resultado da pista), `settings` (quantidade de lotes), `sessions`, `login_attempts` e o bucket GridFS `media` (fotos e vídeos).

- O catálogo nunca recebe CPF, CNPJ, titular, comprador ou valores: só os dados do lote e o nome da fazenda.
- Fotos e vídeos ficam no próprio MongoDB (GridFS), não no disco do servidor. Anexos do desembarque são privados (só com login).
- Quem usava a versão antiga (arquivo `data/db.json`) pode importar os dados uma vez: `npm run importar-dados-locais`.
- Arquivos que ficaram no disco (`data/media`, `data/videos`) vão para o banco com: `npm run migrar-arquivos`.

> **Vercel:** cada requisição tem limite de ~4,5 MB. Fotos comuns passam; vídeos maiores precisam de envio direto
> do navegador para um storage (Vercel Blob ou S3) — isso exige criar o storage e o token na conta da Vercel.
