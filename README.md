# Mel — Aventuras da Bíblia

Portal infantil com dez jogos bíblicos, modos locais contra o computador, progresso salvo no navegador e um Guia Bíblico opcional por IA.

## Site online

Produção: [melynda.pages.dev](https://melynda.pages.dev/)

## Executar e validar

Requer Node.js 20 ou superior.

```powershell
npm ci
npm run check
npm test
npm run build
npm run verify:startup
npm run verify:ui
```

## Publicação na Cloudflare Pages

Conecte este repositório à Cloudflare Pages com:

- branch de produção: `main`;
- comando de build: `npm run build`;
- diretório de saída: `dist`;
- diretório raiz: a raiz do repositório.

O diretório `functions/` publica o endpoint `/api/bible-guide`. A Cloudflare fornece o fallback das rotas da SPA quando não existe um `404.html` na raiz do build.

Supabase não é usado: o jogo não possui conta, banco compartilhado ou dados remotos. Nome, avatar, preferências e pontuações permanecem no `localStorage` do próprio navegador.

## Guia Bíblico opcional

Todos os jogos funcionam sem chave externa. Para ativar as respostas por IA em produção, adicione em **Workers & Pages → projeto → Settings → Variables and Secrets**:

- `GROQ_API_KEY` como **Secret**;
- `GROQ_MODEL` como variável opcional (padrão: `openai/gpt-oss-20b`).

Nunca grave a chave em arquivo versionado, variável `VITE_*`, screenshot ou log. Depois de cadastrar o Secret, faça uma nova implantação e confira `/api/bible-guide/status`.
