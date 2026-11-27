# Mara_Rosa_Leiloes

Catálogo público de lotes + painel do leiloeiro com login por CPF (Next.js + React, JavaScript).

```bash
cp .env.example .env.local   # preencha AUTH_SECRET e ADMIN_ACCOUNTS
npm install
npm run dev
```

## Contas do painel

Cada leiloeiro entra com CPF + senha. A senha nunca fica em texto puro: guardamos só o hash (scrypt).

```bash
npm run hash-senha   # pede CPF e senha e imprime a linha para o ADMIN_ACCOUNTS
```

Cole a linha em `ADMIN_ACCOUNTS` no `.env.local` (várias contas separadas por vírgula) e reinicie o servidor.

## Rotas

| Rota | Acesso | O que faz |
| --- | --- | --- |
| `/` | público | Catálogo de lotes com vídeo e filtros (sexo, qualidade, raça, só com vídeo) |
| `/login` | público | Login por CPF + senha (contas em `ADMIN_ACCOUNTS`) |
| `/painel` | logado | Fazendas, Desembarque (gado que chegou) e Lotes (mapa de currais para vincular fazenda + gado) |

## Fluxo do painel

1. **Fazenda** – cadastra a fazenda e o titular.
2. **Desembarque** – registra o gado que chegou de cada fazenda (sem número de lote). A categoria (bezerros, garrotes, novilhas…) é calculada pelo sexo + idade.
3. **Lotes** – mapa com `TOTAL_LOTS` lotes (em `lib/catalog.js`). Clique em um lote livre, escolha a fazenda e marque os registros do desembarque dela. Só lotes vinculados aparecem no catálogo público.

## Dados

- Fazendas, desembarques e lotes ficam em `data/db.json`; vídeos em `data/videos/` (pasta fora do git).
- Vídeos: a rota de envio (`/api/admin/lots/[id]/video`) continua pronta para o futuro admin de vídeos; o painel não tem mais esse campo.
- O catálogo nunca recebe CPF, CNPJ ou nome do titular: só os dados do lote e o nome da fazenda.

> Simplificação: o armazenamento em arquivo funciona para um único servidor. Para produção, troque `lib/db.js` por MongoDB e os vídeos por um storage (S3, R2…).
