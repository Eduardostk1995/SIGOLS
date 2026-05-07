const app = document.getElementById('app');

const state = {
  page: localStorage.getItem('sigo.page') || 'login',
  folder: 'Início',
  selected: null,
  modal: null,
  search: '',
  toast: null,
};

const LS_CONTACT = 'https://lsgestao.com.br/contato/';
const DEMO_URL = 'https://sigols.netlify.app/';

const people = ['Ana Martins','Bruno Rocha','Camila Torres','Daniel Lima','Fernanda Alves','Helena Prado','Lucas Moreira','Mariana Costa','Rafael Nogueira','Rodrigo Souza','Sofia Ribeiro','Vinícius Barros'];

const kpis = [
  {label:'Pendências abertas', value:42, delta:'-18% no mês', tone:'warning'},
  {label:'Ações vencidas', value:9, delta:'3 críticas', tone:'danger'},
  {label:'Documentos publicados', value:186, delta:'+12 revisões', tone:'success'},
  {label:'Metas em acompanhamento', value:24, delta:'76% no prazo', tone:'info'},
];

const documents = [
  {id:1, name:'MAN-DIR-001 - Manual do Sistema de Gestão', type:'Manual', folder:'00_Direção', created:'11/02/2023 18:53:03', status:'Publicado', version:'5.0', publish:'04/05/2026', owner:'Direção'},
  {id:2, name:'POP-QUA-001 - Controle de Documentos', type:'Procedimento', folder:'02_Qualidade', created:'12/02/2023 14:28:10', status:'Publicado', version:'3.0', publish:'04/05/2026', owner:'Qualidade'},
  {id:3, name:'IT-PRO-004 - Inspeção de Processo', type:'Instrução', folder:'01_Produção', created:'13/02/2023 09:10:44', status:'Em consenso', version:'1.0', publish:'-', owner:'Produção'},
  {id:4, name:'FOR-RH-002 - Registro de Treinamento', type:'Formulário', folder:'04_Recursos Humanos', created:'14/02/2023 11:35:22', status:'Publicado', version:'2.0', publish:'12/04/2026', owner:'RH'},
  {id:5, name:'POP-COM-003 - Avaliação de Fornecedores', type:'Procedimento', folder:'05_Compras', created:'15/02/2023 16:08:31', status:'Revisão', version:'4.0', publish:'-', owner:'Compras'},
  {id:6, name:'POL-DIR-002 - Política da Qualidade', type:'Política', folder:'00_Direção', created:'16/02/2023 10:20:18', status:'Publicado', version:'2.1', publish:'20/03/2026', owner:'Direção'},
];

let boms = [];
let bomAll = [];

const bomState = {
  status: 'todos',
  processo: 'todos',
  responsavel: 'todos',
  ano: 'todos',
  busca: '',
  page: 1,
  perPage: 50
};

function dataBRParaDate(valor) {
  if (!valor || valor === '-') return new Date(0);
  const partes = String(valor).split('/');
  if (partes.length !== 3) return new Date(0);
  return new Date(`${partes[2]}-${partes[1]}-${partes[0]}`);
}

function textoSeguro(valor, padrao = '-') {
  return valor && String(valor).trim() ? String(valor).trim() : padrao;
}

function statusBom(item) {
  const dataEnc = textoSeguro(item.data_encerramento, '');
  const prazo = textoSeguro(item.data_prazo || item.prazo || item['data.prazo'], '');

  if (dataEnc) {
    return 'Encerrado';
  }

  if (!prazo) {
    return 'Sem Prazo';
  }

  const dataPrazo = dataBRParaDate(prazo);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  if (dataPrazo < hoje) {
    return 'Vencido';
  }

  return 'No Prazo';
}

