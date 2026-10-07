'use strict';
/* Blocos 2 — vinte vistas clássicas novas. Diferente das derivadas (mais.js), cada uma tem um jeito próprio de trabalhar:
   editar em tópicos, escrever numa página, navegar em colunas, posicionar numa mesa livre, marcar hábitos…
   CV[id] = [nome, descrição, função(caixa, blocos filtrados)]. */

const rotulo = b => esc(b.titulo) || 'Sem título';
const hhmm = ts => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const corV = b => corDe(b.cor).cor;
const marca = b => b.forma === 'nota' ? '<span class="tpn">¶</span>' : `<input type="checkbox" data-chk="${b.id}" ${b.feito ? 'checked' : ''} aria-label="Concluir">`;
const DSEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

const CV = {
  topicos: ['Tópicos', 'Editor de tópicos: Enter cria, Tab encaixa, Shift+Tab desencaixa.', (cx, l) => {
    const no = (b, n) => `<div class="tp${b.feito ? ' feito' : ''}" style="padding-left:${n * 24}px">${marca(b)}<i class="dot" style="background:${corV(b)}"></i>
      <input class="tpi" data-store="blocos" data-id="${b.id}" data-f="titulo" value="${esc(b.titulo)}" placeholder="Escreva…" aria-label="Título" maxlength="300">
      <button class="ib sm" data-act="tpOut" data-id="${b.id}" title="Desencaixar (Shift+Tab)" aria-label="Desencaixar">←</button><button class="ib sm" data-act="tpIn" data-id="${b.id}" title="Encaixar na linha de cima (Tab)" aria-label="Encaixar">→</button>
      <button class="ib sm" data-act="tpNovo" data-id="${b.id}" title="Nova linha abaixo (Enter)" aria-label="Nova linha">＋</button><button class="ib sm" data-act="abrir" data-id="${b.id}" title="Abrir o cartão" aria-label="Abrir o cartão">⋯</button></div>${filhos(b.id).map(x => no(x, n + 1)).join('')}`;
    return `<div class="tps">${l.slice().sort(ordB).map(b => no(b, 0)).join('')}</div>${capForm(`data-caixa="${cx.id}"`, 'Novo tópico…')}`;
  }],
  pagina: ['Página', 'Um documento só: cada bloco é uma seção com título e texto editáveis no lugar.', (cx, l) => `<div class="pag">${l.slice().sort(ordB).map(b => `<section style="--c:${corV(b)}"><div class="pgh">${marca(b)}<input class="title" data-store="blocos" data-id="${b.id}" data-f="titulo" value="${esc(b.titulo)}" placeholder="Título da seção" aria-label="Título"><button class="ib sm" data-act="abrir" data-id="${b.id}" aria-label="Abrir o cartão">⋯</button></div>
      <textarea data-store="blocos" data-id="${b.id}" data-f="texto" rows="${Math.max(2, b.texto.split('\n').length + 1)}" placeholder="Escreva aqui…" aria-label="Texto">${esc(b.texto)}</textarea></section>`).join('')}</div>${capForm(`data-caixa="${cx.id}"`, 'Nova seção…')}`],
  caderno: ['Caderno', 'Lista de notas à esquerda, a nota aberta para escrever à direita.', (cx, l) => {
    const a = l.slice().sort(ordB), b = a.find(x => x.id === U.nota) || a[0];
    if (!b) return nada('Nenhuma nota.') + `<button class="btn pri" data-act="novaNota" data-id="${cx.id}">Nova nota</button>`;
    return `<div class="cad"><div class="cadl"><button class="btn sm pri" data-act="novaNota" data-id="${cx.id}">Nova nota</button>${a.map(x => `<button class="cadi${x.id === b.id ? ' on' : ''}" data-act="cadSel" data-id="${x.id}" style="--c:${corV(x)}"><b>${rotulo(x)}</b><small>${esc(x.texto.replace(/[#*\`>\[\]]/g, '').slice(0, 70)) || 'Sem texto'}</small></button>`).join('')}</div>
      <div class="cade" style="--c:${corV(b)}"><input class="title big" data-store="blocos" data-id="${b.id}" data-f="titulo" value="${esc(b.titulo)}" placeholder="Título" aria-label="Título">
        <div class="chips">${cores().map(x => `<button class="cor ${b.cor === x.id ? 'on' : ''}" data-act="prop" data-id="${b.id}" data-k="cor" data-v="${b.cor === x.id ? '' : x.id}" style="--c:${x.cor};--ink:${ink(x.cor)}">${esc(x.nome)}</button>`).join('')}</div>
        <textarea data-store="blocos" data-id="${b.id}" data-f="texto" rows="16" placeholder="Escreva a nota…" aria-label="Texto">${esc(b.texto)}</textarea>
        <p class="muted sm">${b.mod ? 'Alterada em ' + fmtQuando(b.mod) + ' · ' : ''}<a href="#" data-act="abrir" data-id="${b.id}">Abrir o cartão completo</a></p></div></div>`;
  }],
  agendasem: ['Agenda semanal', 'Sete dias por hora, das 6h às 22h. Solte um bloco na hora certa.', (cx, l) => {
    const t = today(), ds = Array.from({ length: 7 }, (_, i) => addDays(t, i)), hr = b => Math.max(6, Math.min(22, +b.hora.slice(0, 2)));
    const cel = (d, h) => `<div class="cel" data-drop="g" data-modo="${h ? 'hora' : 'periodo'}" data-col="${d}|${h ? pad(h) + ':00' : ''}">${l.filter(b => b.prazo === d && (h ? b.hora && hr(b) === h : !b.hora)).map(chip).join('')}</div>`;
    return `<div class="tw"><div class="sg ag"><span></span>${ds.map(d => `<b>${fmtDia(d)}</b>`).join('')}<b>Sem hora</b>${ds.map(d => cel(d, 0)).join('')}${Array.from({ length: 17 }, (_, i) => i + 6).map(h => `<b>${h}h</b>` + ds.map(d => cel(d, h)).join('')).join('')}</div></div>${sec('Sem prazo: arraste para a agenda', ab(l).filter(b => !b.prazo).slice(0, 20))}`;
  }],
  raias: ['Quadro com raias', 'As colunas do quadro cruzadas com as etiquetas, uma raia por cor.', (cx, l) => {
    const cols = colsDe(cx.id), rs = cores().concat(SEM_COR).filter(r => l.some(b => corDe(b.cor).id === r.id));
    return rs.length ? `<div class="tw"><div class="raias" style="grid-template-columns:110px repeat(${cols.length}, minmax(190px, 1fr))"><span></span>${cols.map(c => `<b>${esc(c.nome)}</b>`).join('')}${rs.map(r => `<b class="rn" style="--c:${r.cor}">${esc(r.nome)}</b>` + cols.map(c => `<div class="cel" data-drop="g" data-modo="raia" data-col="${c.id}|${r.id}">${l.filter(b => b.coluna === c.id && corDe(b.cor).id === r.id).sort(ordB).map(b => card(b)).join('')}</div>`).join('')).join('')}</div></div>` : nada('Nenhum bloco.');
  }],
  mesa: ['Mesa livre', 'Uma mesa sem linhas: arraste cada bloco para onde fizer sentido.', (cx, l) => {
    const a = ab(l).sort(ordB), pos = (b, i) => b.x || b.y ? [b.x, b.y] : [12 + (i % 4) * 204, 16 + Math.floor(i / 4) * 78];
    return `<div class="tools"><button class="btn sm" data-act="mesaArrumar">Arrumar em grade</button><span class="muted sm">As posições ficam guardadas e sincronizam.</span></div>
      <div class="mesa" data-drop="g" data-modo="mesa">${a.map((b, i) => { const [x, y] = pos(b, i); return `<div class="mp" style="left:${x}px;top:${y}px">${card(b)}</div>`; }).join('')}</div>`;
  }],
  jornal: ['Diário','Escreva uma entrada e ela entra na data de hoje; as antigas ficam abaixo, dia por dia.', (cx, l) => {
    const a = l.slice().sort((x, y) => y.criado - x.criado), ds = [...new Set(a.map(b => dataDe(b.criado)))];
    return `<form data-form="diario" data-id="${cx.id}" class="dform"><textarea name="t" rows="3" placeholder="O que aconteceu? A primeira linha vira o título." aria-label="Nova entrada" required></textarea><button class="btn pri">Registrar</button></form>`
      + ds.map(d => `<h4>${fmtDia(d)} <span class="muted">${fmtData(d, { day: 'numeric', month: 'long' })}</span></h4>${a.filter(b => dataDe(b.criado) === d).map(b => `<article class="ent" data-act="abrir" data-id="${b.id}" role="button" tabindex="0" style="--c:${corV(b)}"><small class="muted">${hhmm(b.criado)}</small><div><b>${rotulo(b)}</b>${b.texto ? `<div class="md prev">${md(b.texto.slice(0, 400))}</div>` : ''}</div></article>`).join('')}`).join('');
  }],
  keep: ['Cartões com lista', 'Cada bloco é um cartão com a lista do que tem dentro, para marcar ali mesmo.', (cx, l) => `<div class="notas">${ab(l).sort(ordB).map(b => `<article class="nt kp" style="--c:${corV(b)}"><h3 data-act="abrir" data-id="${b.id}" role="button" tabindex="0">${rotulo(b)}</h3>${filhos(b.id).map(k => `<label class="mdc"><input type="checkbox" data-chk="${k.id}" ${k.feito ? 'checked' : ''}><span>${rotulo(k)}</span></label>`).join('')}${capForm(`data-pai="${b.id}"`, 'Item…')}</article>`).join('')}</div>${capForm(`data-caixa="${cx.id}"`, 'Novo cartão…')}`],
  abas: ['Abas', 'Uma coluna por vez, em abas no alto. Solte um bloco numa aba para mudar de coluna.', (cx, l) => {
    const cols = colsDe(cx.id), c = cols.find(x => x.id === U.aba) || cols[0], bs = l.filter(b => b.coluna === c.id).sort(ordB), fe = bs.filter(b => b.feito);
    return `<div class="abas">${cols.map(x => `<button class="${x.id === c.id ? 'on' : ''}" data-act="aba" data-id="${x.id}" data-drop="col" data-col="${x.id}">${esc(x.nome)} <small>${l.filter(b => b.coluna === x.id && !b.feito).length}</small></button>`).join('')}</div>
      <div class="lista">${capForm(`data-col="${c.id}"`, 'Nova tarefa nesta aba…')}${ab(bs).map(b => card(b)).join('') || nada('Nada aberto nesta aba.')}${fe.length ? `<details class="feitos"><summary>Concluídos (${fe.length})</summary>${fe.map(b => card(b)).join('')}</details>` : ''}</div>`;
  }],
  navegador: ['Navegador em colunas', 'Colunas lado a lado: a coluna, o bloco, o que há dentro dele e o detalhe.', (cx, l) => {
    const cols = colsDe(cx.id), nav = U.nav || [], c = cols.find(x => x.id === nav[0]) || cols[0];
    const painel = (itens, sel, n) => `<div class="mc">${itens.map(x => `<button class="${x.id === sel ? 'on' : ''}" data-act="navSel" data-n="${n}" data-id="${x.id}"><span>${x.r}</span>${x.k ? '<i>›</i>' : ''}</button>`).join('') || '<p class="muted sm">vazio</p>'}</div>`;
    let h = painel(cols.map(x => ({ id: x.id, r: esc(x.nome), k: 1 })), c.id, 0), itens = l.filter(b => b.coluna === c.id).sort(ordB), n = 1, sel = null;
    for (;;) { const s = itens.find(b => b.id === nav[n]); h += painel(itens.map(b => ({ id: b.id, r: ponto(corV(b)) + ' ' + rotulo(b), k: filhos(b.id).length })), s && s.id, n); if (!s) break; sel = s; itens = filhos(s.id); n++; if (!itens.length) break; }
    if (sel) h += `<div class="mc det" style="--c:${corV(sel)}"><h3>${rotulo(sel)}</h3><p class="muted sm">${esc(corDe(sel.cor).nome)}${sel.prazo ? ' · ' + fmtDia(sel.prazo) : ''}${sel.feito ? ' · concluído' : ''}</p>${sel.texto ? `<div class="md">${md(sel.texto, sel.id)}</div>` : ''}<div class="acts">${sel.forma === 'nota' ? '' : `<button class="btn sm pri" data-act="check" data-id="${sel.id}">${sel.feito ? 'Reabrir' : 'Concluir'}</button>`}<button class="btn sm" data-act="abrir" data-id="${sel.id}">Abrir o cartão</button></div></div>`;
    return `<div class="tw"><div class="miller">${h}</div></div>`;
  }],
  habitos: ['Hábitos', 'As rotinas da caixa em quatorze dias. Marque o de hoje e veja a sequência.', (cx, l) => {
    const t = today(), ds = Array.from({ length: 14 }, (_, i) => addDays(t, i - 13)), rs = S.blocos.filter(b => b.caixa === cx.id && b.repete && !b.feito && vivo(b)), fe = S.blocos.filter(b => b.caixa === cx.id && b.feito && !b.lixo);
    if (!rs.length) return nada('Nenhuma rotina nesta caixa. Abra um bloco e escolha uma opção em “Repete”.');
    return `<div class="tw"><table class="tab hab"><thead><tr><th>Rotina</th>${ds.map(d => `<th class="${d === t ? 'hj' : ''}">${parse(d).getDate()}<br><small>${DSEM[parse(d).getDay()]}</small></th>`).join('')}<th>Seguidos</th></tr></thead><tbody>${rs.map(b => {
      const dias = new Set(fe.filter(x => x.titulo === b.titulo).map(x => dataDe(x.feito))); let s = 0, d = dias.has(t) ? t : addDays(t, -1); while (dias.has(d)) { s++; d = addDays(d, -1); }
      return `<tr><td class="tt" data-act="abrir" data-id="${b.id}" role="button" tabindex="0">${ponto(corV(b))} ${rotulo(b)} <span class="muted sm">${REPETE[b.repete].toLowerCase()}</span></td>${ds.map(x => `<td>${x === t && !dias.has(t) ? `<button class="hb" data-act="check" data-id="${b.id}" aria-label="Marcar hoje" title="Marcar hoje"></button>` : `<i class="hb${dias.has(x) ? ' ok' : ''}" style="--c:${corV(b)}"></i>`}</td>`).join('')}<td><b>${s}</b></td></tr>`; }).join('')}</tbody></table></div>`;
  }],
  slides: ['Apresentação', 'Um bloco por tela, em letras grandes. Setas do teclado passam; há tela cheia.', (cx, l) => {
    const a = l.slice().sort(ordB); if (!a.length) return nada('Nenhum bloco para apresentar.');
    const i = (((U.slide || 0) % a.length) + a.length) % a.length, b = a[i], k = filhos(b.id);
    return `<div class="tools"><button class="btn sm" data-act="um" data-k="slide" data-n="-1">‹ Anterior</button><span class="muted sm">${i + 1} / ${a.length}</span><button class="btn sm" data-act="um" data-k="slide" data-n="1">Próximo ›</button><button class="btn sm" data-act="telaCheia">Tela cheia</button></div>
      <article class="slide" style="--c:${corV(b)}"><h1>${rotulo(b)}</h1>${b.texto ? `<div class="md">${md(b.texto)}</div>` : ''}${k.length ? `<ul>${k.map(x => `<li class="${x.feito ? 'feito' : ''}">${rotulo(x)}</li>`).join('')}</ul>` : ''}<small>${esc(cx.nome)} · ${i + 1}</small></article>`;
  }],
  trilha: ['Trilha de marcos', 'Uma linha vertical do tempo, com cada prazo como um marco e o “hoje” no meio.', (cx, l) => {
    const a = l.filter(b => b.prazo).sort((x, y) => x.prazo.localeCompare(y.prazo)), t = today(); let hj = false;
    const marco = '<div class="tm hoje"><span>Hoje</span></div>';
    return a.length ? `<div class="trilha">${a.map(b => { const m = !hj && b.prazo >= t ? (hj = true, marco) : ''; return m + `<div class="tm${b.feito ? ' feito' : ''}" style="--c:${corV(b)}"><span class="${atrasado(b) ? 'bad' : ''}">${fmtData(b.prazo, { day: 'numeric', month: 'short' })}</span>${card(b)}</div>`; }).join('')}${hj ? '' : marco}</div>` : nada('Nenhum bloco com prazo.');
  }],
  pivot: ['Tabela dinâmica', 'Etiquetas nas linhas, colunas nas colunas, e a contagem em cada cruzamento.', (cx, l) => {
    const cols = colsDe(cx.id), rs = cores().concat(SEM_COR), n = (c, r) => l.filter(b => (!c || b.coluna === c.id) && (!r || corDe(b.cor).id === r.id));
    return `<div class="tw"><table class="tab piv"><thead><tr><th>Etiqueta</th>${cols.map(c => `<th>${esc(c.nome)}</th>`).join('')}<th>Total</th></tr></thead><tbody>${rs.map(r => n(null, r).length ? `<tr><td>${ponto(r.cor)} ${esc(r.nome)}</td>${cols.map(c => { const x = n(c, r); return `<td>${x.length ? `<button data-act="pivo" data-cor="${r.id}"><b>${x.length}</b> <span class="muted">peso ${somaPeso(x)}</span></button>` : '<span class="muted">·</span>'}</td>`; }).join('')}<td><b>${n(null, r).length}</b></td></tr>` : '').join('')}</tbody>
      <tfoot><tr><td>Total</td>${cols.map(c => `<td>${n(c).length}</td>`).join('')}<td>${l.length}</td></tr></tfoot></table></div><p class="muted sm hint">Toque num número para ver o quadro só com aquela etiqueta.</p>`;
  }],
  form: ['Formulário', 'Cadastre um bloco completo de uma vez, com todos os campos, e já parta para o próximo.', (cx, l) => `<form data-form="completo" data-id="${cx.id}" class="panel fform">
      <label class="fld">Título<input name="titulo" required maxlength="300" placeholder="O que é?"></label>
      <div class="props"><label>Tipo<select name="forma"><option value="tarefa">Tarefa</option><option value="nota">Nota</option></select></label>
        <label>Coluna<select name="coluna">${colsDe(cx.id).map(c => `<option value="${c.id}">${esc(c.nome)}</option>`).join('')}</select></label>
        <label>Etiqueta<select name="cor"><option value="">Sem etiqueta</option>${cores().map(c => `<option value="${c.id}">${esc(c.nome)}</option>`).join('')}</select></label>
        <label>Prioridade<select name="prio">${['Sem prioridade', '!', '!!', '!!!'].map((n, i) => `<option value="${i}">${n}</option>`).join('')}</select></label>
        <label>Prazo<input type="date" name="prazo"></label><label>Hora<input type="time" name="hora"></label>
        <label>Peso<select name="peso"><option value="1">1 pino</option><option value="2">2 pinos</option><option value="3">3 pinos</option></select></label>
        <label>Etiquetas livres<input name="tags" placeholder="casa, banco" maxlength="200"></label></div>
      <label class="fld">Texto<textarea name="texto" rows="4" placeholder="Detalhes (opcional)"></textarea></label>
      <label class="fld">Blocos de dentro, um por linha<textarea name="dentro" rows="3" placeholder="Passo 1&#10;Passo 2"></textarea></label>
      <div class="acts"><button class="btn pri">Adicionar bloco</button></div></form>${sec('Últimos criados', l.slice().sort((a, b) => b.criado - a.criado).slice(0, 5))}`],
  planner: ['Planner mensal', 'O mês em linhas, um dia por linha, com um campo para anotar em cada dia.', (cx, l) => {
    const [y, m] = U.mes.split('-').map(Number), dias = new Date(y, m, 0).getDate(), t = today();
    return `<div class="tools"><button class="ib" data-act="mes" data-n="-1" aria-label="Mês anterior">‹</button><b class="mesn">${new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</b><button class="ib" data-act="mes" data-n="1" aria-label="Mês seguinte">›</button><button class="btn sm" data-act="mes" data-n="0">Hoje</button></div>
      <div class="plan">${Array.from({ length: dias }, (_, i) => { const d = `${U.mes}-${pad(i + 1)}`, wd = parse(d).getDay(); return `<div class="pd${wd === 0 || wd === 6 ? ' fds' : ''}${d === t ? ' hoje' : ''}" data-drop="g" data-modo="dia" data-col="${d}"><b>${i + 1}</b><small>${DSEM[wd]}</small><div>${l.filter(b => b.prazo === d).map(chip).join('')}</div>${capForm(`data-caixa="${cx.id}" data-prazo="${d}"`, 'anotar…')}</div>`; }).join('')}</div>`;
  }],
  conversa: ['Conversa', 'Os blocos como mensagens, na ordem em que foram criados. Escreva embaixo e envie.', (cx, l) => {
    const a = l.slice().sort((x, y) => x.criado - y.criado).slice(-80); let ant = '';
    return `<div class="chat">${a.map(b => { const d = dataDe(b.criado), s = d !== ant ? `<p class="cs">${fmtDia(d)}</p>` : ''; ant = d; return s + `<div class="bal${b.feito ? ' feito' : ''}" data-act="abrir" data-id="${b.id}" role="button" tabindex="0" style="--c:${corV(b)}"><b>${rotulo(b)}</b>${b.texto ? `<p>${esc(b.texto.slice(0, 160))}</p>` : ''}<small>${hhmm(b.criado)}${b.prazo ? ' · ' + fmtDia(b.prazo) : ''}${b.feito ? ' · ✓' : ''}</small></div>`; }).join('') || nada('Nenhuma mensagem ainda.')}</div>${capForm(`data-caixa="${cx.id}"`, 'Escreva e envie…')}`;
  }],
  cronograma: ['Cronograma', 'Dias na horizontal e uma barra por bloco, da criação ao prazo. Solte num dia para remarcar.', (cx, l) => {
    const t = today(), ini = addDays(t, -4), N = 40, ds = Array.from({ length: N }, (_, i) => addDays(ini, i)), fim = ds[N - 1];
    const pos = d => Math.max(0, Math.min(N - 1, Math.round((parse(d) - parse(ini)) / 864e5))), a = l.filter(b => b.prazo && b.prazo >= ini).sort((x, y) => x.prazo.localeCompare(y.prazo));
    const g = `grid-template-columns:repeat(${N}, 30px)`;
    return a.length ? `<div class="tw"><div class="cron"><div class="cr ch" style="${g}">${ds.map(d => { const wd = parse(d).getDay(); return `<span class="${wd === 0 || wd === 6 ? 'fds' : ''}${d === t ? ' hj' : ''}" data-drop="g" data-modo="dia" data-col="${d}" title="${fmtData(d)}">${parse(d).getDate()}<small>${DSEM[wd][0]}</small></span>`; }).join('')}</div>
      ${a.map(b => { const s = pos(b.criado ? dataDe(b.criado) : b.prazo), e = pos(b.prazo); return `<div class="cr" style="${g}"><div class="cb${b.feito ? ' feito' : ''}${b.prazo > fim ? ' segue' : ''}" draggable="true" data-act="abrir" data-id="${b.id}" role="button" tabindex="0" style="grid-column:${Math.min(s, e) + 1} / ${e + 2};--c:${corV(b)};--ink:${ink(corV(b))}" title="${rotulo(b)}">${rotulo(b)}</div></div>`; }).join('')}</div></div><p class="muted sm hint">Arraste uma barra para um dia do cabeçalho para mudar o prazo.</p>` : nada('Nenhum bloco com prazo nos próximos dias.');
  }],
  estante: ['Estante', 'Cada coluna é uma prateleira e cada bloco, uma lombada. A altura é o peso.', (cx, l) => colsDe(cx.id).map(c => { const bs = l.filter(b => b.coluna === c.id).sort(ordB); return `<h4>${esc(c.nome)} <span class="muted">${bs.length}</span></h4><div class="prat" data-drop="col" data-col="${c.id}">${bs.map(b => `<div class="lomb${b.feito ? ' feito' : ''}" draggable="true" data-act="abrir" data-id="${b.id}" role="button" tabindex="0" style="--c:${corV(b)};--ink:${ink(corV(b))};--h:${110 + b.peso * 24}px" title="${rotulo(b)}">${rotulo(b)}</div>`).join('') || '<span class="muted sm">prateleira vazia</span>'}</div>`; }).join('')],
  faixas: ['Faixas', 'O quadro deitado: cada coluna vira uma faixa que rola para o lado. Boa no celular.', (cx, l) => colsDe(cx.id).map(c => { const bs = l.filter(b => b.coluna === c.id).sort(ordB); return `<section class="faixa${c.feito ? ' final' : ''}" data-drop="col" data-col="${c.id}"><h4>${esc(c.nome)} <span class="muted">${bs.length}${c.limite ? '/' + c.limite : ''}</span></h4><div class="fxr">${bs.map(b => card(b)).join('')}${capForm(`data-col="${c.id}"`, 'Novo…')}</div></section>`; }).join('')],
};

// soltar nas áreas próprias das clássicas (chamado por gdrop)
const GX = {
  raia(b, col) { const [c, r] = col.split('|'); if (b.coluna !== c && !moverColuna(b, c)) return false; b.cor = r; },
  mesa(b, col, e, z) { const r = z.getBoundingClientRect(); b.x = Math.max(1, Math.round(e.clientX - r.left + z.scrollLeft - 90)); b.y = Math.max(1, Math.round(e.clientY - r.top + z.scrollTop - 22)); },
};
const focaTp = id => { const i = $(`.tpi[data-id="${id}"]`); if (i) i.focus(); };
Object.assign(A2, {
  tpNovo(el) { const b = B(el), n = novo({ caixa: b.caixa, coluna: b.coluna, pai: b.pai, titulo: '', ordem: b.ordem + 0.5 }); DB.changed(); draw(); focaTp(n.id); },
  tpIn(el) { const b = B(el), irm = (b.pai ? filhos(b.pai) : raizes(b.caixa).filter(passa).sort(ordB)), p = irm[irm.findIndex(x => x.id === b.id) - 1]; if (!p) return recusa(b.id, 'Não há linha acima para encaixar.'); encaixarEm(b, p.id); draw(); focaTp(b.id); },
  tpOut(el) { const b = B(el), p = b.pai && byId(S.blocos, b.pai); if (!p) return; if (p.pai) { encaixarEm(b, p.pai); b.ordem = p.ordem + 0.5; } else { encaixarEm(b, ''); Object.assign(b, { ordem: p.ordem + 0.5, coluna: p.coluna }); } Data.put('blocos', b); draw(); focaTp(b.id); },
  cadSel(el) { U.nota = el.dataset.id; draw(); },
  aba(el) { U.aba = el.dataset.id; draw(); },
  navSel(el) { const nav = U.nav && U.nav.length ? U.nav : [(colsDe(U.caixa)[0] || {}).id]; U.nav = nav.slice(0, +el.dataset.n).concat(el.dataset.id); draw(); },
  mesaArrumar() { raizes(U.caixa).filter(b => b.x || b.y).forEach(b => { b.x = b.y = 0; Data.put('blocos', b, true); }); DB.changed(); draw(); },
  telaCheia() { const m = $('#main'); if (document.fullscreenElement) document.exitFullscreen(); else if (m.requestFullscreen) m.requestFullscreen().catch(() => toast('O navegador não liberou a tela cheia.')); },
  pivo(el) { const c = byId(S.caixas, U.caixa); U.f.cor = el.dataset.cor; c.vista = 'quadro'; Data.put('caixas', c); draw(); },
});
const F2 = {
  diario(f) { const ls = f.t.value.trim().split('\n'), b = novo({ caixa: f.dataset.id, forma: 'nota', titulo: ls[0].slice(0, 120), texto: ls.slice(1).join('\n').trim() }); DB.changed(); FX.mark(b.id, 'pop'); FX.pluck(); draw(); },
  completo(f) {
    const b = novo({ caixa: f.dataset.id, coluna: f.coluna.value, titulo: f.titulo.value.trim(), forma: f.forma.value, cor: f.cor.value, prazo: f.prazo.value, hora: f.hora.value, prio: +f.prio.value, peso: +f.peso.value, tags: f.tags.value.trim(), texto: f.texto.value });
    f.dentro.value.split('\n').map(x => x.trim()).filter(Boolean).forEach((t, i) => novo({ caixa: b.caixa, coluna: b.coluna, pai: b.id, titulo: t, ordem: i }));
    DB.changed(); FX.mark(b.id, 'pop'); FX.pluck(); draw(); toast('Bloco adicionado. O formulário está pronto para o próximo.'); const i = $('.fform [name=titulo]'); if (i) i.focus();
  },
};
// teclado próprio: tópicos (Enter, Tab, Shift+Tab) e apresentação (setas)
document.addEventListener('keydown', e => {
  const i = e.target, cx = byId(S.caixas, U.caixa);
  if (i.classList && i.classList.contains('tpi') && (e.key === 'Enter' || e.key === 'Tab')) {
    e.preventDefault(); e.stopPropagation();
    const b = byId(S.blocos, i.dataset.id); if (b.titulo !== i.value.trim()) { b.titulo = i.value.trim(); Data.put('blocos', b, true); }
    A[e.key === 'Enter' ? 'tpNovo' : e.shiftKey ? 'tpOut' : 'tpIn']({ dataset: { id: b.id } });
  } else if (U.v === 'caixa' && cx && cx.vista === 'slides' && !i.matches('input,select,textarea') && !document.body.classList.contains('sheet') && (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === ' ')) {
    e.preventDefault(); A.um({ dataset: { k: 'slide', n: e.key === 'ArrowLeft' ? '-1' : '1' } });
  }
}, true);
