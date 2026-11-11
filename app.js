/* Cidadania Digital — site público */
(function () {
  const CFG = window.CD_CONFIG || {};
  const SITE = CFG.SITE_URL || location.href.split("#")[0];
  const DB = window.DB;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (n) => n.toLocaleString("pt-BR");

  /* ---------- Compartilhamento ---------- */
  const waUrl = (t) => "https://wa.me/?text=" + encodeURIComponent(t);
  const xUrl = (t) => "https://twitter.com/intent/tweet?text=" + encodeURIComponent(t);
  const pop = $("#sharePop");
  let fraseAtiva = null;
  const fecharPop = () => { pop.hidden = true; if (fraseAtiva) fraseAtiva.classList.remove("ativa"); fraseAtiva = null; };

  $("#manifestoConteudo").addEventListener("click", (e) => {
    const el = e.target.closest(".frase");
    if (!el || document.body.classList.contains("editando")) return;
    e.stopPropagation();
    if (fraseAtiva) fraseAtiva.classList.remove("ativa");
    fraseAtiva = el; el.classList.add("ativa");
    const t = el.textContent.trim().replace(/\s+/g, " ");
    $("#popWa").href = waUrl(`"${t}"\n\n— Manifesto Cidadania Digital. Assine: ${SITE}`);
    $("#popX").href = xUrl(`"${t.length > 200 ? t.slice(0, 197) + "…" : t}" ${SITE} #CidadaniaDigital`);
    pop.hidden = false;
    const r = el.getBoundingClientRect(), w = pop.offsetWidth, vw = document.documentElement.clientWidth;
    const x = e.clientX || r.left + r.width / 2;
    pop.style.left = Math.max(8, Math.min(window.scrollX + x - w / 2, vw - w - 8)) + "px";
    const acima = r.top > pop.offsetHeight + 70;
    pop.style.top = window.scrollY + (acima ? r.top - pop.offsetHeight - 8 : r.bottom + 8) + "px";
  });
  document.addEventListener("click", (e) => { if (!pop.contains(e.target)) fecharPop(); });
  window.addEventListener("resize", fecharPop);
  const resumo = "MANIFESTO POR UMA DEMOCRACIA DE VERDADE: CHEGA DA POLÍTICA TRADICIONAL! O voto não é um cheque em branco. Quem ajudou a vencer tem o direito de governar junto. Leia e assine:";
  $("#shareAllWa").href = waUrl(resumo + " " + SITE);
  $("#shareAllX").href = xUrl(resumo + " " + SITE + " #CidadaniaDigital");
  $("#shareAllX").textContent = "X/Twitter";

  /* ---------- Manifesto editável (conteúdo salvo pelos administradores) ---------- */
  const MANIFESTO_ORIGINAL = $("#manifestoConteudo").innerHTML;
  const TAGS_OK = new Set(["P", "H2", "H3", "H4", "UL", "OL", "LI", "STRONG", "B", "EM", "I", "SPAN", "DIV", "ARTICLE", "BR"]);
  const CLASSES_OK = new Set(["frase", "destaque", "grande", "cards-chega", "num", "queremos"]);
  function sanitizar(html) {
    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
    const limpar = (no) => {
      [...no.children].forEach((el) => {
        if (!TAGS_OK.has(el.tagName)) {
          if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED"].includes(el.tagName)) { el.remove(); return; }
          limpar(el); el.replaceWith(...el.childNodes); return;
        }
        [...el.attributes].forEach((a) => { if (a.name !== "class") el.removeAttribute(a.name); });
        const cls = [...el.classList].filter((c) => CLASSES_OK.has(c));
        cls.length ? el.setAttribute("class", cls.join(" ")) : el.removeAttribute("class");
        limpar(el);
      });
    };
    limpar(doc.body.firstChild);
    return doc.body.firstChild.innerHTML;
  }
  async function carregarManifesto() {
    try { const h = await DB.conteudo.get("manifesto_html"); if (h) $("#manifestoConteudo").innerHTML = sanitizar(h); } catch (e) { console.warn(e); }
  }

  /* ---------- Abas de Projetos ---------- */
  $$("#projetos .aba").forEach((b) => b.addEventListener("click", () => {
    $$("#projetos .aba").forEach((x) => x.classList.remove("ativa"));
    $$("#projetos .painel").forEach((x) => x.classList.remove("ativo"));
    b.classList.add("ativa"); $("#aba-" + b.dataset.aba).classList.add("ativo");
  }));
  $$(".topo nav a").forEach((a) => a.addEventListener("click", () => document.body.classList.remove("menu-aberto")));

  /* ---------- Localidades ---------- */
  const BASE = "https://raw.githubusercontent.com/kelvins/municipios-brasileiros/main/json/";
  let ESTADOS = [], MUNIS = [];
  async function carregarLocalidades() {
    try {
      const [e, m] = await Promise.all([fetch(BASE + "estados.json").then((r) => r.json()), fetch(BASE + "municipios.json").then((r) => r.json())]);
      ESTADOS = e.sort((a, b) => a.nome.localeCompare(b.nome)); MUNIS = m;
    } catch {
      const e = await fetch("https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome").then((r) => r.json());
      ESTADOS = e.map((x) => ({ codigo_uf: x.id, uf: x.sigla, nome: x.nome }));
    }
    const opts = ESTADOS.map((e) => `<option value="${e.uf}">${esc(e.nome)} (${e.uf})</option>`).join("");
    $("#selUf").innerHTML = '<option value="">Selecione o estado</option>' + opts;
    $("#selUfPressao").innerHTML = '<option value="">Estado</option>' + opts;
  }
  async function cidadesDe(uf) {
    const est = ESTADOS.find((e) => e.uf === uf);
    if (MUNIS.length && est) return MUNIS.filter((m) => m.codigo_uf === est.codigo_uf).sort((a, b) => a.nome.localeCompare(b.nome));
    const l = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`).then((r) => r.json());
    return l.map((c) => ({ nome: c.nome }));
  }
  async function preencherCidades(selUf, selCid, rotulo, valor) {
    if (!selUf.value) { selCid.disabled = true; selCid.innerHTML = `<option value="">${rotulo}</option>`; return; }
    selCid.innerHTML = "<option>Carregando…</option>";
    const cs = await cidadesDe(selUf.value);
    selCid.innerHTML = `<option value="">${rotulo}</option>` + cs.map((c) => `<option>${esc(c.nome)}</option>`).join("");
    selCid.disabled = false;
    if (valor) selCid.value = valor;
  }
  $("#selUf").addEventListener("change", () => preencherCidades($("#selUf"), $("#selCidade"), "Selecione a cidade"));
  function coordenadas(uf, cidade) {
    const est = ESTADOS.find((e) => e.uf === uf);
    const m = est && MUNIS.find((x) => x.codigo_uf === est.codigo_uf && x.nome === cidade);
    if (m) return [m.latitude, m.longitude];
    if (est && est.latitude) return [est.latitude, est.longitude];
    return [-14.2, -51.9];
  }

  /* ---------- Dados de exemplo (somente demonstração local) ---------- */
  function semearDemo() {
    if (DB.modo !== "local" || DB.adesoes.existe() || !MUNIS.length) return;
    const nomes = ["Ana", "Maria", "João", "José", "Francisca", "Antônio", "Carlos", "Paulo", "Lucas", "Juliana", "Mariana", "Pedro", "Fernanda", "Rafael", "Beatriz", "Gabriel", "Luiza", "Marcos", "Patrícia", "Rita", "Tiago", "Camila", "Bruno", "Sônia", "Raimundo", "Joana", "Diego", "Larissa"];
    const sobren = "SOLPACRMFGBDTVN";
    const pesos = { SP: 22, RJ: 9, MG: 10, BA: 7, PR: 6, RS: 6, PE: 5, CE: 5, PA: 4, SC: 4, GO: 4, DF: 3, PI: 3, MA: 3, AM: 2, ES: 2, PB: 2, RN: 2, AL: 2, MT: 2, MS: 2, SE: 1, RO: 1, TO: 1, AC: 1, AP: 1, RR: 1 };
    const out = [];
    Object.entries(pesos).forEach(([uf, p]) => {
      const est = ESTADOS.find((e) => e.uf === uf); if (!est) return;
      const ms = MUNIS.filter((m) => m.codigo_uf === est.codigo_uf), cap = ms.find((m) => m.capital);
      for (let i = 0; i < p * 25; i++) {
        const m = Math.random() < 0.45 && cap ? cap : ms[Math.floor(Math.random() * ms.length)];
        const ap = `${nomes[Math.floor(Math.random() * nomes.length)]} ${sobren[Math.floor(Math.random() * sobren.length)]}.`;
        out.push({ nome: ap, apelido: ap, email: "", uf, cidade: m.nome, lat: m.latitude, lng: m.longitude, demo: true });
      }
    });
    DB.adesoes.semear(out);
  }

  /* ---------- Mapa ---------- */
  const mapa = L.map("mapa", { scrollWheelZoom: false, tap: true, minZoom: 3 }).setView([-14.5, -52], 4);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png", { attribution: "&copy; OpenStreetMap &copy; CARTO &middot; IBGE", maxZoom: 12 }).addTo(mapa);
  async function desenharEstados() {
    const fontes = [
      "https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo+json&intrarregiao=UF&qualidade=minima",
      "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson",
    ];
    for (const url of fontes) {
      try {
        const geo = await fetch(url).then((r) => { if (!r.ok) throw 0; return r.json(); });
        L.geoJSON(geo, { interactive: false, style: { color: "#7fa7e8", weight: 1, opacity: 0.7, fillColor: "#1d3a75", fillOpacity: 0.25 } }).addTo(mapa).bringToBack();
        return;
      } catch {}
    }
  }
  const camada = L.layerGroup().addTo(mapa);
  function animar(el, alvo) {
    const ini = parseInt((el.textContent || "0").replace(/\D/g, "")) || 0, t0 = performance.now();
    const passo = (t) => { const p = Math.min(1, (t - t0) / 1200); el.textContent = fmt(Math.round(ini + (alvo - ini) * p)); if (p < 1) requestAnimationFrame(passo); };
    requestAnimationFrame(passo);
  }
  function desenhar(lista, novo) {
    camada.clearLayers();
    const grupos = {};
    lista.forEach((a) => { const k = a.uf + "|" + a.cidade; (grupos[k] ||= { uf: a.uf, cidade: a.cidade, lat: a.lat, lng: a.lng, nomes: [] }).nomes.push(a.apelido); });
    const vals = Object.values(grupos);
    vals.forEach((g) => {
      if (g.lat == null) return;
      const n = g.nomes.length, ult = g.nomes.slice(-8).reverse().filter(Boolean);
      const html = `<b>${esc(g.cidade)} - ${g.uf}</b><br>${fmt(n)} ${n === 1 ? "adesão" : "adesões"}` +
        (ult.length ? `<div class="tt-nomes">${ult.map(esc).join(", ")}${n > ult.length ? ` e mais ${fmt(n - ult.length)}` : ""}</div>` : "");
      L.circleMarker([g.lat, g.lng], { radius: Math.min(4 + Math.sqrt(n) * 1.6, 26), color: "#ffcc29", weight: 1, fillColor: "#ffcc29", fillOpacity: 0.55 })
        .bindTooltip(html, { direction: "top", sticky: false }).addTo(camada);
    });
    if (novo) {
      L.marker([novo.lat, novo.lng], { icon: L.divIcon({ className: "", html: '<div class="pulso-novo"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }), zIndexOffset: 1000 })
        .bindTooltip(`<b>Bem-vindo(a), ${esc(novo.apelido)}!</b><br>${esc(novo.cidade)} - ${novo.uf}`, { permanent: true, direction: "top", offset: [0, -10], className: "tt-novo" })
        .addTo(camada);
      mapa.flyTo([novo.lat, novo.lng], 6, { duration: 1.5 });
    }
    [["#total", lista.length], ["#heroTotal", lista.length], ["#cidades", vals.length], ["#heroCidades", vals.length]].forEach(([s, v]) => animar($(s), v));
    const porUf = {}; lista.forEach((a) => (porUf[a.uf] = (porUf[a.uf] || 0) + 1));
    $("#rankingUf").innerHTML = Object.entries(porUf).sort((a, b) => b[1] - a[1]).map(([u, n]) => `<span>${u} <b>${fmt(n)}</b></span>`).join("");
  }
  async function atualizar(novo) { try { desenhar(await DB.adesoes.listar(), novo); } catch (e) { console.error(e); } }

  /* ---------- Adesão ---------- */
  $("#formAdesao").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target, msg = $("#msgAdesao"), btn = f.querySelector("button[type=submit]");
    const nome = f.nome.value.trim().replace(/\s+/g, " "), uf = f.uf.value, cidade = f.cidade.value;
    const [lat, lng] = coordenadas(uf, cidade);
    btn.disabled = true; msg.className = "msg"; msg.textContent = "Enviando…";
    try {
      await DB.adesoes.inserir({ nome, email: f.email.value.trim().toLowerCase(), uf, cidade, lat, lng });
      msg.className = "msg ok";
      msg.textContent = "✅ Adesão registrada! Obrigado(a). " + (DB.modo === "supabase" ? "Você receberá um e-mail de confirmação." : "(Demonstração: e-mail não enviado.)");
      f.reset(); $("#selCidade").disabled = true;
      await atualizar({ lat, lng, uf, cidade, apelido: DB.apelido(nome) });
      if (window.innerWidth < 860) document.getElementById("mapa").scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (err) {
      msg.className = "msg erro";
      msg.textContent = err.code === "23505" || /duplic|unique/i.test(err.message || "") ? "Este e-mail já assinou o manifesto." : "Não foi possível registrar. Tente novamente.";
    } finally { btn.disabled = false; }
  });

  /* ---------- Pressione seu representante ---------- */
  const CARGOS = {
    deputados: { titulo: "Deputado(a)", plural: "deputados federais", oficial: "https://www.camara.leg.br/deputados/quem-sao" },
    senadores: { titulo: "Senador(a)", plural: "senadores", oficial: "https://www25.senado.leg.br/web/senadores/em-exercicio" },
    estaduais: { plural: "deputados estaduais", estadual: true, tratamento: "Senhores(as) Deputados(as) Estaduais da",
      alvo: (c, u, n) => `Assembleia Legislativa de ${n}`, busca: (c, u, n) => `Assembleia Legislativa ${n} deputados estaduais`, linkTxt: "Ver deputados estaduais" },
    governador: { plural: "governador(a)", estadual: true, tratamento: "Senhor(a) Governador(a), ao",
      alvo: (c, u, n) => `Governo do Estado de ${n}`, busca: (c, u, n) => `governador ${n} contato`, linkTxt: "Ver governador(a)" },
    prefeito: { plural: "prefeito(a)", municipal: true, tratamento: "Senhor(a) Prefeito(a), à",
      alvo: (c) => `Prefeitura de ${c}`, busca: (c, u) => `prefeito de ${c} ${u} contato`, linkTxt: "Ver prefeito(a)" },
    vereadores: { plural: "vereadores", municipal: true, tratamento: "Senhores(as) Vereadores(as) da",
      alvo: (c) => `Câmara Municipal de ${c}`, busca: (c, u) => `Câmara Municipal de ${c} ${u} vereadores`, linkTxt: "Ver vereadores" },
  };
  const cardPolitico = (p) => `
    <div class="dep">
      <div class="dep-top">${p.foto ? `<img src="${esc(p.foto)}" alt="" loading="lazy">` : ""}<div><h4>${esc(p.nome)}</h4><small>${esc(p.info)}</small></div></div>
      <div class="acoes">
        ${p.email !== null ? `<a class="btn btn-mini" data-acao="email" data-nome="${esc(p.nome)}" data-email="${esc(p.email)}" href="#">E-mail</a>` : ""}
        <a class="btn btn-x btn-mini" data-acao="x" data-nome="${esc(p.nome)}" href="#">X/Twitter</a>
        <a class="btn btn-whats btn-mini" data-acao="wa" data-nome="${esc(p.nome)}" href="#">WhatsApp</a>
        ${p.link ? `<a class="btn btn-sec btn-mini" href="${esc(p.link)}" target="_blank" rel="noopener">${esc(p.linkTxt)}</a>` : ""}
      </div>
    </div>`;
  async function buscarDeputados(uf) {
    const mapear = (d) => ({ nome: d.nome, info: `${d.siglaPartido} - ${d.siglaUf}`, foto: d.urlFoto, email: d.email || "" });
    try { // 1º: cópia local (dados/deputados.json), atualizada pelo GitHub Action
      const loc = await fetch("dados/deputados.json", { cache: "no-cache" });
      if (loc.ok) { const t = await loc.json(); const l = (t.dados || t).filter((d) => d.siglaUf === uf); if (l.length) return l.map(mapear); }
    } catch {}
    const r = await fetch(`https://dadosabertos.camara.leg.br/api/v2/deputados?siglaUf=${uf}&ordem=ASC&ordenarPor=nome&itens=100`, { headers: { Accept: "application/json" } }).then((r) => r.json());
    return (r.dados || []).map(mapear);
  }
  async function buscarSenadores(uf) {
    const r = await fetch("https://legis.senado.leg.br/dadosabertos/senador/lista/atual.json", { headers: { Accept: "application/json" } }).then((r) => r.json());
    let ps = r?.ListaParlamentarEmExercicio?.Parlamentares?.Parlamentar || [];
    if (!Array.isArray(ps)) ps = [ps];
    return ps.map((p) => p.IdentificacaoParlamentar).filter((p) => p.UfParlamentar === uf)
      .map((p) => ({ nome: p.NomeParlamentar, info: `${p.SiglaPartidoParlamentar} - ${p.UfParlamentar}`, foto: p.UrlFotoParlamentar, email: p.EmailParlamentar || "" }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }
  const selCidP = $("#selCidadePressao");
  $("#selUfPressao").addEventListener("change", () => preencherCidades($("#selUfPressao"), selCidP, "Cidade", selCidP.dataset.pendente).then(() => delete selCidP.dataset.pendente));
  const ajustarCidade = () => (selCidP.style.display = CARGOS[$("#selCargo").value].municipal ? "" : "none");
  $("#selCargo").addEventListener("change", ajustarCidade); ajustarCidade();
  $("#inCep").addEventListener("input", (e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 8); e.target.value = v.length > 5 ? v.slice(0, 5) + "-" + v.slice(5) : v; });

  $("#formPressao").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("#msgPressao"), lista = $("#listaDeputados");
    const C = CARGOS[$("#selCargo").value];
    let uf = $("#selUfPressao").value, cidade = selCidP.value;
    const cep = $("#inCep").value.replace(/\D/g, "");
    msg.className = "msg"; msg.textContent = "Buscando…"; lista.innerHTML = "";
    try {
      if (cep.length === 8) {
        const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`).then((r) => r.json());
        if (r.erro) throw new Error("CEP não encontrado.");
        uf = r.uf; cidade = r.localidade;
        if ($("#selUfPressao").value !== uf) { $("#selUfPressao").value = uf; selCidP.dataset.pendente = cidade; $("#selUfPressao").dispatchEvent(new Event("change")); }
        else selCidP.value = cidade;
      }
      if (!uf) throw new Error("Informe um CEP válido ou escolha um estado.");
      if (C.municipal || C.estadual) {
        if (C.municipal && !cidade) throw new Error("Para este cargo, informe o CEP ou escolha a cidade.");
        const nomeUf = (ESTADOS.find((x) => x.uf === uf) || {}).nome || uf;
        const local = C.municipal ? `${cidade} - ${uf}` : nomeUf;
        msg.textContent = `${C.plural[0].toUpperCase() + C.plural.slice(1)} (${local}): a mensagem vai endereçada ao órgão. Use o botão para ver nomes e contatos oficiais.`;
        lista.innerHTML = cardPolitico({ nome: C.alvo(cidade, uf, nomeUf), info: local, email: "", link: `https://www.google.com/search?q=${encodeURIComponent(C.busca(cidade, uf, nomeUf))}`, linkTxt: C.linkTxt });
        return;
      }
      const ps = C === CARGOS.deputados ? await buscarDeputados(uf) : await buscarSenadores(uf);
      msg.textContent = `${ps.length} ${C.plural} em exercício por ${uf}.`;
      lista.innerHTML = ps.map(cardPolitico).join("");
    } catch (err) {
      msg.className = "msg erro";
      const rede = err instanceof TypeError || err instanceof SyntaxError;
      msg.textContent = rede ? "Não foi possível acessar a base oficial agora. Você ainda pode enviar a mensagem genérica abaixo." : err.message || "Erro na busca.";
      if (rede) lista.innerHTML = cardPolitico({ nome: `${C.plural[0].toUpperCase() + C.plural.slice(1)}${uf ? " de " + uf : ""}`, info: "Mensagem genérica", email: null, link: C.oficial, linkTxt: "Lista oficial" });
    }
  });
  $("#listaDeputados").addEventListener("click", (e) => {
    const a = e.target.closest("[data-acao]"); if (!a) return;
    e.preventDefault();
    const C = CARGOS[$("#selCargo").value];
    const texto = $("#txtPressao").value.replace(/\{cargo\}/g, C.tratamento || C.titulo).replace(/\{nome\}/g, a.dataset.nome).replace(/\s+,/g, ",");
    if (a.dataset.acao === "email") location.href = `mailto:${a.dataset.email}?subject=${encodeURIComponent("Manifesto pela Governança Direta")}&body=${encodeURIComponent(texto + "\n\n" + SITE)}`;
    if (a.dataset.acao === "x") window.open(xUrl(texto + " " + SITE), "_blank");
    if (a.dataset.acao === "wa") window.open(waUrl(texto + " " + SITE), "_blank");
  });

  /* ---------- Contato ---------- */
  $("#formContato").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target, msg = $("#msgContato"), btn = f.querySelector("button");
    btn.disabled = true; msg.className = "msg"; msg.textContent = "Enviando…";
    try {
      await DB.mensagens.enviar({ nome: f.nome.value.trim(), email: f.email.value.trim().toLowerCase(), assunto: f.assunto.value, texto: f.texto.value.trim() });
      msg.className = "msg ok"; msg.textContent = "✅ Mensagem enviada! Responderemos no seu e-mail.";
      f.reset();
    } catch { msg.className = "msg erro"; msg.textContent = "Não foi possível enviar. Tente novamente."; }
    finally { btn.disabled = false; }
  });

  /* ---------- Exposto para o painel administrativo ---------- */
  window.CD = { sanitizar, MANIFESTO_ORIGINAL, carregarManifesto, esc };

  /* ---------- Inicialização ---------- */
  carregarManifesto();
  desenharEstados();
  (async () => {
    await carregarLocalidades();
    semearDemo();
    await atualizar();
    if (DB.modo === "supabase") setInterval(() => atualizar(), 20000);
  })();
})();