async function carregarBOMReal() {
  try {
    const response = await fetch("/.netlify/functions/relatorio-bom-bi");
    const resultado = await response.json();
    const dados = resultado.data || [];

    bomAll = dados.map((item, index) => ({
      
      id: item["data.bom"] || item.bom || index + 1,
      type: textoSeguro(item["data.origem"] || item.origem, "BOM"),
      issuer: textoSeguro(item["data.emitente"] || item.emitente),
      owner: textoSeguro(
        item["data.destinatario"] || item.destinatario || item.responsavel_encerramento
      ),
      local: textoSeguro(item["data.local"] || item.local),
      process: textoSeguro(item["data.processos"] || item.processos),
      date: textoSeguro(item["data.criacao"] || item.criacao),
      prazo: textoSeguro(item["data.encerramento"] || item.encerramento),
      due: textoSeguro(item["data.encerramento"] || item.encerramento, "-"),
      dataEncerramento: textoSeguro(
        item["data.data_encerramento"] || item.data_encerramento,
       ""
      ),
      condicao: condicaoBom(item),
      sla: slaBom(item),
      status: condicaoBom(item),
      severity: textoSeguro(item.risco, "Não classificado"),
      nature: textoSeguro(item.natureza || item.requisito, "Sem descrição"),
      action: textoSeguro(item["data.evidencia"] || item.evidencia),
      cause: textoSeguro(item.causa_raiz_5porques),
      action: textoSeguro(item.evidencia),
      requisito: textoSeguro(item.requisito),
      encerramento: textoSeguro(item.encerramento, '')
    }));

    bomAll.sort((a, b) => dataBRParaDate(b.date) - dataBRParaDate(a.date));

    boms = bomAll.slice(0, bomState.perPage);
    render();

  } catch (error) {
    console.error("Erro ao carregar BOM:", error);
    showToast("Erro ao carregar dados reais de BOM");
  }
}

function getBOMFiltrado() {
  let lista = [...bomAll];

  if (bomState.status !== 'todos') {
    lista = lista.filter(x => x.status === bomState.status);
  }

  if (bomState.processo !== 'todos') {
    lista = lista.filter(x => x.process === bomState.processo);
  }

  if (bomState.responsavel !== 'todos') {
    lista = lista.filter(x => x.owner === bomState.responsavel);
  }

  if (bomState.ano !== 'todos') {
    lista = lista.filter(x => String(x.date).includes(`/${bomState.ano}`));
  }

  if (bomState.busca) {
    const termo = bomState.busca.toLowerCase();
    lista = lista.filter(x =>
      `${x.id} ${x.type} ${x.issuer} ${x.owner} ${x.local} ${x.process} ${x.nature} ${x.requisito}`
        .toLowerCase()
        .includes(termo)
    );
  }

  return lista;
}

function atualizarFiltroBOM(campo, valor) {
  bomState[campo] = valor;
  bomState.page = 1;
  render();
}

function limparFiltrosBOM() {
  bomState.status = 'todos';
  bomState.processo = 'todos';
  bomState.responsavel = 'todos';
  bomState.ano = 'todos';
  bomState.busca = '';
  bomState.page = 1;
  render();
}

function mudarPaginaBOM(direcao) {
  const total = getBOMFiltrado().length;
  const totalPaginas = Math.max(1, Math.ceil(total / bomState.perPage));
  bomState.page = Math.min(Math.max(1, bomState.page + direcao), totalPaginas);
  render();
}

function opcoesUnicas(lista, campo) {
  return [...new Set(lista.map(x => x[campo]).filter(x => x && x !== '-'))].sort();
}

const ros = [
  {id:94, type:'RO', issuer:'Ana Martins', owner:'Bruno Rocha', local:'Filial 1', process:'Produção', date:'03/05/2026', due:'05/05/2026', status:'Encerrado', nature:'Ocorrência operacional registrada no setor produtivo para avaliação da liderança.', action:'Ajustada sequência operacional e encerrado após validação da supervisão.'},
  {id:91, type:'RO', issuer:'Helena Prado', owner:'Mariana Costa', local:'Matriz', process:'Recursos Humanos', date:'28/04/2026', due:'12/05/2026', status:'No prazo', nature:'Solicitação de ajuste em registro de treinamento de integração.', action:'Validar lista de presença e atualizar evidência de capacitação no módulo de documentos.'},
  {id:88, type:'RO', issuer:'Vinícius Barros', owner:'Sofia Ribeiro', local:'Filial 2', process:'Qualidade', date:'19/04/2026', due:'28/04/2026', status:'Concluído', nature:'Registro de ocorrência relacionada à inspeção final de produto.', action:'Revisado critério de inspeção final e orientada equipe sobre ponto de controle.'},
  {id:80, type:'RO', issuer:'Daniel Lima', owner:'Camila Torres', local:'Matriz', process:'Compras', date:'07/04/2026', due:'14/04/2026', status:'Vencido', nature:'Divergência em informação cadastral de fornecedor crítico.', action:'Atualizar cadastro, evidências de homologação e aprovação do fornecedor.'},
  {id:77, type:'RO', issuer:'Rafael Nogueira', owner:'Helena Prado', local:'Filial 1', process:'Logística', date:'26/03/2026', due:'15/04/2026', status:'Em análise', nature:'Atraso na conferência de materiais recebidos impactou liberação de produção.', action:'Revisar dimensionamento da rotina de recebimento e priorização por criticidade.'},
];

