'use strict';
/* Blocos 2 — as vistas de uma caixa (Quadro, Lista, Notas, Tabela, Calendário) e o Painel. */

const VISTAS = [['quadro', 'Quadro'], ['lista', 'Lista'], ['notas', 'Notas'], ['tabela', 'Tabela'], ['cal', 'Calendário']];
const somaPeso = l => l.reduce((n, b) => n + b.peso, 0);

function passa(b) {
  const f = U.f, t = today();
  if (f.cor && b.cor !== f.cor) return false;
  if (f.prio && b.prio < +f.prio) return false;
  if (!f.feitos && b.feito) return false;
  if (f.prazo === 'atrasado' && !atrasado(b)) return false;
  if (f.prazo === 'hoje' && b.prazo !== t) return false;
  if (f.prazo === 'semana' && !(b.prazo && b.prazo >= t && b.prazo <= addDays(t, 7))) return false;
  if (f.prazo === 'sem' && b.prazo) return false;
  if (f.txt) { const q = norma(f.txt); if (!norma(b.titulo + ' ' + b.tags + ' ' + b.texto).includes(q) && !filhos(b.id).some(k => norma(k.titulo).includes(q))) return false; }
  return true;
}
// a torre da caixa: os blocos concluídos empilham, os abertos são só o contorno
function torre(l) {
  const done = l.filter(b => b.feito).sort((a, b) => a.feito - b.feito), rest = l.filter(b => !b.feito);
  const pc = (b, g) => `<i class="${g ? 'ghost' : ''}${FX.novo === b.id ? ' novo' : ''}" style="--c:${corDe(b.cor).cor};--w:${b.peso * 16}px" title="${esc(b.titulo)}"></i>`;
  return `<div class="pile torre">${done.map(b => pc(b)).join('')}${rest.map(b => pc(b, 1)).join('')}</div>`;
}
const capForm = (attrs, ph, extra) => `<form data-form="captura" ${attrs} class="cap"><input name="q" placeholder="${ph}" aria-label="${ph}" autocomplete="off" maxlength="300"><button class="btn" aria-label="Adicionar">＋</button>${extra || ''}</form>`;

