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

Coleções: `farms`, `entries` (desembarque), `lots` (com o resultado da pista) e `settings` (quantidade de lotes).

- O catálogo nunca recebe CPF, CNPJ, titular, comprador ou valores: só os dados do lote e o nome da fazenda.
- Vídeos ficam em `data/videos/` (fora do git). A rota de envio (`/api/admin/lots/[id]/video`) está pronta para o futuro admin de vídeos.
- Quem usava a versão antiga (arquivo `data/db.json`) pode importar os dados uma vez: `npm run importar-dados-locais`.