const grs = [
  {id:121, process:'Comercial', issuer:'Ana Martins', owner:'Rodrigo Souza', deadline:'31/01/2027', result:76, status:'Em acompanhamento', objective:'Promover resultados econômicos e financeiros sustentáveis.', metric:'Margem de vendas (%) = {(Receita total - CPV)/Receita total} x 100', relevance:'Garante sustentabilidade comercial e direciona decisões de precificação.'},
  {id:120, process:'Produção', issuer:'Rafael Nogueira', owner:'Vinícius Barros', deadline:'31/01/2027', result:62, status:'Atenção', objective:'Aumentar a rotatividade de estoque de matéria-prima.', metric:'Rotatividade de estoque <= 15 dias', relevance:'Reduz capital parado e melhora previsibilidade operacional.'},
  {id:119, process:'Qualidade', issuer:'Camila Torres', owner:'Sofia Ribeiro', deadline:'30/11/2026', result:84, status:'No prazo', objective:'Reduzir reincidência de ocorrências críticas.', metric:'Redução de 20% nos registros reincidentes', relevance:'Ataca causas recorrentes e melhora a eficácia do sistema de gestão.'},
  {id:118, process:'Recursos Humanos', issuer:'Helena Prado', owner:'Mariana Costa', deadline:'30/09/2026', result:58, status:'Atenção', objective:'Elevar aderência ao plano anual de treinamentos.', metric:'Cumprimento mínimo de 90% do plano de capacitação', relevance:'Assegura competências mínimas para processos críticos.'},
];

const folders = ['00_Direção','01_Produção','02_Qualidade','03_Engenharia','04_Recursos Humanos','05_Compras'];

const nav = [
  ['home','Início','grid'], ['docs','Documentos','file-text'], ['bom','BOM','alert'], ['ro','RO','clipboard'], ['gr','Resultados','target'], ['dash','Dashboards','bar-chart'], ['admin','Admin','users'], ['reports','Relatórios','download'], ['support','Suporte','help']
];