function vCaixa() {
  const cx = byId(S.caixas, U.caixa);
  if (!cx) { U.v = 'hoje'; return vHoje(); }
  const todos = raizes(cx.id), f = U.f, ent = cx.id === 'entrada', feitos = todos.filter(b => b.feito);
  const filtrando = f.txt || f.cor || f.prio || f.prazo || !f.feitos;
  return topo(`<div class="tit"><input class="title ico" data-store="caixas" data-id="${cx.id}" data-f="icone" data-redraw value="${esc(cx.icone)}" maxlength="4" placeholder="🧱" aria-label="Ícone da caixa"><input class="title" data-store="caixas" data-id="${cx.id}" data-f="nome" data-redraw value="${esc(cx.nome)}" aria-label="Nome da caixa"></div>`,
    `<button class="ib ${cx.fav ? 'on' : ''}" data-act="favCaixa" data-id="${cx.id}" aria-label="Favorita" title="Favorita">★</button>
     <details class="menu"><summary class="btn sm">Ações</summary><div>
       <button data-act="colNova" data-id="${cx.id}">Nova coluna</button><button data-act="modelosBloco" data-id="${cx.id}">Novo bloco de um modelo</button>
       <button data-act="importarTexto" data-id="${cx.id}">Colar uma lista de texto</button><button data-act="exportarCaixa" data-id="${cx.id}">Copiar a caixa como texto</button>
       <button data-act="arquivarFeitos" data-id="${cx.id}">Arquivar os concluídos</button><button data-act="salvarModeloCaixa" data-id="${cx.id}">Salvar como modelo</button>
       ${ent ? '' : `<button data-act="duplicarCaixa" data-id="${cx.id}">Duplicar a caixa</button><button data-act="moverCaixa" data-id="${cx.id}" data-n="-1">Subir na barra lateral</button><button data-act="moverCaixa" data-id="${cx.id}" data-n="1">Descer na barra lateral</button>
       <button data-act="arquivarCaixa" data-id="${cx.id}">Arquivar a caixa</button><button class="danger" data-act="delCaixa" data-id="${cx.id}">Excluir a caixa</button>`}</div></details>`)
    + `<input class="desc" data-store="caixas" data-id="${cx.id}" data-f="desc" value="${esc(cx.desc)}" placeholder="Para que serve esta caixa? (opcional)" aria-label="Descrição da caixa" maxlength="300">
    <div class="tprog" data-fx="torre">${torre(todos)}<span class="muted sm">${feitos.length} de ${plural(todos.length, 'bloco', 'blocos')} · peso ${somaPeso(feitos)}/${somaPeso(todos)}</span></div>
    <div class="tools"><div class="seg">${VISTAS.concat([...new Set([cx.vista].concat(S.set.rec || []))].filter(v => MV[v] || CV[v]).slice(0, 3).map(v => [v, (MV[v] || CV[v])[0]])).map(([v, n]) => `<button data-act="vista" data-v="${v}" class="${cx.vista === v ? 'on' : ''}">${n}</button>`).join('')}</div><button class="btn sm" data-act="maisVistas">Mais vistas (${Object.keys(MV).length + Object.keys(CV).length})</button>
      <button class="btn sm bfil${filtrando ? ' pri' : ''}" data-act="filtros">Filtros${filtrando ? ' •' : ''}</button><div class="filtros${U.filt ? ' ab' : ''}"><input type="search" data-uf="txt" value="${esc(f.txt)}" placeholder="Filtrar nesta caixa…" aria-label="Filtrar">
      <select data-uf="cor" aria-label="Etiqueta"><option value="">Toda etiqueta</option>${cores().map(c => `<option value="${c.id}" ${f.cor === c.id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select>
      <select data-uf="prazo" aria-label="Prazo">${[['', 'Todo prazo'], ['atrasado', 'Atrasados'], ['hoje', 'Para hoje'], ['semana', 'Próximos 7 dias'], ['sem', 'Sem prazo']].map(([v, n]) => `<option value="${v}" ${f.prazo === v ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <select data-uf="prio" aria-label="Prioridade">${[['', 'Toda prioridade'], ['1', '! ou mais'], ['2', '!! ou mais'], ['3', 'Só !!!']].map(([v, n]) => `<option value="${v}" ${f.prio === v ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <label class="tog"><input type="checkbox" data-uf="feitos" ${f.feitos ? 'checked' : ''}><span>Concluídos</span></label>
      ${filtrando ? `<button class="btn sm" data-act="limparFiltro">Limpar filtro</button>` : ''}
      </div><button class="btn sm ${U.sel ? 'pri' : ''}" data-act="selModo">${U.sel ? 'Sair da seleção' : 'Selecionar'}</button></div>
    <div id="vista">${vVista(cx)}</div>`;
}
function vVista(cx) {
  const l = raizes(cx.id).filter(passa);
  return ({ quadro: vQuadro, lista: vLista, notas: vNotas, tabela: vTabela, cal: (c, x) => vCal(x, c.id) }[cx.vista] || (MV[cx.vista] && MV[cx.vista][3]) || (CV[cx.vista] && CV[cx.vista][2]) || vQuadro)(cx, l);
}

/* ---------- Quadro (estilo Trello) ---------- */
function vQuadro(cx, l) {
  const cols = colsDe(cx.id);
  return `<div class="kb">${cols.map((c, i) => {
    const bs = l.filter(b => b.coluna === c.id).sort(ordB), ab = bs.filter(b => !b.feito).length, cheio = c.limite && ab >= c.limite;
    if (c.fechada) return `<section class="kcol fechada" data-drop="col" data-col="${c.id}" data-act="colFechar" data-id="${c.id}" role="button" tabindex="0" title="Abrir a coluna"><b>${esc(c.nome)}</b><span class="muted">${bs.length}</span></section>`;
    return `<section class="kcol${c.feito ? ' final' : ''}" data-drop="col" data-col="${c.id}" data-fx="${c.id}">
      <header><input class="title sm" data-store="colunas" data-id="${c.id}" data-f="nome" value="${esc(c.nome)}" aria-label="Nome da coluna">
        <span class="muted ${cheio ? 'bad' : ''}">${bs.length}${c.limite ? '/' + c.limite : ''}</span>
        <details class="menu"><summary class="ib sm" aria-label="Ações da coluna">⋯</summary><div>
          <button data-act="colMover" data-id="${c.id}" data-n="-1" ${i ? '' : 'disabled'}>Mover para a esquerda</button><button data-act="colMover" data-id="${c.id}" data-n="1" ${i < cols.length - 1 ? '' : 'disabled'}>Mover para a direita</button>
          <button data-act="colLimite" data-id="${c.id}">Limite de blocos${c.limite ? ` (${c.limite})` : ''}</button>
          <button data-act="colFinal" data-id="${c.id}">${c.feito ? 'Deixar de ser a coluna de conclusão' : 'Tornar a coluna de conclusão'}</button>
          <button data-act="colOrdenar" data-id="${c.id}">Ordenar por prazo e prioridade</button><button data-act="colFechar" data-id="${c.id}">Recolher</button>
          <button class="danger" data-act="colDel" data-id="${c.id}">Excluir a coluna</button></div></details></header>
      ${c.feito ? '<p class="muted sm cfinal">Soltar aqui conclui o bloco</p>' : ''}
      ${bs.map(b => card(b)).join('') || '<p class="kvazio">solte um bloco aqui</p>'}
      ${capForm(`data-col="${c.id}"`, 'Novo bloco…')}</section>`;
  }).join('')}<button class="btn add kadd" data-act="colNova" data-id="${cx.id}">＋ Coluna</button></div>`;
}

/* ---------- Lista (estilo Google Tarefas) ---------- */
const ORDENS = { manual: ['Minha ordem', null], prazo: ['Prazo', (a, b) => (a.prazo || '9').localeCompare(b.prazo || '9')], prio: ['Prioridade', (a, b) => b.prio - a.prio], titulo: ['Título', (a, b) => a.titulo.localeCompare(b.titulo, 'pt')], criado: ['Mais novos', (a, b) => b.criado - a.criado], peso: ['Peso', (a, b) => b.peso - a.peso] };
function linha(b, nivel) {
  const k = filhos(b.id), ab = U.abertos.has(b.id);
  return card(b, { mais: k.length || nivel < 2 ? `<button class="ib sm" data-act="abrirSub" data-id="${b.id}" aria-label="${ab ? 'Fechar' : 'Abrir'} os blocos de dentro">${ab ? '▾' : '▸'}</button>` : '' })
    + (ab ? `<div class="sub">${k.map(x => linha(x, nivel + 1)).join('')}${capForm(`data-pai="${b.id}"`, 'Bloco de dentro…')}</div>` : '');
}
function vLista(cx, l) {
  const cols = colsDe(cx.id), ord = ORDENS[U.ord][1], fe = l.filter(b => b.feito).sort((a, b) => b.feito - a.feito);
  return `<div class="tools"><label class="inl">Ordem <select data-u="ord">${Object.entries(ORDENS).map(([k, v]) => `<option value="${k}" ${U.ord === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></label>
      <button class="btn sm" data-act="abrirTodos">${U.abertos.size ? 'Fechar todos' : 'Abrir todos'}</button></div>
    <div class="lista">${cols.map(c => {
      const bs = l.filter(b => b.coluna === c.id && !b.feito).sort(ordB); if (ord) bs.sort((a, b) => (b.fixo - a.fixo) || ord(a, b));
      return `<section class="sec" data-drop="col" data-col="${c.id}">${cols.length > 1 ? `<h4>${esc(c.nome)} <span class="muted">${bs.length}</span></h4>` : ''}
        ${c.feito ? '' : capForm(`data-col="${c.id}"`, 'Nova tarefa… (ex.: Pagar boleto sexta #urgente)')}${bs.map(b => linha(b, 0)).join('')}</section>`;
    }).join('')}
    ${fe.length ? `<details class="feitos"${U.verFeitos ? ' open' : ''}><summary data-act="verFeitos">Concluídos (${fe.length})</summary>${fe.map(b => linha(b, 0)).join('')}</details>` : ''}</div>`;
}

/* ---------- Notas (estilo Evernote) ---------- */
function vNotas(cx, l) {
  const bs = l.slice().sort((a, b) => (b.fixo - a.fixo) || (b.mod - a.mod));
  return `<div class="tools"><button class="btn pri sm" data-act="novaNota" data-id="${cx.id}">Nova nota</button><span class="muted sm">As mais recentes primeiro; as fixadas ficam no topo.</span></div>
    <div class="notas">${bs.map(b => { const c = corDe(b.cor), k = filhos(b.id); return `<article class="nt${b.feito ? ' feito' : ''}" data-act="abrir" data-id="${b.id}" role="button" tabindex="0" draggable="true" style="--c:${c.cor}">
      <h3>${b.fixo ? '◆ ' : ''}${b.estrela ? '★ ' : ''}${esc(b.titulo) || 'Sem título'}</h3>
      ${b.texto ? `<div class="md prev">${md(b.texto.slice(0, 500))}</div>` : k.length ? `<ul class="muted sm">${k.slice(0, 5).map(x => `<li>${x.feito ? '✓ ' : ''}${esc(x.titulo)}</li>`).join('')}</ul>` : '<p class="muted sm">Sem texto.</p>'}
      <p class="muted sm pe">${b.forma === 'nota' ? 'Nota' : b.feito ? 'Tarefa concluída' : 'Tarefa'}${b.prazo ? ' · ' + fmtDia(b.prazo) : ''}${tagsDe(b).map(t => ' #' + esc(t)).join('')}</p></article>`; }).join('') || '<p class="empty">Nenhuma nota nesta caixa.</p>'}</div>`;
}

/* ---------- Tabela (estilo Notion) ---------- */
function vTabela(cx, l) {
  const cols = colsDe(cx.id), s = U.ts, v = { titulo: b => norma(b.titulo), coluna: b => (byId(cols, b.coluna) || {}).ordem || 0, cor: b => corDe(b.cor).nome, prazo: b => b.prazo || '9', prio: b => -b.prio, peso: b => -b.peso, sub: b => -filhos(b.id).length, criado: b => -b.criado, ordem: b => b.ordem }[s.k];
  const bs = l.slice().sort((a, b) => { const x = v(a), y = v(b); return (x < y ? -1 : x > y ? 1 : 0) * s.d; });
  const th = (k, n) => `<th data-act="tsort" data-k="${k}" role="button" tabindex="0">${n}${s.k === k ? (s.d > 0 ? ' ▴' : ' ▾') : ''}</th>`;
  return `<div class="tw"><table class="tab"><thead><tr><th></th>${th('titulo', 'Bloco')}${th('coluna', 'Coluna')}${th('cor', 'Etiqueta')}${th('prazo', 'Prazo')}${th('prio', 'Prioridade')}${th('peso', 'Peso')}${th('sub', 'Dentro')}${th('criado', 'Criado')}</tr></thead><tbody>
    ${bs.map(b => { const c = corDe(b.cor), k = filhos(b.id); return `<tr class="${b.feito ? 'feito' : ''}${U.sel && U.sel.has(b.id) ? ' sel' : ''}" data-id="${b.id}">
      <td>${b.forma === 'nota' ? '¶' : `<button class="chk" data-act="check" data-id="${b.id}" aria-label="Concluir">${b.feito ? '✓' : ''}</button>`}</td>
      <td class="tt" data-act="abrir" data-id="${b.id}" role="button" tabindex="0">${b.estrela ? '★ ' : ''}${esc(b.titulo) || 'Sem título'}</td>
      <td><select data-store="blocos" data-id="${b.id}" data-f="coluna" aria-label="Coluna">${cols.map(x => `<option value="${x.id}" ${x.id === b.coluna ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</select></td>
      <td><select data-store="blocos" data-id="${b.id}" data-f="cor" aria-label="Etiqueta" style="box-shadow:inset 5px 0 0 ${c.cor}"><option value="">—</option>${cores().map(x => `<option value="${x.id}" ${x.id === b.cor ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</select></td>
      <td><input type="date" data-store="blocos" data-id="${b.id}" data-f="prazo" value="${b.prazo}" class="${atrasado(b) ? 'bad' : ''}" aria-label="Prazo"></td>
      <td><select data-store="blocos" data-id="${b.id}" data-f="prio" aria-label="Prioridade">${['—', '!', '!!', '!!!'].map((n, i) => `<option value="${i}" ${b.prio === i ? 'selected' : ''}>${n}</option>`).join('')}</select></td>
      <td><select data-store="blocos" data-id="${b.id}" data-f="peso" aria-label="Peso">${[1, 2, 3].map(i => `<option value="${i}" ${b.peso === i ? 'selected' : ''}>${i}</option>`).join('')}</select></td>
      <td class="muted">${k.length ? k.filter(x => x.feito).length + '/' + k.length : ''}</td><td class="muted">${b.criado ? new Date(b.criado).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }) : ''}</td></tr>`; }).join('')}
    </tbody><tfoot><tr><td></td><td>${plural(bs.length, 'bloco', 'blocos')}</td><td colspan="4"></td><td>${somaPeso(bs)}</td><td colspan="2"></td></tr></tfoot></table></div>
    ${capForm(`data-caixa="${cx.id}"`, 'Nova linha…')}`;
}

/* ---------- Calendário ---------- */
function vCal(l, caixa) {
  const [y, m] = U.mes.split('-').map(Number), prim = new Date(y, m - 1, 1), ini = addDays(ymd(prim), -((prim.getDay() + 6) % 7)), t = today();
  const sem = l.filter(b => !b.prazo && !b.feito);
  return `<div class="tools"><button class="ib" data-act="mes" data-n="-1" aria-label="Mês anterior">‹</button><b class="mesn">${prim.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</b><button class="ib" data-act="mes" data-n="1" aria-label="Mês seguinte">›</button><button class="btn sm" data-act="mes" data-n="0">Hoje</button></div>
    <div class="cal"><div class="cw">${['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'].map(d => `<span>${d}</span>`).join('')}</div>
    <div class="cg">${Array.from({ length: 42 }, (_, i) => { const d = addDays(ini, i), bs = l.filter(b => b.prazo === d), fora = parse(d).getMonth() !== m - 1;
      return `<div class="cd${fora ? ' fora' : ''}${d === t ? ' hoje' : ''}" data-drop="dia" data-dia="${d}"><button class="cn" data-act="novoDia" data-dia="${d}" data-caixa="${caixa || ''}" title="Novo bloco neste dia">${parse(d).getDate()}</button>
        ${bs.slice(0, 3).map(b => `<span class="cchip${b.feito ? ' feito' : ''}" draggable="true" data-act="abrir" data-id="${b.id}" style="--c:${corDe(b.cor).cor};--ink:${ink(corDe(b.cor).cor)}">${esc(b.titulo)}</span>`).join('')}${bs.length > 3 ? `<span class="muted sm">+${bs.length - 3}</span>` : ''}</div>`; }).join('')}</div></div>
    ${sem.length ? `<h4>Sem prazo: arraste para um dia <span class="muted">${sem.length}</span></h4><div class="semdata">${sem.slice(0, 30).map(b => card(b, { caixa: !caixa })).join('')}</div>` : ''}`;
}

/* ---------- Painel ---------- */
function historico() {
  const feitos = S.blocos.filter(b => b.feito && !b.lixo && b.forma !== 'nota').sort((a, b) => a.feito - b.feito), dias = {};
  feitos.forEach(b => { const d = ymd(new Date(b.feito)); dias[d] = (dias[d] || 0) + 1; });
  let seq = 0, d = today(); if (!dias[d]) d = addDays(d, -1);
  while (dias[d]) { seq++; d = addDays(d, -1); }
  let maior = 0, run = 0, ant = '';
  Object.keys(dias).sort().forEach(k => { run = ant && addDays(ant, 1) === k ? run + 1 : 1; maior = Math.max(maior, run); ant = k; });
  return { feitos, dias, seq, maior, recorde: Math.max(0, ...Object.values(dias)), xp: somaPeso(feitos) };
}
const NIVEIS = [[0, 'Aprendiz'], [20, 'Montador'], [60, 'Construtor'], [150, 'Mestre de obras'], [400, 'Engenheiro'], [1000, 'Arquiteto']];
function vPainel() {
  const h = historico(), t = today(), vivos = S.blocos.filter(b => vivo(b) && b.forma !== 'nota'), ab = vivos.filter(b => !b.feito), at = ab.filter(atrasado);
  const d14 = Array.from({ length: 14 }, (_, i) => addDays(t, i - 13)), max = Math.max(1, ...d14.map(d => h.dias[d] || 0));
  const s7 = Date.now() - 7 * 864e5, criados = S.blocos.filter(b => b.criado >= s7 && !b.lixo).length, feitos7 = h.feitos.filter(b => b.feito >= s7).length;
  let nv = 0; NIVEIS.forEach((n, i) => { if (h.xp >= n[0]) nv = i; });
  const prox = NIVEIS[nv + 1], pct = prox ? (h.xp - NIVEIS[nv][0]) / (prox[0] - NIVEIS[nv][0]) * 100 : 100;
  const bar = (nome, cor, n, mx, txt) => `<div class="bar"><span class="bl">${cor ? `<i class="dot" style="background:${cor}"></i>` : ''}${esc(nome)}</span><span class="bt"><i style="width:${mx ? n / mx * 100 : 0}%;background:${cor || 'var(--ink)'}"></i></span><span class="bv">${txt}</span></div>`;
  const porCx = S.caixas.filter(c => !c.arquivada).map(c => { const r = raizes(c.id).filter(b => b.forma !== 'nota'); return { c, n: r.length, f: r.filter(b => b.feito).length }; }).filter(x => x.n);
  const porCor = cores().concat(SEM_COR).map(c => ({ c, n: ab.filter(b => corDe(b.cor).id === c.id).length })).filter(x => x.n), mxC = Math.max(1, ...porCor.map(x => x.n));
  const cq = [['Primeira peça', 'Conclua um bloco', h.feitos.length >= 1], ['Dez peças', '10 blocos concluídos', h.feitos.length >= 10], ['Cem peças', '100 blocos concluídos', h.feitos.length >= 100],
    ['Três em linha', '3 dias seguidos concluindo', h.maior >= 3], ['Semana cheia', '7 dias seguidos concluindo', h.maior >= 7], ['Meta batida', 'Bata a meta do dia', cfg().meta > 0 && Object.values(h.dias).some(n => n >= cfg().meta)],
    ['Caixa montada', 'Conclua todos os blocos de uma caixa', porCx.some(x => x.c.id !== 'entrada' && x.n >= 3 && x.f === x.n)], ['Entrada vazia', 'Esvazie a caixa de entrada', h.feitos.length > 0 && !raizes('entrada').some(b => !b.feito)],
    ['Bem encaixado', 'Conclua um bloco com 5 blocos dentro', h.feitos.some(b => filhos(b.id).length >= 5)], ['Organizador', 'Tenha 5 caixas', S.caixas.filter(c => !c.arquivada).length >= 5],
    ['Sem atraso', 'Nenhum bloco atrasado, com 10 abertos', ab.length >= 10 && !at.length], ['Escritor', 'Escreva 10 notas', S.blocos.filter(b => b.forma === 'nota' && !b.lixo).length >= 10]];
  const muro = h.feitos.slice(-160);
  return topo('<h2>Painel</h2>', '') + `<div class="stats s4">
      <div class="panel stat"><b>${ab.length}</b><span>blocos abertos${at.length ? ` · <span class="bad">${at.length} atrasados</span>` : ''}</span></div>
      <div class="panel stat"><b>${h.dias[t] || 0}${cfg().meta ? '/' + cfg().meta : ''}</b><span>concluídos hoje</span></div>
      <div class="panel stat"><b>${h.seq}</b><span>${h.seq === 1 ? 'dia seguido' : 'dias seguidos'} · maior ${h.maior} · recorde ${h.recorde} num dia</span></div>
      <div class="panel stat nivel"><b>${NIVEIS[nv][1]}</b><span>peso ${h.xp} entregue${prox ? ` · faltam ${prox[0] - h.xp} para ${prox[1]}` : ''}</span><div class="meter"><i style="width:${pct}%"></i></div></div></div>
    <div class="cols"><section class="panel"><h3>Últimos 14 dias</h3><div class="horas d14">${d14.map(d => `<i style="height:${(h.dias[d] || 0) / max * 100}%" title="${fmtData(d, { day: 'numeric', month: 'short' })}: ${h.dias[d] || 0}"></i>`).join('')}</div>
        <p class="muted sm hint">Nos últimos 7 dias: ${plural(criados, 'bloco criado', 'blocos criados')}, ${plural(feitos7, 'concluído', 'concluídos')}. ${criados > feitos7 + 3 ? 'Está entrando mais do que saindo.' : 'A pilha está sob controle.'}</p></section>
      <section class="panel"><h3>Abertos por etiqueta</h3>${porCor.map(x => bar(x.c.nome, x.c.cor, x.n, mxC, String(x.n))).join('') || '<p class="muted sm">Nada aberto.</p>'}</section>
      <section class="panel"><h3>Progresso das caixas</h3>${porCx.map(x => `<div data-act="irCaixa" data-id="${x.c.id}" role="button" tabindex="0" class="lk">${bar((x.c.icone ? x.c.icone + ' ' : '') + x.c.nome, '', x.f, x.n, x.f + '/' + x.n)}</div>`).join('') || '<p class="muted sm">Nenhuma caixa com tarefas.</p>'}</section>
      <section class="panel"><h3>Conquistas <span class="muted">${cq.filter(c => c[2]).length}/${cq.length}</span></h3><div class="selos">${cq.map(c => `<div class="cq ${c[2] ? 'ok' : ''}"><i></i><div><b>${c[0]}</b><span>${c[1]}</span></div></div>`).join('')}</div></section></div>
    <section class="panel" style="margin-top:16px"><h3>O muro</h3><div class="muro">${muro.map(b => `<i style="--c:${corDe(b.cor).cor};--w:${b.peso * 20}px" title="${esc(b.titulo)}"></i>`).join('') || '<p class="empty">Cada bloco concluído vira um tijolo aqui.</p>'}</div></section>`;
}
