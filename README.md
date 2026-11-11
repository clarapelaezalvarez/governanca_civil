# Cidadania Digital — site (versão de demonstração)

Site estático (HTML/CSS/JS), pronto para GitHub + Vercel, com Supabase opcional.

## Rodar localmente
Dê dois cliques em `iniciar.bat` (ou rode `python -m http.server 8080` nesta pasta) e abra http://localhost:8080

No modo demonstração (sem Supabase configurado):
- As adesões ficam salvas no navegador e o mapa vem com **dados fictícios de exemplo**.
  Para zerar: no console do navegador, `localStorage.clear()` e recarregue.
- O e-mail de agradecimento **não é enviado** (só o texto pode ser editado na janela "Editar texto do e-mail").

## Seções
1. **Manifesto interativo** — clique em qualquer frase destacada para enviá-la no WhatsApp ou X.
2. **Abaixo-assinado com mapa** — nome, e-mail, estado e cidade (listas); cada adesão acende um ponto.
3. **Pressione seu Representante** — CEP (ViaCEP) ou estado → deputados federais (API da Câmara) → e-mail/tuíte/WhatsApp padronizado.
4. **Projetos Piloto** — prova de conceito em abas + download da apresentação PPT.

## Produção
1. Criar projeto no Supabase e rodar `supabase/schema.sql` no SQL Editor.
2. Preencher `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SITE_URL` em `config.js`.
3. Envio de e-mail: criar uma Edge Function / Database Webhook no Supabase (ex.: com Resend) disparada no insert de `adesoes`, lendo o texto em `configuracoes.email_agradecimento`.
4. Restringir a edição do texto do e-mail a administradores (login Supabase).
5. Subir para o GitHub e importar o repositório na Vercel (sem build: "Other").