function icon(name){
  const path = {
    grid:'M3 3h8v8H3V3Zm10 0h8v8h-8V3ZM3 13h8v8H3v-8Zm10 0h8v8h-8v-8Z',
    'file-text':'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm0 0v6h6M8 13h8M8 17h8M8 9h2',
    alert:'M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
    clipboard:'M9 5h6m-7 0a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2h1a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1Zm1 8h6m-6 4h6',
    target:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-4a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm0-4a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
    'bar-chart':'M4 19V5m0 14h17M8 17V9m5 8V7m5 10v-5',
    users:'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm14 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
    download:'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
    help:'M9.1 9a3 3 0 1 1 5.8 1c-.7 1.4-2.9 1.5-2.9 4m0 4h.01',
  }[name];
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`;
}

function setPage(page){
  state.page = page; state.modal = null; state.selected = null;
  localStorage.setItem('sigo.page', page);
  render(); window.scrollTo({top:0, behavior:'smooth'});
}
function showToast(text){ state.toast = text; render(); setTimeout(()=>{state.toast=null; render();}, 2200); }
function openRecord(module, id){ state.page = `${module}Detail`; state.selected = id; render(); window.scrollTo({top:0, behavior:'smooth'}); }

function login(){
  return `<main class="login-screen">
    <section class="login-hero">
      <div class="brand-mark">SIGO</div>
      <h1>Gestão integrada, rastreável e orientada a resultado.</h1>
      <p>Ambiente demonstrativo para apresentar os principais módulos do SIGO com uma experiência moderna de navegação.</p>
      <div class="hero-grid">
        <span>${icon('file-text')} Documentos controlados</span>
        <span>${icon('alert')} Ocorrências e NCs</span>
        <span>${icon('target')} Gestão de resultados</span>
        <span>${icon('bar-chart')} Dashboards gerenciais</span>
      </div>
    </section>
    <section class="login-card">
      <div class="login-title">
        <b>Acessar demonstração</b>
        <span>SIGO Demo Comercial</span>
      </div>
      <label>E-mail</label><input value="demo@empresa.com.br" />
      <label>Senha</label><input type="password" value="123456" />
      <button onclick="setPage('home')" class="btn primary full">Entrar no ambiente demo</button>
      <a class="muted-link" href="${LS_CONTACT}" target="_blank" rel="noopener">Solicitar acesso completo com consultores LS</a>
      <div class="login-note">Demonstração gratuita. Algumas interações são simuladas para fins comerciais.</div>
    </section>
  </main>`;
}

function shell(content, title='', subtitle=''){
  return `<div class="layout">
    <aside class="sidebar">
      <div class="logo" onclick="setPage('home')"><span>S</span><div><b>SIGO</b><small>LS Gestão</small></div></div>
      <nav>${nav.map(([p,l,i])=>`<button class="${state.page.startsWith(p)?'active':''}" onclick="setPage('${p}')">${icon(i)}<span>${l}</span></button>`).join('')}</nav>
      <div class="demo-card"><b>Demo gratuita</b><p>Conheça o fluxo visual. Para liberar todas as funcionalidades, fale com a LS.</p><a href="${LS_CONTACT}" target="_blank" rel="noopener">Entrar em contato</a></div>
    </aside>
    <section class="workspace">
      <header class="topbar">
        <div><h1>${title}</h1><p>${subtitle}</p></div>
        <div class="top-actions"><div class="global-search">${icon('help')}<input placeholder="Buscar módulo, documento ou responsável" onkeydown="if(event.key==='Enter')showToast('Busca simulada executada')"></div><button class="btn ghost" onclick="showToast('Notificações simuladas')">Notificações</button><button class="avatar" onclick="setPage('login')">ES</button></div>
      </header>
      ${content}
      <footer class="footer">SIGO Demo Comercial · LS Gestão · <a href="${DEMO_URL}" target="_blank" rel="noopener">${DEMO_URL}</a></footer>
    </section>
    ${state.toast?`<div class="toast">${state.toast}</div>`:''}
    ${modal()}
  </div>`;
}

function badge(text){ const t = text.toLowerCase(); let c = 'neutral'; if(t.includes('venc')) c='danger'; else if(t.includes('prazo')||t.includes('publicado')||t.includes('encerrado')||t.includes('concluído')) c='success'; else if(t.includes('atenção')||t.includes('consenso')||t.includes('análise')||t.includes('revisão')) c='warning'; return `<span class="badge ${c}">${text}</span>`; }
function progress(v){ return `<div class="progress"><span style="width:${v}%"></span></div><b>${v}%</b>`; }

function home(){
  const pending = [...boms.slice(0,3).map(x=>({m:'BOM',...x})), ...ros.slice(1,3).map(x=>({m:'RO',...x})), ...grs.slice(0,2).map(x=>({m:'GR', owner:x.owner, due:x.deadline, nature:x.objective, status:x.status}))];
  return shell(`<section class="kpi-grid">${kpis.map(k=>`<article class="kpi ${k.tone}"><span>${k.label}</span><strong>${k.value}</strong><em>${k.delta}</em></article>`).join('')}</section>
    <section class="home-grid">
      <article class="panel wide"><div class="panel-head"><div><h2>Central de pendências</h2><p>Acompanhamento integrado por módulo, responsável e prazo.</p></div><button class="btn" onclick="setPage('dash')">Ver dashboard</button></div>
        <div class="task-list">${pending.map((x,i)=>`<div class="task"><div class="module-chip">${x.m}</div><div><b>${x.nature}</b><span>${x.owner} · Prazo ${x.due}</span></div>${badge(x.status)}</div>`).join('')}</div>
      </article>
      <article class="panel"><div class="panel-head"><div><h2>Distribuição por módulo</h2><p>Dados simulados da demonstração.</p></div></div><div class="donut"><span>76%</span></div><div class="legend"><i></i>BOM <i></i>RO <i></i>GR</div></article>
      <article class="panel"><div class="panel-head"><div><h2>Atalhos operacionais</h2><p>Acesso rápido aos fluxos principais.</p></div></div><div class="shortcut-grid">${[['docs','Novo documento'],['bom','Abrir BOM'],['ro','Registrar RO'],['gr','Nova meta']].map(([p,l])=>`<button onclick="setPage('${p}')">${l}</button>`).join('')}</div></article>
      <article class="panel wide"><div class="panel-head"><div><h2>Documentos recentes</h2><p>Controle por status, versão e publicação.</p></div><button class="btn" onclick="setPage('docs')">Abrir módulo</button></div>${docTable(documents.slice(0,4))}</article>
    </section>`, 'Visão geral', 'Painel inicial do ecossistema SIGO para gestão organizacional.');
}

function docTable(rows){
  return `<div class="table-wrap"><table><thead><tr><th>Documento</th><th>Tipo</th><th>Criação</th><th>Status</th><th>Versão</th><th>Publicação</th></tr></thead><tbody>${rows.map(d=>`<tr><td><b>${d.name}</b><small>${d.folder} · ${d.owner}</small></td><td>${d.type}</td><td>${d.created}</td><td>${badge(d.status)}</td><td>${d.version}</td><td>${d.publish}</td></tr>`).join('')}</tbody></table></div>`;
}

function docsPage(){
  return shell(`<section class="module-toolbar"><div><h2>Lista mestra e diretórios</h2><p>Controle documental com versão, status, consenso, publicação e validade.</p></div><div><button class="btn" onclick="state.modal='folder';render()">Criar diretório</button><button class="btn primary" onclick="state.modal='document';render()">Novo documento</button></div></section>
    <section class="folder-grid">${folders.map(f=>`<button onclick="state.folder='${f}';showToast('Diretório selecionado: ${f}')"><span>📁</span><b>${f}</b><small>${documents.filter(d=>d.folder===f).length} itens</small></button>`).join('')}</section>
    <section class="panel"><div class="filters"><input placeholder="Buscar documento"><select><option>Status: todos</option><option>Publicado</option><option>Em consenso</option><option>Revisão</option></select><input type="date" title="Buscar por validade"></div>${docTable(documents)}</section>`, 'Documentos', 'Gestão eletrônica de documentos do sistema de gestão.');
}

function listRecords(module) {
  const isBom = module === 'bom';

  let data = module === 'bom' ? getBOMFiltrado() : module === 'ro' ? ros : grs;

  const title = module === 'bom'
    ? 'BOM - Boletim de Ocorrência e Melhoria'
    : module === 'ro'
      ? 'RO - Registro de Ocorrência'
      : 'Gestão de Resultados';

  const subtitle = module === 'bom'
    ? 'Tratamento de ocorrências, não conformidades, riscos, ações imediatas e planos de ação.'
    : module === 'ro'
      ? 'Registro, triagem e acompanhamento de ocorrências operacionais.'
      : 'Objetivos, metas, indicadores, monitoramentos e planos de ação.';

  let paginacao = '';

  if (isBom) {
    const total = data.length;
    const totalPaginas = Math.max(1, Math.ceil(total / bomState.perPage));
    const inicio = (bomState.page - 1) * bomState.perPage;
    const fim = inicio + bomState.perPage;

    data = data.slice(inicio, fim);

    paginacao = `<div class="pagination" style="display:flex;justify-content:space-between;align-items:center;margin-top:18px;gap:12px;">
      <button class="btn" onclick="mudarPaginaBOM(-1)" ${bomState.page === 1 ? 'disabled' : ''}>Anterior</button>
      <span class="muted">Página ${bomState.page} de ${totalPaginas} · ${total} registros encontrados</span>
      <button class="btn" onclick="mudarPaginaBOM(1)" ${bomState.page === totalPaginas ? 'disabled' : ''}>Próxima</button>
    </div>`;
  }

  const rows = module === 'gr'
    ? data.map(r => `<tr>
        <td><b>GR ${r.id}</b><small>${r.process}</small></td>
        <td>${r.objective}</td>
        <td>${r.owner}</td>
        <td>${r.deadline}</td>
        <td>${progress(r.result)}</td>
        <td>${badge(r.status)}</td>
        <td><button class="btn small" onclick="openRecord('gr',${r.id})">Abrir</button></td>
      </tr>`).join('')
    : data.map(r => `<tr>
        <td><b>${module.toUpperCase()} ${r.id}</b><small>${r.type} · ${r.process}</small></td>
        <td>${r.nature}</td>
        <td>${r.owner}</td>
        <td>${r.due}</td>
        <td>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${badge(r.condicao)}
          ${badge(r.sla)}
          </div>
        </td>
        <td>${r.local}</td>
        <td><button class="btn small" onclick="openRecord('${module}',${r.id})">Abrir</button></td>
      </tr>`).join('');

  const headers = module === 'gr'
    ? '<th>Registro</th><th>Objetivo</th><th>Responsável</th><th>Prazo</th><th>Resultado</th><th>Status</th><th></th>'
    : '<th>Registro</th><th>Descrição</th><th>Responsável</th><th>Prazo</th><th>Status</th><th>Local</th><th></th>';

  const filtrosBom = isBom ? `<div class="filters">
      <input 
        placeholder="Buscar por número, descrição, processo, responsável ou requisito"
        value="${bomState.busca}"
        oninput="atualizarFiltroBOM('busca', this.value)"
      >

      <select onchange="atualizarFiltroBOM('status', this.value)">
        <option value="todos" ${bomState.status === 'todos' ? 'selected' : ''}>Status: todos</option>
<option value="Encerrado" ${bomState.status === 'Encerrado' ? 'selected' : ''}>Encerrado</option>
<option value="Sem Prazo" ${bomState.status === 'Sem Prazo' ? 'selected' : ''}>Sem Prazo</option>
<option value="Vencido" ${bomState.status === 'Vencido' ? 'selected' : ''}>Vencido</option>
<option value="No Prazo" ${bomState.status === 'No Prazo' ? 'selected' : ''}>No Prazo</option>
      </select>

      <select onchange="atualizarFiltroBOM('processo', this.value)">
        <option value="todos">Processo: todos</option>
        ${opcoesUnicas(bomAll, 'process').map(p => `<option value="${p}" ${bomState.processo === p ? 'selected' : ''}>${p}</option>`).join('')}
      </select>

      <select onchange="atualizarFiltroBOM('responsavel', this.value)">
        <option value="todos">Responsável: todos</option>
        ${opcoesUnicas(bomAll, 'owner').map(p => `<option value="${p}" ${bomState.responsavel === p ? 'selected' : ''}>${p}</option>`).join('')}
      </select>

      <select onchange="atualizarFiltroBOM('ano', this.value)">
        <option value="todos">Ano: todos</option>
        ${[...new Set(bomAll.map(x => String(x.date).split('/')[2]).filter(Boolean))].sort().reverse().map(ano => `<option value="${ano}" ${bomState.ano === ano ? 'selected' : ''}>${ano}</option>`).join('')}
      </select>

      <button class="btn" onclick="limparFiltrosBOM()">Limpar filtros</button>
    </div>` : `<div class="filters">
      <input placeholder="Buscar por descrição, responsável ou processo">
      <select><option>Status: todos</option><option>Vencido</option><option>No prazo</option><option>Encerrado</option></select>
      <select><option>Processo: todos</option><option>Qualidade</option><option>Produção</option><option>Comercial</option></select>
    </div>`;

  return shell(`<section class="module-toolbar">
      <div><h2>${title}</h2><p>${subtitle}</p></div>
      <div><button class="btn">Exportar</button><button class="btn primary" onclick="showToast('Novo registro simulado')">Novo registro</button></div>
    </section>

    ${module === 'ro' ? roCharts() : module === 'bom' ? bomCards() : grCards()}

    <section class="panel">
      ${filtrosBom}
      <div class="table-wrap">
        <table>
          <thead><tr>${headers}</tr></thead>
          <tbody>${rows || `<tr><td colspan="7">Nenhum registro encontrado.</td></tr>`}</tbody>
        </table>
      </div>
      ${paginacao}
    </section>`, title.split(' - ')[0], subtitle);
}
function bomCards() {
  const total = bomAll.length;
  const encerrados = bomAll.filter(x => x.status === 'Encerrado').length;
  const semPrazo = bomAll.filter(x => x.status === 'Sem Prazo').length;
  const vencidos = bomAll.filter(x => x.status === 'Vencido').length;
  const noPrazo = bomAll.filter(x => x.status === 'No Prazo').length;
  const abertos = semPrazo + vencidos + noPrazo;

  const percentualEncerrado = total ? Math.round((encerrados / total) * 100) : 0;

  const processos = opcoesUnicas(bomAll, 'process').length;

  return `<section class="mini-grid">
    <article><b>${total}</b><span>Total de BOMs</span></article>
    <article><b>${abertos}</b><span>Em aberto</span></article>
    <article><b>${encerrados}</b><span>Encerrados</span></article>
    <article><b>${percentualEncerrado}%</b><span>Taxa de encerramento</span></article>
  </section>
  <section class="mini-grid">
    <article><b>${vencidos}</b><span>Vencidos</span></article>
    <article><b>${noPrazo}</b><span>No prazo</span></article>
    <article><b>${semPrazo}</b><span>Sem prazo</span></article>
    <article><b>${getBOMFiltrado().length}</b><span>Registros filtrados</span></article>
  </section>`;
}
function condicaoBom(item) {
  const dataEnc = textoSeguro(
    item["data.data_encerramento"] || item.data_encerramento,
    ""
  );

  if (!dataEnc || dataEnc.toLowerCase() === "null") {
    return "Em Aberto";
  }

  return "Encerrado";
}
function slaBom(item) {
  const prazo = textoSeguro(
    item["data.encerramento"] || item.encerramento,
    ""
  );

  if (!prazo || prazo.toLowerCase() === "null") {
    return "Sem Prazo";
  }

  const dataPrazo = dataBRParaDate(prazo);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  if (dataPrazo < hoje) {
    return "Vencido";
  }

  return "No Prazo";
}
function grCards(){ return `<section class="mini-grid"><article><b>24</b><span>Metas ativas</span></article><article><b>76%</b><span>Média de resultado</span></article><article><b>9</b><span>Ações abertas</span></article><article><b>3</b><span>Metas em atenção</span></article></section>`; }
function roCharts(){ return `<section class="analytics-grid"><article class="panel"><h2>Status dos ROs</h2><div class="bar-list"><p><span>Encerrado</span><b>40%</b></p><div><i style="width:40%"></i></div><p><span>No prazo</span><b>25%</b></p><div><i style="width:25%"></i></div><p><span>Em análise</span><b>20%</b></p><div><i style="width:20%"></i></div><p><span>Vencido</span><b>15%</b></p><div><i style="width:15%"></i></div></div></article><article class="panel"><h2>Origem dos registros</h2><div class="donut small"><span>60%</span></div><p class="muted">Maior concentração em Produção e Logística.</p></article></section>`; }

function detail(module){
  const data = module==='bom'?boms:module==='ro'?ros:grs;
  const r = data.find(x=>x.id===state.selected) || data[0];
  if(module==='gr') return grDetail(r);
  return shell(`<section class="detail-head"><button class="btn" onclick="setPage('${module}')">← Voltar</button><div><h2>${module.toUpperCase()} ${r.id}</h2><p>${r.type} · ${r.process} · ${r.local}</p></div>${badge(r.status)}</section>
    <section class="detail-grid"><article class="panel wide"><h2>Descrição do registro</h2><textarea>${r.nature}</textarea><div class="form-grid"><label>Emitente<input value="${r.issuer}"></label><label>Responsável<input value="${r.owner}"></label><label>Data<input value="${r.date}"></label><label>Prazo<input value="${r.due}"></label></div></article>
    <article class="panel"><h2>Linha do tempo</h2><div class="timeline"><p><b>Registro aberto</b><span>${r.date}</span></p><p><b>Responsável designado</b><span>${r.owner}</span></p><p><b>Status atual</b><span>${r.status}</span></p></div></article>
    ${module==='bom'?`<article class="panel wide"><h2>Ação imediata</h2><textarea>${r.immediate}</textarea><h2>Análise de causa</h2><textarea>${r.cause}</textarea><h2>Plano de ação</h2><textarea>${r.action}</textarea></article>`:`<article class="panel wide"><h2>Tratativa / Encaminhamento</h2><textarea>${r.action}</textarea></article>`}
    <article class="panel"><h2>Anexos</h2><div class="upload-zone">Arraste arquivos ou clique para anexar evidências</div><button class="btn primary full" onclick="showToast('Anexo simulado')">Anexar arquivo</button></article></section>`, `${module.toUpperCase()} ${r.id}`, 'Tela de detalhe do registro com campos editáveis e fluxo de acompanhamento.');
}
function grDetail(r){
  return shell(`<section class="detail-head"><button class="btn" onclick="setPage('gr')">← Voltar</button><div><h2>GR ${r.id}</h2><p>${r.process} · ${r.owner}</p></div>${badge(r.status)}</section>
    <section class="detail-grid"><article class="panel wide"><h2>Objetivo e meta</h2><label>Objetivo<textarea>${r.objective}</textarea></label><label>Meta<textarea>${r.metric}</textarea></label><label>Relevância<textarea>${r.relevance}</textarea></label></article><article class="panel"><h2>Resultado atual</h2><div class="score-ring"><span>${r.result}%</span></div><p class="muted">Última medição registrada em 30/04/2026.</p></article><article class="panel wide"><h2>Monitoramento</h2><div class="table-wrap"><table><thead><tr><th>Data</th><th>Resultado</th><th>Análise</th><th>Status</th></tr></thead><tbody><tr><td>31/03/2026</td><td>${Math.max(r.result-8,0)}%</td><td>Evolução parcial conforme plano definido.</td><td>${badge('No prazo')}</td></tr><tr><td>30/04/2026</td><td>${r.result}%</td><td>Necessário manter acompanhamento dos desvios.</td><td>${badge(r.status)}</td></tr></tbody></table></div></article><article class="panel"><h2>Plano de ação</h2><div class="task-list"><div class="task"><div class="module-chip">A1</div><div><b>Atualizar plano de ação vinculado à meta</b><span>${r.owner} · 30/06/2026</span></div>${badge('No prazo')}</div><div class="task"><div class="module-chip">A2</div><div><b>Revisar indicador com liderança do processo</b><span>${r.issuer} · 15/06/2026</span></div>${badge('Atenção')}</div></div></article></section>`, `GR ${r.id}`, 'Acompanhamento de objetivo, meta, resultado e plano de ação.');
}

function dashboard(){
  return shell(`<section class="dashboard"><div class="dash-title"><div><h2>Dashboard SIGO</h2><p>Visão executiva consolidada dos módulos de gestão.</p></div><button class="btn primary">Atualizar painel</button></div><div class="dash-cards">${[['Ocorrências',7],['Não conformidades',11],['Ações NC',15],['Gestão de resultados',24],['Ações GR',9]].map(x=>`<article><span>${x[0]}</span><b>${x[1]}</b></article>`).join('')}</div><div class="dashboard-grid"><article class="panel wide"><h2>Pendências por responsável</h2><div class="fake-chart">${people.slice(0,8).map((p,i)=>`<div><span>${p.split(' ')[0]}</span><i style="height:${30+(i*9)%80}%"></i></div>`).join('')}</div></article><article class="panel"><h2>Status geral</h2><div class="donut"><span>72%</span></div><p class="muted">Registros no prazo ou encerrados.</p></article><article class="panel wide"><h2>Lista gerencial de ações</h2>${docTable(documents.slice(0,5))}</article></div></section>`, 'Dashboards', 'Painéis gerenciais demonstrativos para tomada de decisão.');
}

function admin(){ return shell(`<section class="module-toolbar"><div><h2>Administração</h2><p>Usuários, perfis, permissões e parâmetros do sistema.</p></div><button class="btn primary">Criar colaborador</button></section><section class="panel"><div class="table-wrap"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Unidade</th><th>Status</th><th></th></tr></thead><tbody>${people.map((p,i)=>`<tr><td><b>${p}</b><small>${i%3===0?'Administrador':'Usuário operacional'}</small></td><td>${p.toLowerCase().replaceAll(' ','.')}@empresa.com.br</td><td>${i%3===0?'Administrador':'Usuário'}</td><td>${i%2?'Filial 1':'Matriz'}</td><td>${badge('Ativo')}</td><td><button class="btn small">Editar</button></td></tr>`).join('')}</tbody></table></div></section>`, 'Administração', 'Gestão de usuários e permissões.'); }
function reports(){ return shell(`<section class="report-grid">${['Relatório de BOM','Relatório de RO','Relatório de GR','Lista mestra de documentos','Plano de ação consolidado','Auditoria e evidências'].map(x=>`<article class="panel"><h2>${x}</h2><p>Geração simulada com filtros por período, processo, responsável e status.</p><button class="btn primary" onclick="showToast('Relatório simulado gerado')">Gerar relatório</button></article>`).join('')}</section>`, 'Relatórios', 'Extrações operacionais e gerenciais dos módulos.'); }
function support(){ return shell(`<section class="support-hero"><h2>Central de suporte</h2><p>Abra chamados, acompanhe solicitações e consulte orientações de uso do SIGO.</p><button class="btn primary">Abrir chamado</button></section><section class="mini-grid"><article><b>4h</b><span>SLA médio</span></article><article><b>12</b><span>Chamados do mês</span></article><article><b>96%</b><span>Resolvidos</span></article><article><b>24/7</b><span>Base de conhecimento</span></article></section>`, 'Suporte', 'Apoio ao usuário e solicitação de atendimento.'); }

function modal(){
  if(!state.modal) return '';
  const title = state.modal==='folder'?'Criar novo diretório':'Cadastrar novo documento';
  return `<div class="modal-back" onclick="state.modal=null;render()"><div class="modal" onclick="event.stopPropagation()"><h2>${title}</h2><label>Nome<input></label><label>Responsável<select>${people.map(p=>`<option>${p}</option>`).join('')}</select></label><label>Descrição<textarea></textarea></label><div class="modal-actions"><button class="btn" onclick="state.modal=null;render()">Cancelar</button><button class="btn primary" onclick="state.modal=null;showToast('Cadastro simulado salvo')">Salvar</button></div></div></div>`;
}

function render(){
  if(state.page==='login') return app.innerHTML = login();
  if(state.page==='home') return app.innerHTML = home();
  if(state.page==='docs') return app.innerHTML = docsPage();
  if(state.page==='bom') return app.innerHTML = listRecords('bom');
  if(state.page==='ro') return app.innerHTML = listRecords('ro');
  if(state.page==='gr') return app.innerHTML = listRecords('gr');
  if(state.page==='bomDetail') return app.innerHTML = detail('bom');
  if(state.page==='roDetail') return app.innerHTML = detail('ro');
  if(state.page==='grDetail') return app.innerHTML = detail('gr');
  if(state.page==='dash') return app.innerHTML = dashboard();
  if(state.page==='admin') return app.innerHTML = admin();
  if(state.page==='reports') return app.innerHTML = reports();
  if(state.page==='support') return app.innerHTML = support();
}
carregarBOMReal();
render();