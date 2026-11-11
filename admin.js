/* Cidadania Digital — painel administrativo (acesse pelo endereço do site + #admin) */
(function () {
  const CFG = window.CD_CONFIG || {};
  const DB = window.DB, CD = window.CD, esc = CD.esc;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const dataHora = (iso) => iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "";
  const msgEm = (sel, txt, tipo) => { const el = $(sel); el.className = "msg " + (tipo || ""); el.textContent = txt; };
  let usuario = null, modoLogin = "entrar";

  /* ---------- Exibir a seção somente em #admin ---------- */
  function rotear() {
    const ver = location.hash === "#admin";
    $("#admin").hidden = !ver;
    if (ver) { iniciar(); setTimeout(() => $("#admin").scrollIntoView({ behavior: "smooth" }), 50); }
  }
  window.addEventListener("hashchange", rotear);

  async function iniciar() {
    usuario = await DB.auth.atual().catch(() => null);
    if (usuario) return mostrarPainel();
    $("#adminPainel").hidden = true; $("#adminLogin").hidden = false;
    setModo((await DB.auth.precisaPrimeiroAdmin()) ? "setup" : "entrar");
  }

  /* ---------- Login / primeiro acesso ---------- */
  function setModo(m) {
    modoLogin = m;
    const t = { entrar: ["Entrar", "Use o e-mail e a senha cadastrados.", "Entrar", "Primeiro acesso? Criar minha senha"],
      primeiro: ["Primeiro acesso", "Seu e-mail precisa ter sido cadastrado por um administrador. Crie uma senha com pelo menos 8 caracteres.", "Criar senha e entrar", "Já tenho senha — Entrar"],
      setup: ["Criar o primeiro administrador", "Ainda não há administradores. Cadastre-se: você será o primeiro e poderá adicionar os demais.", "Criar administrador", ""] }[m];
    $("#loginTitulo").textContent = t[0]; $("#loginDica").textContent = t[1]; $("#btnLogin").textContent = t[2];
    $("#btnPrimeiroAcesso").textContent = t[3]; $("#btnPrimeiroAcesso").hidden = !t[3];
    $("#lblNomeAdmin").hidden = m === "entrar";
    $("#formLogin").senha.autocomplete = m === "entrar" ? "current-password" : "new-password";
    msgEm("#msgLogin", "");
  }
  $("#btnPrimeiroAcesso").addEventListener("click", () => setModo(modoLogin === "entrar" ? "primeiro" : "entrar"));
  $("#formLogin").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target; msgEm("#msgLogin", "Aguarde…");
    try {
      usuario = modoLogin === "entrar" ? await DB.auth.entrar(f.email.value, f.senha.value) : await DB.auth.primeiroAcesso(f.nome.value.trim(), f.email.value, f.senha.value);
      f.reset(); mostrarPainel();
    } catch (err) { msgEm("#msgLogin", err.message || "Não foi possível entrar.", "erro"); }
  });
  $("#btnSair").addEventListener("click", async () => { await DB.auth.sair(); usuario = null; iniciar(); });

  /* ---------- Painel ---------- */
  function mostrarPainel() {
    $("#adminLogin").hidden = true; $("#adminPainel").hidden = false;
    $("#adminNome").textContent = usuario.nome || usuario.email;
    abrirAba($(".aba.ativa", $("#abasAdmin")).dataset.adm);
    contarPendentes();
  }
  $$("#abasAdmin .aba").forEach((b) => b.addEventListener("click", () => abrirAba(b.dataset.adm)));
  function abrirAba(nome) {
    $$("#abasAdmin .aba").forEach((x) => x.classList.toggle("ativa", x.dataset.adm === nome));
    $$(".painel-adm").forEach((x) => x.classList.toggle("ativo", x.id === "adm-" + nome));
    ({ conteudo: carregarConteudo, mensagens: carregarMsgs, admins: carregarAdmins, log: carregarLog })[nome]();
  }

  /* ---------- Conteúdo: e-mail de agradecimento ---------- */
  async function carregarConteudo() { $("#txtEmail").value = (await DB.conteudo.get("email_agradecimento")) || CFG.EMAIL_PADRAO; }
  $("#btnRestaurarEmail").addEventListener("click", () => { $("#txtEmail").value = CFG.EMAIL_PADRAO; msgEm("#msgEmail", "Texto padrão carregado. Clique em Salvar para confirmar."); });
  $("#btnSalvarEmail").addEventListener("click", async () => {
    const v = $("#txtEmail").value.trim(); if (!v) return msgEm("#msgEmail", "O texto não pode ficar vazio.", "erro");
    try { await DB.conteudo.set("email_agradecimento", v, "E-mail de agradecimento"); msgEm("#msgEmail", "✅ Texto salvo.", "ok"); }
    catch (err) { msgEm("#msgEmail", err.message, "erro"); }
  });

  /* ---------- Conteúdo: edição do manifesto ---------- */
  const area = $("#manifestoConteudo"), barra = $("#barraEdicao");
  let htmlAntes = "", restaurado = false;
  $("#btnEditarManifesto").addEventListener("click", () => {
    htmlAntes = area.innerHTML; restaurado = false;
    document.body.classList.add("editando");
    area.contentEditable = "true"; barra.hidden = false;
    $("#manifesto").scrollIntoView({ behavior: "smooth" });
  });
  function sairEdicao() { document.body.classList.remove("editando"); area.contentEditable = "false"; barra.hidden = true; }
  function selecaoNoManifesto() {
    const s = getSelection(); if (!s.rangeCount) return null;
    const r = s.getRangeAt(0); return area.contains(r.commonAncestorContainer) ? r : null;
  }
  barra.addEventListener("mousedown", (e) => { if (e.target.closest("button")) e.preventDefault(); }); // mantém a seleção do texto
  barra.addEventListener("click", async (e) => {
    const b = e.target.closest("button"); if (!b) return;
    const cmd = b.dataset.cmd, r = selecaoNoManifesto();
    if (cmd === "frase") {
      if (!r || r.collapsed) return alert("Selecione com o mouse (ou o dedo) o trecho que poderá ser compartilhado.");
      const span = document.createElement("span"); span.className = "frase";
      span.appendChild(r.extractContents());
      span.querySelectorAll(".frase").forEach((x) => (x.tagName === "SPAN" ? x.replaceWith(...x.childNodes) : x.classList.remove("frase")));
      r.insertNode(span); getSelection().removeAllRanges();
    } else if (cmd === "desmarcar") {
      const no = r && (r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement);
      const f = no && no.closest(".frase");
      if (!f || !area.contains(f)) return alert("Clique dentro de um trecho destacado para remover a marcação.");
      if (f.tagName === "SPAN") f.replaceWith(...f.childNodes); else f.classList.remove("frase", "destaque", "grande");
    } else if (cmd === "bold") document.execCommand("bold");
    else if (cmd === "h3" || cmd === "p") document.execCommand("formatBlock", false, cmd);
    else if (cmd === "restaurar") {
      if (confirm("Voltar ao texto original do manifesto? (Só será aplicado ao clicar em Salvar.)")) { area.innerHTML = CD.MANIFESTO_ORIGINAL; restaurado = true; }
    } else if (cmd === "cancelar") { area.innerHTML = htmlAntes; sairEdicao(); }
    else if (cmd === "salvar") {
      try {
        const limpo = CD.sanitizar(area.innerHTML);
        const nFrases = (limpo.match(/class="[^"]*frase/g) || []).length;
        if (restaurado && limpo === CD.sanitizar(CD.MANIFESTO_ORIGINAL)) await DB.conteudo.remover("manifesto_html", "Manifesto");
        else await DB.conteudo.set("manifesto_html", limpo, `Manifesto (${nFrases} trechos compartilháveis)`);
        area.innerHTML = limpo; sairEdicao();
        alert("✅ Manifesto salvo!");
      } catch (err) { alert("Erro ao salvar: " + err.message); }
    }
  });

  /* ---------- Mensagens ---------- */
  async function contarPendentes() {
    try { const n = (await DB.mensagens.listar()).filter((m) => !m.resposta).length; $("#badgeMsgs").textContent = n || ""; } catch {}
  }
  $("#filtroMsgs").addEventListener("change", carregarMsgs);
  async function carregarMsgs() {
    const filtro = $("#filtroMsgs").value;
    let l = await DB.mensagens.listar();
    if (filtro === "pendentes") l = l.filter((m) => !m.resposta);
    if (filtro === "respondidas") l = l.filter((m) => m.resposta);
    $("#listaMsgs").innerHTML = l.length ? l.map((m) => `
      <article class="msg-card ${m.resposta ? "respondida" : ""}" data-id="${esc(m.id)}">
        <header><strong>${esc(m.nome)}</strong> &lt;${esc(m.email)}&gt; <span class="chip">${esc(m.assunto)}</span><time>${dataHora(m.criado_em)}</time></header>
        <p class="texto">${esc(m.texto)}</p>
        ${m.resposta
          ? `<div class="resposta"><small>Respondida por ${esc(m.respondido_por)} em ${dataHora(m.respondido_em)}</small><p>${esc(m.resposta)}</p></div>`
          : `<textarea rows="3" placeholder="Escreva a resposta…"></textarea>
             <div class="dlg-acoes"><button class="btn btn-mini" data-resp>Salvar resposta e abrir no e-mail</button></div>`}
      </article>`).join("") : '<p class="pequeno">Nenhuma mensagem.</p>';
    contarPendentes();
  }
  $("#listaMsgs").addEventListener("click", async (e) => {
    if (!e.target.matches("[data-resp]")) return;
    const card = e.target.closest(".msg-card"), texto = $("textarea", card).value.trim();
    if (!texto) return alert("Escreva a resposta.");
    try {
      const m = (await DB.mensagens.listar()).find((x) => String(x.id) === card.dataset.id);
      await DB.mensagens.responder(m.id, texto);
      location.href = `mailto:${m.email}?subject=${encodeURIComponent("Re: " + m.assunto + " — Cidadania Digital")}&body=${encodeURIComponent(`Olá, ${m.nome}!\n\n${texto}\n\n— Equipe Cidadania Digital\n\n> Sua mensagem: ${m.texto}`)}`;
      carregarMsgs();
    } catch (err) { alert(err.message); }
  });

  /* ---------- Administradores ---------- */
  async function carregarAdmins() {
    const l = await DB.admins.listar();
    $("#listaAdmins").innerHTML = `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Nome</th><th>E-mail</th><th>Situação</th><th>Desde</th><th></th></tr></thead><tbody>` +
      l.map((a) => `<tr><td>${esc(a.nome)}</td><td>${esc(a.email)}</td><td>${a.ativo === false ? "Aguardando 1º acesso" : "Ativo"}</td><td>${dataHora(a.criado_em)}</td>
        <td>${a.email === usuario.email ? "<small>(você)</small>" : `<button class="btn btn-sec btn-mini" data-rem="${esc(a.email)}">Remover</button>`}</td></tr>`).join("") + "</tbody></table></div>";
  }
  $("#formNovoAdmin").addEventListener("submit", async (e) => {
    e.preventDefault(); const f = e.target;
    try { await DB.admins.adicionar(f.nome.value.trim(), f.email.value); f.reset(); msgEm("#msgAdmins", "✅ Administrador adicionado. Avise a pessoa para criar a senha em 'Primeiro acesso'.", "ok"); carregarAdmins(); }
    catch (err) { msgEm("#msgAdmins", err.message, "erro"); }
  });
  $("#listaAdmins").addEventListener("click", async (e) => {
    const em = e.target.dataset.rem; if (!em || !confirm(`Remover o administrador ${em}?`)) return;
    try { await DB.admins.remover(em); msgEm("#msgAdmins", "Administrador removido.", "ok"); carregarAdmins(); } catch (err) { msgEm("#msgAdmins", err.message, "erro"); }
  });

  /* ---------- Log (somente consulta) ---------- */
  $("#filtroLog").addEventListener("change", carregarLog);
  async function carregarLog() {
    const l = await DB.log.listar(), sel = $("#filtroLog"), atual = sel.value;
    const emails = [...new Set(l.map((x) => x.admin_email))].sort();
    sel.innerHTML = '<option value="">Todos os administradores</option>' + emails.map((e) => `<option ${e === atual ? "selected" : ""}>${esc(e)}</option>`).join("");
    const f = atual ? l.filter((x) => x.admin_email === atual) : l;
    $("#corpoLog").innerHTML = f.map((x) => `<tr><td>${dataHora(x.criado_em)}</td><td>${esc(x.admin_nome ? `${x.admin_nome} (${x.admin_email})` : x.admin_email)}</td><td>${esc(x.acao)}</td><td>${esc(x.detalhe)}</td></tr>`).join("") || '<tr><td colspan="4">Nenhum registro.</td></tr>';
  }

  rotear();
})();
