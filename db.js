/* Cidadania Digital — camada de dados
   Dois modos com a mesma interface:
   - LOCAL (demonstração): tudo salvo no navegador (localStorage).
   - SUPABASE (produção): banco + autenticação do Supabase; o log é gravado por gatilhos no banco. */
(function () {
  const CFG = window.CD_CONFIG || {};
  const USA_SB = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase);

  const apelido = (nome) => {
    const p = String(nome || "").trim().split(/\s+/);
    return p.length > 1 ? `${p[0]} ${p[p.length - 1][0].toUpperCase()}.` : p[0] || "";
  };

  /* ===================== MODO LOCAL ===================== */
  function criarLocal() {
    const ler = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
    const gravar = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    const K = { ad: "cd_adesoes", ct: "cd_conteudo", msg: "cd_mensagens", adm: "cd_admins", log: "cd_log", ses: "cd_sessao" };
    const agora = () => new Date().toISOString();
    const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    async function hash(senha, sal) {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sal + ":" + senha));
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    const sessao = () => sessionStorage.getItem(K.ses);
    function exigirAdmin() {
      const e = sessao(); const a = ler(K.adm, []).find((x) => x.email === e);
      if (!a) throw new Error("Acesso restrito a administradores.");
      return a;
    }
    function registrar(acao, detalhe) {
      const a = exigirAdmin();
      const l = ler(K.log, []); l.unshift({ id: uid(), admin_email: a.email, admin_nome: a.nome, acao, detalhe: detalhe || "", criado_em: agora() });
      gravar(K.log, l);
    }

    return {
      modo: "local",
      apelido,
      conteudo: {
        async get(chave) { return ler(K.ct, {})[chave] ?? null; },
        async set(chave, valor, descricao) { exigirAdmin(); const c = ler(K.ct, {}); c[chave] = valor; gravar(K.ct, c); registrar("Alterou conteúdo", descricao || chave); },
        async remover(chave, descricao) { exigirAdmin(); const c = ler(K.ct, {}); delete c[chave]; gravar(K.ct, c); registrar("Restaurou conteúdo original", descricao || chave); },
      },
      adesoes: {
        async listar() { return ler(K.ad, []).map((a) => ({ uf: a.uf, cidade: a.cidade, lat: a.lat, lng: a.lng, apelido: a.apelido || apelido(a.nome), criado_em: a.created_at })); },
        async inserir(a) {
          const l = ler(K.ad, []);
          if (l.some((x) => x.email && x.email === a.email)) { const e = new Error("duplicado"); e.code = "23505"; throw e; }
          l.push({ ...a, apelido: apelido(a.nome), created_at: agora() }); gravar(K.ad, l);
        },
        existe() { return localStorage.getItem(K.ad) !== null; },
        semear(lista) { gravar(K.ad, lista); },
      },
      mensagens: {
        async enviar(m) { const l = ler(K.msg, []); l.unshift({ id: uid(), ...m, criado_em: agora(), resposta: null }); gravar(K.msg, l); },
        async listar() { exigirAdmin(); return ler(K.msg, []); },
        async responder(id, texto) {
          const a = exigirAdmin(); const l = ler(K.msg, []); const m = l.find((x) => x.id === id);
          if (!m) throw new Error("Mensagem não encontrada.");
          Object.assign(m, { resposta: texto, respondido_por: a.email, respondido_em: agora() }); gravar(K.msg, l);
          registrar("Respondeu mensagem", `De ${m.nome} <${m.email}> — "${m.assunto}"`);
        },
      },
      auth: {
        async atual() { const e = sessao(); const a = ler(K.adm, []).find((x) => x.email === e); return a ? { email: a.email, nome: a.nome } : null; },
        async precisaPrimeiroAdmin() { return ler(K.adm, []).length === 0; },
        async entrar(email, senha) {
          email = email.trim().toLowerCase();
          const a = ler(K.adm, []).find((x) => x.email === email);
          if (!a || !a.hash || (await hash(senha, a.sal)) !== a.hash) throw new Error("E-mail ou senha inválidos.");
          sessionStorage.setItem(K.ses, email); registrar("Entrou no painel", "");
          return { email: a.email, nome: a.nome };
        },
        async primeiroAcesso(nome, email, senha) {
          email = email.trim().toLowerCase();
          const l = ler(K.adm, []); let a = l.find((x) => x.email === email);
          if (!l.length) { a = { email, nome: nome || email, criado_em: agora() }; l.push(a); } // primeiro administrador do site
          else if (!a) throw new Error("Este e-mail não está na lista de administradores. Peça a um administrador para cadastrá-lo.");
          else if (a.hash) throw new Error("Este administrador já criou a senha. Use 'Entrar'.");
          a.sal = uid(); a.hash = await hash(senha, a.sal); if (nome) a.nome = nome;
          gravar(K.adm, l); sessionStorage.setItem(K.ses, email);
          registrar("Criou a senha (primeiro acesso)", "");
          return { email: a.email, nome: a.nome };
        },
        async sair() { try { registrar("Saiu do painel", ""); } catch {} sessionStorage.removeItem(K.ses); },
      },
      admins: {
        async listar() { exigirAdmin(); return ler(K.adm, []).map(({ email, nome, criado_em, hash }) => ({ email, nome, criado_em, ativo: !!hash })); },
        async adicionar(nome, email) {
          exigirAdmin(); email = email.trim().toLowerCase(); const l = ler(K.adm, []);
          if (l.some((x) => x.email === email)) throw new Error("Este e-mail já é administrador.");
          l.push({ email, nome, criado_em: agora() }); gravar(K.adm, l); registrar("Adicionou administrador", `${nome} <${email}>`);
        },
        async remover(email) {
          const eu = exigirAdmin(); if (eu.email === email) throw new Error("Você não pode remover a si mesmo.");
          const l = ler(K.adm, []); const a = l.find((x) => x.email === email);
          gravar(K.adm, l.filter((x) => x.email !== email)); registrar("Removeu administrador", `${a ? a.nome : ""} <${email}>`);
        },
      },
      log: { async listar() { exigirAdmin(); return ler(K.log, []); } },
    };
  }

  /* ===================== MODO SUPABASE ===================== */
  function criarSupabase() {
    const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
    const ok = ({ data, error }) => { if (error) throw error; return data; };
    let cache = null;
    async function atual() {
      const { data } = await sb.auth.getSession();
      const email = data.session?.user?.email; if (!email) return (cache = null);
      const a = ok(await sb.from("admins").select("email,nome").eq("email", email).maybeSingle());
      return (cache = a || null);
    }
    const registrar = async (acao, detalhe) => { await sb.from("admin_log").insert({ acao, detalhe: detalhe || "" }); };
    return {
      modo: "supabase",
      apelido,
      conteudo: {
        async get(chave) { const d = ok(await sb.from("configuracoes").select("valor").eq("chave", chave).maybeSingle()); return d ? d.valor : null; },
        async set(chave, valor) { ok(await sb.from("configuracoes").upsert({ chave, valor })); },
        async remover(chave) { ok(await sb.from("configuracoes").delete().eq("chave", chave)); },
      },
      adesoes: {
        async listar() { return ok(await sb.from("adesoes_publicas").select("uf,cidade,lat,lng,apelido,criado_em").limit(200000)); },
        async inserir(a) { ok(await sb.from("adesoes").insert(a)); },
        existe() { return true; }, semear() {},
      },
      mensagens: {
        async enviar(m) { ok(await sb.from("mensagens").insert(m)); },
        async listar() { return ok(await sb.from("mensagens").select("*").order("criado_em", { ascending: false })); },
        async responder(id, texto) { ok(await sb.from("mensagens").update({ resposta: texto }).eq("id", id)); },
      },
      auth: {
        atual,
        async precisaPrimeiroAdmin() { return false; }, // o primeiro administrador é cadastrado via SQL (ver supabase/schema.sql)
        async entrar(email, senha) {
          ok(await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha }));
          const a = await atual(); if (!a) { await sb.auth.signOut(); throw new Error("Acesso restrito a administradores."); }
          await registrar("Entrou no painel", ""); return a;
        },
        async primeiroAcesso(nome, email, senha) {
          ok(await sb.auth.signUp({ email: email.trim().toLowerCase(), password: senha, options: { data: { nome } } }));
          const a = await atual();
          if (!a) throw new Error("Cadastro criado. Confirme pelo link enviado ao seu e-mail e depois clique em 'Entrar'. (Só funciona para e-mails cadastrados como administradores.)");
          return a;
        },
        async sair() { try { await registrar("Saiu do painel", ""); } catch {} await sb.auth.signOut(); },
      },
      admins: {
        async listar() { return ok(await sb.from("admins").select("email,nome,criado_em")).map((a) => ({ ...a, ativo: null })); },
        async adicionar(nome, email) { ok(await sb.from("admins").insert({ nome, email: email.trim().toLowerCase() })); },
        async remover(email) { if (cache && cache.email === email) throw new Error("Você não pode remover a si mesmo."); ok(await sb.from("admins").delete().eq("email", email)); },
      },
      log: { async listar() { return ok(await sb.from("admin_log").select("*").order("criado_em", { ascending: false }).limit(2000)); } },
    };
  }

  window.DB = USA_SB ? criarSupabase() : criarLocal();
})();
