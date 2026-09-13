# Instruções do projeto — Mel: Aventuras da Bíblia

## Idioma e comunicação

- Responda sempre em português do Brasil (pt-BR), salvo pedido explícito em outro idioma.
- Explique termos técnicos em linguagem simples na primeira vez que aparecerem.
- Antes de executar mudanças, diga em uma frase o resultado esperado; depois informe arquivos alterados, validações executadas e pendências.
- Não peça confirmação repetida para ações já autorizadas pelo usuário nesta sessão.

## Forma de trabalhar

- Faça uma auditoria objetiva antes de alterar código.
- Preserve o escopo infantil, bíblico, seguro e acessível do produto.
- Após mudanças em JavaScript, TypeScript, CSS ou dados, execute `npm test -- --run` e `npm run build`.
- Para mudanças de interface, execute também `npm run verify:ui` quando o ambiente permitir.
- Para multiplayer, execute também `npm run verify:online` quando o ambiente permitir.
- Relate falhas reproduzíveis com arquivo, linha aproximada, causa e correção aplicada.
- Não declare uma melhoria como concluída sem validação.

## Prioridades do produto

1. Funcionamento correto dos jogos e do multiplayer.
2. Segurança e privacidade infantil.
3. Acessibilidade em teclado, toque e leitores de tela.
4. Responsividade e clareza visual.
5. Desempenho, manutenção e documentação.
