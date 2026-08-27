# Mel — Aventuras da Bíblia

Portal infantil com dez jogos bíblicos, modos locais contra o computador, progresso salvo no navegador, Guia Bíblico nos jogos e um Devocional personalizado por IA.

## Site online

Produção: [melynda.pages.dev](https://melynda.pages.dev/)

Devocional: [melynda.pages.dev/devocional](https://melynda.pages.dev/devocional)

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

O modo online usa Supabase com autenticação anônima, presença por atividade, convites privados, grupos de até oito pessoas e regras RLS. Somente um apelido validado e o avatar escolhido são enviados ao Supabase depois da confirmação para entrar no Online. Os outros jogadores veem esse apelido e se a pessoa está no saguão, em um grupo ou em um jogo.

O chat geral aceita apenas frases prontas aprovadas. Texto livre e áudio de até dez segundos existem somente em uma partida entre dois jogadores ou em um grupo fechado por convite. Essas mensagens deixam de ficar disponíveis após 24 horas e são limpas do banco durante a atividade online seguinte. Áudio não toca automaticamente. Bloqueio e denúncia estão disponíveis nas salas e nos grupos; convites de grupo só podem ser enviados pelo dono. Pontuações, preferências e o histórico do Devocional permanecem no `localStorage` do próprio navegador.

Configure no build de produção as variáveis públicas `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. O microfone começa desligado e exige confirmação explícita. A chamada ao vivo usa WebRTC direto; redes que bloqueiam conexões diretas podem exigir um serviço TURN para cobertura completa. A mensagem curta de áudio é a opção mais previsível e privada do produto atual.

## Guia Bíblico e Devocional por IA

Todos os jogos funcionam sem chave externa. As respostas do Guia e do Devocional usam uma chave protegida no servidor. Para ativá-las em produção, adicione em **Workers & Pages → projeto → Settings → Variables and Secrets**:

- `GROQ_API_KEY` como **Secret**;
- `GROQ_MODEL` como variável opcional (padrão: `openai/gpt-oss-20b`).

Nunca grave a chave em arquivo versionado, variável `VITE_*`, screenshot ou log. Depois de cadastrar o Secret, faça uma nova implantação e confira `/api/bible-guide/status`.

O prompt de produção orienta a IA a responder em português brasileiro, com linguagem infantil, perspectiva cristocêntrica, emojis amigáveis e a NTLH como referência preferencial. As perguntas aceitam até 1.000 caracteres, e o Devocional organiza conversas e anotações separadas no navegador.
