# painelgestaoprojeto

Projeto de backend e frontend para ingestão de issues Jira/CSV com Supabase.

## Estrutura do projeto

- `backend/` — servidor Node + Express.
- `frontend/` — UI estática para cadastro de cliente, projeto, POD e upload.
- `scripts/` — utilitários de seed e ingestão.
- `.env.example` — variáveis de ambiente.

## Instalação

1. Copie `.env.example` para `.env`.
2. Preencha as variáveis com sua URL Supabase e as chaves.
3. Instale dependências:

```powershell
npm install
```

4. Inicie o servidor:

```powershell
npm start
```

5. Abra `http://localhost:3000` no navegador.

## Uso

- Crie um cliente.
- Crie um projeto.
- Crie um POD.
- Faça upload de CSV/Excel.
- Crie value streams.

## Scripts úteis

- `npm run dev` — inicia com `nodemon`.
- `npm run seed` — insere dados de teste no Supabase.
- `npm run ingest <csv-file> <client-id> <pod-id>` — ingere CSV via script.
